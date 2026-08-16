import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/customers?shop_id=xxx
// Returns customers from the customers table + unique customers synthesised from orders.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shopId = searchParams.get("shop_id");
  if (!shopId) return NextResponse.json({ error: "shop_id required" }, { status: 400 });

  // Verify caller owns the shop
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: shop } = await supabase
    .from("shops").select("id").eq("id", shopId).eq("owner_id", user.id).single();
  if (!shop) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();

  // Fetch registered customers (Google/email sign-ups)
  const { data: registered } = await admin
    .from("customers")
    .select("id, name, phone, email, date_of_birth, loyalty_active, created_at, user_id")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });

  // Fetch unique customer name+phone from orders that have no matching customer record
  const { data: orders } = await admin
    .from("orders")
    .select("customer_name, customer_phone, created_at")
    .eq("shop_id", shopId)
    .not("customer_name", "is", null)
    .order("created_at", { ascending: false });

  const registeredPhones = new Set(
    (registered ?? []).map((c) => c.phone).filter(Boolean)
  );

  // Deduplicate orders-based customers by phone (or name if no phone)
  const seen = new Set<string>();
  const orderCustomers: typeof registered = [];

  for (const o of orders ?? []) {
    if (!o.customer_name) continue;
    const key = o.customer_phone ? o.customer_phone : o.customer_name.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);

    // Skip if already in the registered customers table
    if (o.customer_phone && registeredPhones.has(o.customer_phone)) continue;

    orderCustomers.push({
      id: `order_${key}`,
      name: o.customer_name,
      phone: o.customer_phone ?? "",
      email: null,
      date_of_birth: null,
      loyalty_active: false,
      created_at: o.created_at,
      user_id: null,
    });
  }

  const customers = [...(registered ?? []), ...orderCustomers];
  return NextResponse.json({ customers });
}
