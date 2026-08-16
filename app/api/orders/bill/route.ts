import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const {
    order_id,
    discount_percent,
    discount_amount,
    gst_percent,
    gst_amount,
    dineout_charge_percent,
    dineout_charge_amount,
    total,
    is_billed,
  } = body;

  if (!order_id) {
    return NextResponse.json({ error: "order_id required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Verify the order belongs to a shop this user owns or is staff of
  const { data: order } = await admin
    .from("orders")
    .select("shop_id")
    .eq("id", order_id)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const { data: ownerShop } = await admin
    .from("shops")
    .select("id")
    .eq("id", order.shop_id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!ownerShop) {
    // Also allow staff members (manager/admin role) to bill
    const { data: staffRow } = await admin
      .from("shop_staff")
      .select("id, role")
      .eq("shop_id", order.shop_id)
      .eq("email", user.email ?? "")
      .eq("is_active", true)
      .maybeSingle();

    if (!staffRow) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { error } = await admin
    .from("orders")
    .update({
      discount_percent,
      discount_amount,
      gst_percent,
      gst_amount,
      dineout_charge_percent,
      dineout_charge_amount,
      total,
      is_billed,
      status: "completed",
    })
    .eq("id", order_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
