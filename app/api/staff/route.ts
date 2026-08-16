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

// GET /api/staff?shop_id=xxx
export async function GET(request: NextRequest) {
  const shopId = new URL(request.url).searchParams.get("shop_id");
  if (!shopId) return NextResponse.json({ error: "shop_id required" }, { status: 400 });
  const owner = await verifyOwner(shopId);
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("shop_staff")
    .select("*")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data ?? [] });
}

// POST /api/staff — add staff member
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { shop_id, name, email, phone, role, salary_amount, salary_type, joined_date } = body;
  if (!shop_id || !name || !role) return NextResponse.json({ error: "shop_id, name, role required" }, { status: 400 });

  const owner = await verifyOwner(shop_id);
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.from("shop_staff").insert({
    shop_id, name, email: email || null, phone: phone || null, role,
    salary_amount: salary_amount || 0, salary_type: salary_type || "monthly",
    joined_date: joined_date || null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data });
}

// PATCH /api/staff — update staff member
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, shop_id, ...updates } = body;
  if (!id || !shop_id) return NextResponse.json({ error: "id and shop_id required" }, { status: 400 });

  const owner = await verifyOwner(shop_id);
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.from("shop_staff").update(updates).eq("id", id).eq("shop_id", shop_id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data });
}

// DELETE /api/staff?id=xxx&shop_id=xxx
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const shopId = searchParams.get("shop_id");
  if (!id || !shopId) return NextResponse.json({ error: "id and shop_id required" }, { status: 400 });

  const owner = await verifyOwner(shopId);
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin.from("shop_staff").update({ is_active: false }).eq("id", id).eq("shop_id", shopId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
