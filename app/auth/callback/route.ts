import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Customer sign-in: redirect directly to the `next` path (e.g. /cafename)
  const isAdminFlow =
    next === "/" ||
    next.startsWith("/admin") ||
    next.startsWith("/login") ||
    next.startsWith("/register");

  if (!isAdminFlow) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  // Admin flow — always land on /admin which handles shop selection
  return NextResponse.redirect(`${origin}/admin`);
}
