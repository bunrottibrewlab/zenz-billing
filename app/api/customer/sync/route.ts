import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Creates or updates a customer record when a user signs in with Google.
// Uses shop_id + user_id as the unique key.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { shop_id } = await request.json();
  if (!shop_id) return NextResponse.json({ error: "shop_id required" }, { status: 400 });

  const admin = createAdminClient();

  // Upsert into customers table — unique on (shop_id, user_id)
  const { error } = await admin.from("customers").upsert(
    {
      shop_id,
      user_id: user.id,
      name: user.user_metadata?.full_name ?? user.email ?? "Unknown",
      email: user.email ?? null,
      phone: "",
      loyalty_active: true,
    },
    { onConflict: "shop_id,user_id", ignoreDuplicates: false }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
