import { createClient } from "@/lib/supabase/server";
import { StampCardConfig } from "@/components/admin/StampCardConfig";

export default async function StampCardPage({
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

  if (!shop) return null;

  const [programRes, rewardsRes] = await Promise.all([
    supabase
      .from("loyalty_programs")
      .select("*")
      .eq("shop_id", shop.id)
      .single(),
    supabase
      .from("loyalty_rewards")
      .select("*")
      .eq("shop_id", shop.id)
      .order("stamps_required", { ascending: true }),
  ]);

  return (
    <StampCardConfig
      shopId={shop.id}
      shopSlug={shopSlug}
      initialProgram={programRes.data ?? null}
      initialRewards={rewardsRes.data ?? []}
    />
  );
}
