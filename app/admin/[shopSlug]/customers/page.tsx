import { createClient } from "@/lib/supabase/server";
import { CustomersManager } from "@/components/admin/CustomersManager";

export default async function CustomersPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>;
}) {
  const { shopSlug } = await params;
  const supabase = await createClient();

  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("slug", shopSlug)
    .single();

  return <CustomersManager shopId={shop?.id ?? ""} />;
}
