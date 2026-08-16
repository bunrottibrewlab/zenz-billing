import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Admin confirms (approve) or dismisses a customer's pending reward claim.
// POST body: { card_id, shop_id, action: "approve" | "dismiss" }
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { card_id, shop_id, action } = await request.json() as {
    card_id: string; shop_id: string; action: "approve" | "dismiss";
  };
  if (!card_id || !shop_id || !action) {
    return NextResponse.json({ error: "card_id, shop_id, and action required" }, { status: 400 });
  }

  // Verify admin owns the shop
  const { data: shop } = await supabase
    .from("shops").select("id").eq("id", shop_id).eq("owner_id", user.id).single();
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const admin = createAdminClient();

  if (action === "dismiss") {
    await admin.from("loyalty_cards")
      .update({ pending_claim: false, updated_at: new Date().toISOString() })
      .eq("id", card_id);
    return NextResponse.json({ ok: true });
  }

  if (action === "approve") {
    // Get the lowest reward tier's stamps_required
    const { data: reward } = await admin
      .from("loyalty_rewards")
      .select("stamps_required")
      .eq("shop_id", shop_id)
      .order("stamps_required")
      .limit(1)
      .maybeSingle();

    const stampsRequired = reward?.stamps_required ?? 10;

    const { data: card } = await admin
      .from("loyalty_cards")
      .select("stamp_count, redeemed_count")
      .eq("id", card_id)
      .single();

    if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

    await admin.from("loyalty_cards").update({
      stamp_count: Math.max(0, card.stamp_count - stampsRequired),
      redeemed_count: (card.redeemed_count ?? 0) + 1,
      pending_claim: false,
      updated_at: new Date().toISOString(),
    }).eq("id", card_id);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
