import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { shop_id, items, customer_name, customer_phone, table_id, notes, order_type, user_id } = body;

  if (!shop_id || !items?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const subtotal = items.reduce(
    (sum: number, item: { price: number; quantity: number }) =>
      sum + item.price * item.quantity,
    0
  );

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      shop_id,
      customer_name: customer_name || null,
      customer_phone: customer_phone || null,
      table_id: table_id || null,
      notes: notes || null,
      order_type: order_type || "dine_in",
      status: "pending",
      subtotal,
      total: subtotal,
      user_id: user_id || null,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message }, { status: 400 });
  }

  const orderItems = items.map(
    (item: {
      product_id: string;
      variant_id?: string;
      name: string;
      price: number;
      quantity: number;
    }) => ({
      order_id: order.id,
      product_id: item.product_id,
      variant_id: item.variant_id || null,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    })
  );

  const { error: itemsError } = await supabase.from("order_items").insert(orderItems);

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 400 });
  }

  return NextResponse.json({ orderId: order.id });
}
