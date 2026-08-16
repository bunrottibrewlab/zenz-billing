import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SettingsEditor } from "@/components/admin/SettingsEditor";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>;
}) {
  const { shopSlug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: shop } = await supabase
    .from("shops")
    .select("id, name, currency")
    .eq("slug", shopSlug)
    .single();

  if (!shop) redirect("/");

  const [subscriptionRes, menuItemsRes, customersRes, tablesRes] =
    await Promise.all([
      supabase
        .from("shop_subscriptions")
        .select(
          "status, trial_ends_at, plan_id, plans(name, display_name, menu_items_limit, loyalty_customers_limit, qr_tables_limit)"
        )
        .eq("shop_id", shop.id)
        .single(),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shop.id)
        .eq("is_available", true),
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shop.id)
        .eq("loyalty_active", true),
      supabase
        .from("cafe_tables")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shop.id)
        .eq("active", true),
    ]);

  return (
    <SettingsEditor
      shopSlug={shopSlug}
      user={user}
      shop={shop}
      subscription={subscriptionRes.data ? {
        ...subscriptionRes.data,
        plans: Array.isArray(subscriptionRes.data.plans)
          ? subscriptionRes.data.plans[0] ?? null
          : subscriptionRes.data.plans,
      } as never : null}
      usageCounts={{
        menuItems: menuItemsRes.count ?? 0,
        customers: customersRes.count ?? 0,
        tables: tablesRes.count ?? 0,
      }}
    />
  );
}
