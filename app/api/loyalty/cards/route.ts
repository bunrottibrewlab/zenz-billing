import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Admin reads all loyalty cards for their shop.
// GET /api/loyalty/cards?shop_id=xxx
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shopId = searchParams.get("shop_id");
  if (!shopId) return NextResponse.json({ error: "shop_id required" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify caller owns the shop
  const { data: shop } = await supabase
    .from("shops").select("id").eq("id", shopId).eq("owner_id", user.id).single();
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("loyalty_cards")
    .select("id, user_id, user_name, user_email, user_avatar, stamp_count, redeemed_count, pending_claim, updated_at")
    .eq("shop_id", shopId)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cards: data ?? [] });
}
