import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get("id");
  if (!orderId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, status, order_type, customer_name, subtotal, total, created_at")
    .eq("id", orderId)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(data);
}
