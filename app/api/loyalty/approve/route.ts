import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { checkin_id, shop_id, customer_id } = body;

  if (!checkin_id || !shop_id || !customer_id) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("id", shop_id)
    .eq("owner_id", user.id)
    .single();

  if (!shop) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { error: updateError } = await admin
    .from("loyalty_checkins")
    .update({ status: "approved", approved_by: user.id })
    .eq("id", checkin_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  const { error: stampError } = await admin
    .from("customer_stamps")
    .insert({ shop_id, customer_id, checkin_id });

  if (stampError) {
    return NextResponse.json({ error: stampError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
