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

// GET /api/leaves?shop_id=xxx&staff_id=xxx(optional)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shopId = searchParams.get("shop_id");
  const staffId = searchParams.get("staff_id");
  if (!shopId) return NextResponse.json({ error: "shop_id required" }, { status: 400 });

  const owner = await verifyOwner(shopId);
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  let query = admin
    .from("staff_leaves")
    .select("*, shop_staff(name, role)")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });

  if (staffId) query = query.eq("staff_id", staffId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leaves: data ?? [] });
}

// POST /api/leaves — create leave request
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { shop_id, staff_id, leave_type, start_date, end_date, reason } = body;
  if (!shop_id || !staff_id || !start_date || !end_date) {
    return NextResponse.json({ error: "shop_id, staff_id, start_date, end_date required" }, { status: 400 });
  }

  const owner = await verifyOwner(shop_id);
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.from("staff_leaves").insert({
    shop_id, staff_id, leave_type: leave_type || "casual",
    start_date, end_date, reason: reason || null, status: "pending",
  }).select("*, shop_staff(name, role)").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leave: data });
}

// PATCH /api/leaves — approve or reject leave
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, shop_id, status } = body;
  if (!id || !shop_id || !status) return NextResponse.json({ error: "id, shop_id, status required" }, { status: 400 });

  const owner = await verifyOwner(shop_id);
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.from("staff_leaves").update({ status }).eq("id", id).eq("shop_id", shop_id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leave: data });
}
