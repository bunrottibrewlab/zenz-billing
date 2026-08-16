import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { MenuPage } from "@/components/customer/MenuPage";

export default async function CustomerMenuPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>;
}) {
  const { shopSlug } = await params;
  const supabase = await createClient();

  const { data: shop } = await supabase
    .from("shops")
    .select("id, name, tagline, logo_url, banner_url, banner_height_px, primary_color, currency, ordering_enabled")
    .eq("slug", shopSlug)
    .eq("suspended", false)
    .single();

  if (!shop) notFound();

  const [categoriesRes, productsRes, tablesRes] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, sort_order")
      .eq("shop_id", shop.id)
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("products")
      .select("id, name, description, price, image_url, is_veg, category_id, sort_order")
      .eq("shop_id", shop.id)
      .eq("is_available", true)
      .order("sort_order"),
    supabase
      .from("cafe_tables")
      .select("id, table_number, label")
      .eq("shop_id", shop.id)
      .eq("active", true),
  ]);

  return (
    <MenuPage
      shop={shop}
      shopSlug={shopSlug}
      categories={categoriesRes.data ?? []}
      products={productsRes.data ?? []}
      tables={tablesRes.data ?? []}
    />
  );
}
