import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/loyalty/card?shop_id=xxx
// Returns { program, rewards, card, user } for the current signed-in user
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shopId = searchParams.get("shop_id");
  if (!shopId) return NextResponse.json({ error: "shop_id required" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();

  // Fetch loyalty program + rewards using admin client (bypasses RLS)
  const [programRes, rewardsRes] = await Promise.all([
    admin
      .from("loyalty_programs")
      .select("id, shop_id, active, stamps_per_visit")
      .eq("shop_id", shopId)
      .eq("active", true)
      .single(),
    admin
      .from("loyalty_rewards")
      .select("id, shop_id, stamps_required, reward_name, reward_description")
      .eq("shop_id", shopId)
      .order("stamps_required"),
  ]);

  const program = programRes.data ?? null;
  const rewards = rewardsRes.data ?? [];

  if (!program) {
    return NextResponse.json({ program: null, rewards: [], card: null, user: null });
  }

  if (!user) {
    return NextResponse.json({ program, rewards, card: null, user: null });
  }

  const { data: card } = await admin
    .from("loyalty_cards")
    .select("*")
    .eq("shop_id", shopId)
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({
    program,
    rewards,
    card: card ?? null,
    user: { id: user.id, email: user.email, name: user.user_metadata?.full_name, avatar: user.user_metadata?.avatar_url },
  });
}

// POST /api/loyalty/card — award stamps for an order
// Body: { shop_id, order_id, user_id? }
// If user_id is provided (cashier-initiated), the caller must be the shop owner.
// If user_id is omitted, the caller's own session is used (customer self-award — disabled now).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user: caller } } = await supabase.auth.getUser();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { shop_id, order_id, user_id: targetUserId } = body as { shop_id: string; order_id: string; user_id?: string };

  if (!shop_id || !order_id) {
    return NextResponse.json({ error: "shop_id and order_id required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Determine which user receives the stamp
  let recipientId: string;
  if (targetUserId) {
    // Cashier path: verify caller owns the shop
    const { data: shop } = await supabase.from("shops").select("id").eq("id", shop_id).eq("owner_id", caller.id).single();
    if (!shop) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    recipientId = targetUserId;
  } else {
    // Customer self-award (legacy / fallback)
    recipientId = caller.id;
  }

  // Prevent double-award for this specific order
  const { data: existingEvent } = await admin
    .from("loyalty_stamp_events")
    .select("id")
    .eq("order_id", order_id)
    .eq("user_id", recipientId)
    .single();

  if (existingEvent) {
    return NextResponse.json({ ok: false, reason: "already_awarded", message: "Stamp already given for this order." });
  }

  // Fetch loyalty program (all rule fields)
  const { data: program } = await admin
    .from("loyalty_programs")
    .select("id, stamps_per_visit, checkins_per_day, no_daily_limit, min_gap_minutes")
    .eq("shop_id", shop_id)
    .eq("active", true)
    .single();

  if (!program) {
    return NextResponse.json({ ok: false, reason: "no_program", message: "No active loyalty program configured." });
  }

  const stampsAwarded = program.stamps_per_visit ?? 1;

  // Fetch today's stamp events for this user (midnight to now, shop-local calendar day)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: todayEvents } = await admin
    .from("loyalty_stamp_events")
    .select("id, created_at")
    .eq("shop_id", shop_id)
    .eq("user_id", recipientId)
    .gte("created_at", todayStart.toISOString())
    .order("created_at", { ascending: false });

  // --- Daily check-in limit ---
  if (!program.no_daily_limit) {
    const dailyLimit = program.checkins_per_day ?? 1;
    if ((todayEvents?.length ?? 0) >= dailyLimit) {
      return NextResponse.json({
        ok: false,
        reason: "daily_limit_reached",
        message: `Daily limit reached (${dailyLimit} stamp${dailyLimit !== 1 ? "s" : ""} per day). Customer already received their stamp today.`,
      });
    }
  }

  // --- Minimum gap between check-ins ---
  const minGapMinutes = program.min_gap_minutes ?? 0;
  if (minGapMinutes > 0 && todayEvents && todayEvents.length > 0) {
    const lastEventTime = new Date(todayEvents[0].created_at).getTime();
    const minutesSinceLast = (Date.now() - lastEventTime) / 60000;
    if (minutesSinceLast < minGapMinutes) {
      const remainingMinutes = Math.ceil(minGapMinutes - minutesSinceLast);
      return NextResponse.json({
        ok: false,
        reason: "min_gap_not_met",
        message: `Too soon. Minimum gap is ${minGapMinutes} min. Next stamp available in ${remainingMinutes} min.`,
      });
    }
  }

  // Get recipient auth user metadata for card display
  const { data: recipientData } = await admin.auth.admin.getUserById(recipientId);
  const recipientMeta = recipientData?.user;

  // Fetch existing card
  const { data: existingCard } = await admin
    .from("loyalty_cards")
    .select("id, stamp_count")
    .eq("shop_id", shop_id)
    .eq("user_id", recipientId)
    .single();

  const newStampCount = (existingCard?.stamp_count ?? 0) + stampsAwarded;

  if (existingCard) {
    await admin
      .from("loyalty_cards")
      .update({
        stamp_count: newStampCount,
        user_name: recipientMeta?.user_metadata?.full_name ?? recipientMeta?.email ?? null,
        user_email: recipientMeta?.email ?? null,
        user_avatar: recipientMeta?.user_metadata?.avatar_url ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("shop_id", shop_id)
      .eq("user_id", recipientId);
  } else {
    await admin.from("loyalty_cards").insert({
      shop_id,
      user_id: recipientId,
      user_name: recipientMeta?.user_metadata?.full_name ?? recipientMeta?.email ?? null,
      user_email: recipientMeta?.email ?? null,
      user_avatar: recipientMeta?.user_metadata?.avatar_url ?? null,
      stamp_count: newStampCount,
    });
  }

  // Record stamp event for idempotency
  await admin.from("loyalty_stamp_events").insert({
    shop_id,
    user_id: recipientId,
    order_id,
    stamps: stampsAwarded,
  });

  return NextResponse.json({ ok: true, stampCount: newStampCount, stampsAwarded });
}

// PATCH /api/loyalty/card — claim reward (set pending_claim = true)
// Body: { shop_id }
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { shop_id } = body as { shop_id: string };

  if (!shop_id) {
    return NextResponse.json({ error: "shop_id required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("loyalty_cards")
    .update({ pending_claim: true, updated_at: new Date().toISOString() })
    .eq("shop_id", shop_id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
