import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";

type ShopEntry = {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "manager" | "staff";
  href: string;
};

export default async function AdminRootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const shops: ShopEntry[] = [];

  // All shops the user owns
  const { data: ownedShops } = await supabase
    .from("shops")
    .select("id, name, slug")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  for (const s of ownedShops ?? []) {
    shops.push({ id: s.id, name: s.name, slug: s.slug, role: "owner", href: `/admin/${s.slug}/dashboard` });
  }

  // Staff shops (if any)
  if (user.email) {
    const admin = createAdminClient();
    const { data: staffRows } = await admin
      .from("shop_staff")
      .select("shop_id, role")
      .eq("email", user.email)
      .eq("is_active", true);

    if (staffRows?.length) {
      const staffShopIds = staffRows.map((r: { shop_id: string }) => r.shop_id);
      const { data: staffShops } = await admin
        .from("shops")
        .select("id, name, slug")
        .in("id", staffShopIds);

      for (const s of staffShops ?? []) {
        // Skip if already listed as owner
        if (shops.find((e) => e.id === s.id)) continue;
        const staffRole = staffRows.find((r: { shop_id: string; role: string }) => r.shop_id === s.id)?.role ?? "staff";
        const uiRole = staffRole === "admin" || staffRole === "manager" ? "manager" : "staff";
        shops.push({ id: s.id, name: s.name, slug: s.slug, role: uiRole, href: `/admin/${s.slug}/orders` });
      }
    }
  }

  // Auto-redirect when there's exactly one shop
  if (shops.length === 1) redirect(shops[0].href);

  // No shops at all → register
  if (shops.length === 0) redirect("/register");

  // Multiple shops → show selector
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="text-2xl font-bold text-orange-500">ZenZ</span>
          <h1 className="mt-4 text-3xl font-bold text-gray-900 dark:text-gray-50">
            Your Cafes
          </h1>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            {shops.length} cafe{shops.length !== 1 ? "s" : ""} — select one to continue
          </p>
        </div>

        {/* Shop cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {shops.map((shop) => (
            <Link
              key={shop.id}
              href={shop.href}
              className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 hover:border-orange-300 dark:hover:border-orange-700 hover:shadow-md transition-all"
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-2xl mb-4">
                ☕
              </div>

              {/* Name & role */}
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-base font-bold text-gray-900 dark:text-gray-50 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors leading-tight">
                  {shop.name}
                </p>
                <RoleBadge role={shop.role} />
              </div>

              <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                {shop.slug}
              </p>

              {/* Arrow */}
              <div className="mt-4 flex items-center justify-end text-gray-300 dark:text-gray-600 group-hover:text-orange-400 transition-colors">
                <span className="text-lg">→</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Register another cafe */}
        <p className="mt-8 text-center text-sm text-gray-400 dark:text-gray-500">
          Want to add another cafe?{" "}
          <Link href="/register" className="text-orange-500 font-medium hover:underline">
            Register a new cafe
          </Link>
        </p>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: "owner" | "manager" | "staff" }) {
  const config = {
    owner:   { label: "Owner",   cls: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" },
    manager: { label: "Manager", cls: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
    staff:   { label: "Cashier", cls: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" },
  }[role];

  return (
    <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${config.cls}`}>
      {config.label}
    </span>
  );
}
