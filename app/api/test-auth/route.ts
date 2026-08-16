import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Development-only route used by Playwright globalSetup to establish an authenticated session.
// GET /api/test-auth?e=email&p=password — signs in and redirects to the admin dashboard.
// Returns 404 in production.
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams, origin } = new URL(request.url);
  const email = searchParams.get("e");
  const password = searchParams.get("p");

  if (!email || !password) {
    return NextResponse.json({ error: "e and p required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/login?error=test_auth_failed`);
  }

  // Find the shop slug for redirect
  const { data: shop } = await supabase
    .from("shops")
    .select("slug")
    .eq("owner_id", data.user.id)
    .single();

  const slug = shop?.slug ?? "";
  if (slug) {
    return NextResponse.redirect(`${origin}/admin/${slug}/dashboard`);
  }
  return NextResponse.redirect(`${origin}/register/setup`);
}
