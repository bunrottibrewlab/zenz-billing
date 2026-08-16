import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { MenuEditor } from "@/components/admin/MenuEditor";

export default async function MenuPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>;
}) {
  const { shopSlug } = await params;
  const supabase = await createClient();

  const { data: shop } = await supabase
    .from("shops")
    .select("id, name")
    .eq("slug", shopSlug)
    .single();

  if (!shop) notFound();

  const [categoriesRes, productsRes, complementsRes] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("shop_id", shop.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("products")
      .select("*")
      .eq("shop_id", shop.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("product_complements")
      .select("product_id, complement_id")
      .eq("shop_id", shop.id),
  ]);

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Menu</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
          Manage your categories and items
        </p>
      </div>
      <MenuEditor
        shopId={shop.id}
        initialCategories={categoriesRes.data ?? []}
        initialProducts={productsRes.data ?? []}
        initialComplements={complementsRes.data ?? []}
      />
    </div>
  );
}
