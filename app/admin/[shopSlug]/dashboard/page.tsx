import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>;
}) {
  const { shopSlug } = await params;
  const supabase = await createClient();

  const { data: shop } = await supabase
    .from("shops")
    .select("id, name, tagline, primary_color, slug")
    .eq("slug", shopSlug)
    .single();

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Stats
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [ordersRes, productsRes, subscriptionRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, total, status")
      .eq("shop_id", shop?.id ?? "")
      .gte("created_at", todayStart.toISOString()),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shop?.id ?? "")
      .eq("is_available", true),
    supabase
      .from("shop_subscriptions")
      .select("status, trial_ends_at, plan_id, plans(name, display_name)")
      .eq("shop_id", shop?.id ?? "")
      .single(),
  ]);

  const todayOrders = ordersRes.data ?? [];
  const todayRevenue = todayOrders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + (o.total ?? 0), 0);
  const activeItems = productsRes.count ?? 0;
  const subscription = subscriptionRes.data;

  const trialEndsAt = subscription?.trial_ends_at
    ? new Date(subscription.trial_ends_at)
    : null;
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000))
    : null;
  const isTrialExpired =
    subscription?.status === "trial" && trialDaysLeft === 0;

  const menuUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/${shopSlug}`;

  return (
    <div className="p-8 max-w-5xl">
      {/* Trial expired banner */}
      {isTrialExpired && (
        <div className="mb-6 flex items-center justify-between bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-5 py-3">
          <p className="text-sm text-red-700 dark:text-red-400 font-medium">
            Your trial has ended. Upgrade to keep using your cafe dashboard.
          </p>
          <Link
            href={`/admin/${shopSlug}/billing`}
            className="text-sm font-semibold text-white bg-red-500 hover:bg-red-600 px-4 py-1.5 rounded-full transition-colors"
          >
            Upgrade Now
          </Link>
        </div>
      )}

      {/* Trial warning banner */}
      {subscription?.status === "trial" && trialDaysLeft !== null && trialDaysLeft > 0 && trialDaysLeft <= 3 && (
        <div className="mb-6 flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-5 py-3">
          <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
            {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} left in your trial.
          </p>
          <Link
            href={`/admin/${shopSlug}/billing`}
            className="text-sm font-semibold text-amber-700 dark:text-amber-400 hover:underline"
          >
            Upgrade Plan →
          </Link>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Welcome back!</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{today}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Today's Revenue"
          value={`₹${todayRevenue.toLocaleString("en-IN")}`}
        />
        <StatCard label="Orders today" value={String(todayOrders.length)} />
        <StatCard label="Active items" value={String(activeItems)} />
        <StatCard
          label="Plan"
          value={
            (subscription?.plans as { display_name?: string } | null)
              ?.display_name ?? "—"
          }
          sub={
            subscription?.status === "trial" && trialDaysLeft !== null
              ? `${trialDaysLeft}d left`
              : undefined
          }
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Manage Menu", href: `/admin/${shopSlug}/menu`, icon: "📋" },
          { label: "QR Codes", href: `/admin/${shopSlug}/qr`, icon: "📱" },
          { label: "Customers", href: `/admin/${shopSlug}/customers`, icon: "👥" },
          { label: "Customize", href: `/admin/${shopSlug}/customize`, icon: "🎨" },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-orange-200 dark:hover:border-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            <span className="text-2xl">{action.icon}</span>
            {action.label}
          </Link>
        ))}
      </div>

      {/* Menu QR card */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-6 max-w-sm">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Your menu URL</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 break-all">{menuUrl}</p>
        <div className="flex gap-2">
          <Link
            href={`/admin/${shopSlug}/qr`}
            className="flex-1 text-xs font-medium py-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors text-center"
          >
            View QR Codes
          </Link>
          <a
            href={menuUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-xs font-medium py-2 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-center"
          >
            Preview Menu
          </a>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
      {sub && <p className="text-xs text-orange-500 mt-0.5">{sub}</p>}
    </div>
  );
}
