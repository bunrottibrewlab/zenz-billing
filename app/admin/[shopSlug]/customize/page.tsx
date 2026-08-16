import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ShopCustomizer } from "@/components/admin/ShopCustomizer";

export default async function CustomizePage({
  params,
}: {
  params: Promise<{ shopSlug: string }>;
}) {
  const { shopSlug } = await params;
  const supabase = await createClient();

  const { data: shop } = await supabase
    .from("shops")
    .select(
      "id, name, tagline, primary_color, banner_height_px, logo_url, banner_url, ordering_enabled"
    )
    .eq("slug", shopSlug)
    .single();

  if (!shop) notFound();

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Customize</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
          Personalise your shop&apos;s appearance and settings
        </p>
      </div>
      <ShopCustomizer shop={shop} />
    </div>
  );
}
