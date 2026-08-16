import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { OrdersManager } from "@/components/admin/OrdersManager";

export default async function OrdersPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>;
}) {
  const { shopSlug } = await params;
  const supabase = await createClient();

  const { data: shop } = await supabase
    .from("shops")
    .select("id, name, tagline, logo_url, currency")
    .eq("slug", shopSlug)
    .single();

  if (!shop) notFound();

  const { data: billSettings } = await supabase
    .from("bill_settings")
    .select("*")
    .eq("shop_id", shop.id)
    .single();

  return (
    <OrdersManager
      shopId={shop.id}
      shopName={shop.name}
      shopTagline={shop.tagline}
      logoUrl={shop.logo_url}
      currency={shop.currency ?? "INR"}
      billSettings={billSettings ?? {}}
    />
  );
}
