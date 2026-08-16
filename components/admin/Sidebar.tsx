"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ShopRole, ROLE_ALLOWED } from "@/lib/auth/role";

const ALL_NAV_ITEMS = [
  { href: "dashboard",       label: "Dashboard", icon: "🏠" },
  { href: "orders",          label: "Orders",    icon: "🧾" },
  { href: "menu",            label: "Menu",      icon: "📋" },
  { href: "qr",              label: "QR Codes",  icon: "📱" },
  { href: "customize",       label: "Customize", icon: "🎨" },
  { href: "loyalty/stamp-card", label: "Loyalty", icon: "⭐" },
  { href: "customers",       label: "Customers", icon: "👥" },
  { href: "team",            label: "Team",      icon: "🏢" },
  { href: "settings",        label: "Settings",  icon: "⚙️" },
];

const ROLE_LABEL: Record<ShopRole, string> = {
  owner:   "Owner",
  manager: "Manager",
  staff:   "Cashier",
};

const ROLE_PILL: Record<ShopRole, string> = {
  owner:   "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  manager: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  staff:   "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
};

export function Sidebar({
  shopSlug,
  shopName,
  role,
}: {
  shopSlug: string;
  shopName: string;
  role: ShopRole;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const allowed = ROLE_ALLOWED[role];
  const navItems = ALL_NAV_ITEMS.filter((item) => {
    if (allowed === "*") return true;
    // Match on first segment of href (e.g. "loyalty/stamp-card" → "loyalty")
    const segment = item.href.split("/")[0];
    return allowed.includes(segment);
  });

  return (
    <aside className="flex flex-col w-56 h-screen sticky top-0 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 py-6 shrink-0">
      <div className="px-5 mb-6">
        <span className="text-lg font-bold text-orange-500">ZenZ</span>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{shopName}</p>
        {/* Role badge */}
        <span className={`inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_PILL[role]}`}>
          {ROLE_LABEL[role]}
        </span>
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => {
          const href = `/admin/${shopSlug}/${item.href}`;
          const active = pathname.startsWith(`/admin/${shopSlug}/${item.href.split("/")[0]}`);
          return (
            <Link
              key={item.href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 mt-4 border-t border-gray-100 dark:border-gray-800 pt-4">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="text-base">🚪</span>
          Sign out
        </button>
      </div>
    </aside>
  );
}
