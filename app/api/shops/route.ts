import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, slug, category, currency, tagline, primary_color, owner_id } = body;

  if (!name || !slug || !category) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Resolve owner: either passed explicitly (old email flow) or from session (OAuth flow)
  let resolvedOwnerId = owner_id as string | undefined;
  if (!resolvedOwnerId) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    resolvedOwnerId = user.id;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("shops").insert({
    owner_id: resolvedOwnerId,
    name,
    slug,
    category,
    currency: currency ?? "INR",
    tagline: tagline ?? null,
    primary_color: primary_color ?? "#F97316",
  });

  if (error) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
