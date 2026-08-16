import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { shop_id, ...settings } = body;
  if (!shop_id) return NextResponse.json({ error: "shop_id required" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("bill_settings")
    .upsert({ shop_id, ...settings }, { onConflict: "shop_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
