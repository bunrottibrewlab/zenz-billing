import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Verify the caller is the shop owner or an active staff member */
async function verifyAccess(userId: string, userEmail: string | undefined | null, shopId: string) {
  const admin = createAdminClient();

  const { data: shop } = await admin
    .from("shops")
    .select("owner_id")
    .eq("id", shopId)
    .single();

  if (!shop) return false;
  if (shop.owner_id === userId) return true;

  if (userEmail) {
    const { data: staff } = await admin
      .from("shop_staff")
      .select("id")
      .eq("shop_id", shopId)
      .eq("email", userEmail)
      .eq("is_active", true)
      .maybeSingle();
    if (staff) return true;
  }

  return false;
}

/* ── POST /api/admin/orders — create order + items ── */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { shop_id, order_type, items } = body;

  if (!shop_id || !items?.length) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const canAccess = await verifyAccess(user.id, user.email, shop_id);
  if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const subtotal = items.reduce(
    (s: number, i: { price: number; quantity: number }) => s + i.price * i.quantity,
    0
  );

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      shop_id,
      order_type: order_type ?? "dine_in",
      status: "pending",
      customer_name: null,
      customer_phone: null,
      notes: null,
      subtotal,
      total: subtotal,
    })
    .select("id, status, order_type, customer_name, customer_phone, notes, subtotal, total, is_billed, created_at, user_id")
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ error: orderErr?.message ?? "Insert failed" }, { status: 400 });
  }

  const orderItems = items.map((i: { product_id: string; name: string; price: number; quantity: number }) => ({
    order_id: order.id,
    product_id: i.product_id,
    name: i.name,
    price: i.price,
    quantity: i.quantity,
  }));

  const { error: itemsErr } = await admin.from("order_items").insert(orderItems);
  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 400 });

  return NextResponse.json({ order });
}

/* ── PATCH /api/admin/orders — update order status or cancel ── */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { order_id, shop_id, status } = body;

  if (!order_id || !shop_id || !status) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const canAccess = await verifyAccess(user.id, user.email, shop_id);
  if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({ status })
    .eq("id", order_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

/* ── GET /api/admin/orders?shop_id=... — list orders ── */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const shopId = request.nextUrl.searchParams.get("shop_id");
  if (!shopId) return NextResponse.json({ error: "Missing shop_id" }, { status: 400 });

  const canAccess = await verifyAccess(user.id, user.email, shopId);
  if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select("id, status, order_type, customer_name, customer_phone, notes, subtotal, total, is_billed, created_at, user_id")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ orders: data ?? [] });
}
