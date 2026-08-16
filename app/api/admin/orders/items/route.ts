import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orderId = request.nextUrl.searchParams.get("order_id");
  if (!orderId) return NextResponse.json({ error: "Missing order_id" }, { status: 400 });

  const admin = createAdminClient();

  // Verify caller has access to the shop this order belongs to
  const { data: order } = await admin
    .from("orders")
    .select("shop_id")
    .eq("id", orderId)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const { data: shop } = await admin
    .from("shops")
    .select("owner_id")
    .eq("id", order.shop_id)
    .single();

  const isOwner = shop?.owner_id === user.id;
  let isStaff = false;
  if (!isOwner && user.email) {
    const { data: staff } = await admin
      .from("shop_staff")
      .select("id")
      .eq("shop_id", order.shop_id)
      .eq("email", user.email)
      .eq("is_active", true)
      .maybeSingle();
    isStaff = !!staff;
  }

  if (!isOwner && !isStaff) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: items, error } = await admin
    .from("order_items")
    .select("id, name, price, quantity")
    .eq("order_id", orderId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: items ?? [] });
}
