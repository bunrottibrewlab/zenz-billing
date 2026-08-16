import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { OrderTracker } from "@/components/customer/OrderTracker";

export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ shopSlug: string; orderId: string }>;
}) {
  const { shopSlug, orderId } = await params;
  const supabase = createAdminClient();

  const { data: shop } = await supabase
    .from("shops")
    .select("id, name, primary_color, currency")
    .eq("slug", shopSlug)
    .single();

  if (!shop) notFound();

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("shop_id", shop.id)
    .single();

  if (!order) notFound();

  const { data: items } = await supabase
    .from("order_items")
    .select("id, name, price, quantity")
    .eq("order_id", orderId);

  return (
    <OrderTracker
      initialOrder={order as never}
      items={(items ?? []) as never}
      shopSlug={shopSlug}
      shopId={shop.id}
      shopName={shop.name}
      color={shop.primary_color ?? "#F97316"}
      currency={shop.currency ?? "INR"}
    />
  );
}
