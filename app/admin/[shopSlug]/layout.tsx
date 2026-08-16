import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Sidebar } from "@/components/admin/Sidebar";
import { RouteGuard } from "@/components/admin/RouteGuard";
import { getShopRole } from "@/lib/auth/role";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ shopSlug: string }>;
}) {
  const { shopSlug } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: shop } = await supabase
    .from("shops")
    .select("id, name, slug, owner_id")
    .eq("slug", shopSlug)
    .single();

  if (!shop) notFound();

  const role = await getShopRole(user.id, user.email, shop.id, shop.owner_id);
  if (!role) notFound(); // not owner and not staff → 404

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      <RouteGuard role={role} shopSlug={shopSlug} />
      <Sidebar shopSlug={shopSlug} shopName={shop.name} role={role} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
