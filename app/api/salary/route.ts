import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function verifyOwner(shopId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: shop } = await supabase.from("shops").select("id").eq("id", shopId).eq("owner_id", user.id).single();
  return shop ? user : null;
}

// GET /api/salary?shop_id=xxx&staff_id=xxx(optional)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shopId = searchParams.get("shop_id");
  const staffId = searchParams.get("staff_id");
  if (!shopId) return NextResponse.json({ error: "shop_id required" }, { status: 400 });

  const owner = await verifyOwner(shopId);
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  let query = admin
    .from("salary_payments")
    .select("*, shop_staff(name, role)")
    .eq("shop_id", shopId)
    .order("paid_at", { ascending: false });

  if (staffId) query = query.eq("staff_id", staffId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payments: data ?? [] });
}

// POST /api/salary — record salary payment
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { shop_id, staff_id, amount, period_label, payment_method, notes } = body;
  if (!shop_id || !staff_id || !amount || !period_label) {
    return NextResponse.json({ error: "shop_id, staff_id, amount, period_label required" }, { status: 400 });
  }

  const owner = await verifyOwner(shop_id);
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.from("salary_payments").insert({
    shop_id, staff_id, amount, period_label,
    payment_method: payment_method || "cash",
    notes: notes || null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payment: data });
}
