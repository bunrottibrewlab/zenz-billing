import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Reverts loyalty stamps when an order is cancelled.
// Admin-only: verifies the caller owns the shop.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { order_id, shop_id } = await request.json();
  if (!order_id || !shop_id) return NextResponse.json({ error: "order_id and shop_id required" }, { status: 400 });

  // Verify admin owns this shop
  const { data: shop } = await supabase
    .from("shops").select("id").eq("id", shop_id).eq("owner_id", user.id).single();
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const admin = createAdminClient();

  // Find stamp event for this order
  const { data: event } = await admin
    .from("loyalty_stamp_events").select("*").eq("order_id", order_id).maybeSingle();

  if (!event) return NextResponse.json({ ok: true, reverted: false });

  // Deduct stamps from loyalty card — floor at 0
  const { data: card } = await admin
    .from("loyalty_cards")
    .select("id, stamp_count")
    .eq("shop_id", shop_id)
    .eq("user_id", event.user_id)
    .maybeSingle();

  if (card) {
    await admin.from("loyalty_cards").update({
      stamp_count: Math.max(0, card.stamp_count - event.stamps),
      updated_at: new Date().toISOString(),
    }).eq("id", card.id);
  }

  // Delete the stamp event so stamps can be re-awarded if order is re-placed
  await admin.from("loyalty_stamp_events").delete().eq("id", event.id);

  return NextResponse.json({ ok: true, reverted: true, stampsReverted: event.stamps });
}
