import { createClient } from "@/lib/supabase/server";
import { TeamManager } from "@/components/admin/TeamManager";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>;
}) {
  const { shopSlug } = await params;
  const supabase = await createClient();

  const { data: shop } = await supabase
    .from("shops")
    .select("id, currency")
    .eq("slug", shopSlug)
    .single();

  return <TeamManager shopId={shop?.id ?? ""} currency={shop?.currency ?? "INR"} />;
}
