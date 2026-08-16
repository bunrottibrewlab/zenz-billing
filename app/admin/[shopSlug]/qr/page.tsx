import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { QRDisplay } from "@/components/admin/QRDisplay";

export default async function QRPage({
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

  const { data: tables } = await supabase
    .from("cafe_tables")
    .select("*")
    .eq("shop_id", shop.id)
    .order("table_number", { ascending: true });

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">QR Codes</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
          Share QR codes for your menu and individual tables
        </p>
      </div>
      <QRDisplay
        shopId={shop.id}
        shopSlug={shopSlug}
        initialTables={tables ?? []}
      />
    </div>
  );
}
