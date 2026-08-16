"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";

type Plan = {
  name: string;
  display_name: string;
  menu_items_limit: number | null;
  loyalty_customers_limit: number | null;
  qr_tables_limit: number | null;
};

type Subscription = {
  status: string;
  trial_ends_at: string | null;
  plan_id: string;
  plans: Plan | null;
};

type Props = {
  shopSlug: string;
  user: User;
  shop: {
    id: string;
    name: string;
    currency: string;
  };
  subscription: Subscription | null;
  usageCounts: {
    menuItems: number;
    customers: number;
    tables: number;
  };
};

function UsageMeter({
  label,
  current,
  limit,
}: {
  label: string;
  current: number;
  limit: number | null;
}) {
  const pct =
    limit === null ? 0 : Math.min(100, Math.round((current / limit) * 100));
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-gray-600 dark:text-gray-300">{label}</span>
        <span className="text-gray-500 dark:text-gray-400">
          {current} / {limit === null ? "Unlimited" : limit}
        </span>
      </div>
      {limit !== null && (
        <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all ${
              pct >= 90 ? "bg-red-400" : "bg-orange-400"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function SettingsEditor({
  shopSlug,
  user,
  shop,
  subscription,
  usageCounts,
}: Props) {
  const supabase = createClient();
  const router = useRouter();

  const [fullName, setFullName] = useState(
    (user.user_metadata?.full_name as string) ?? ""
  );
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState("");

  const [currency, setCurrency] = useState(shop.currency);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [currencyMsg, setCurrencyMsg] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  const plan = subscription?.plans as Plan | null;

  // Bill settings state
  const [billAddress, setBillAddress] = useState("");
  const [billPhone, setBillPhone] = useState("");
  const [gstin, setGstin] = useState("");
  const [defaultGstPct, setDefaultGstPct] = useState(5);
  const [gstEnabledByDefault, setGstEnabledByDefault] = useState(false);
  const [dineoutAmount, setDineoutAmount] = useState(0);
  const [dineoutLabel, setDineoutLabel] = useState("Packaging Charges");
  const [billFooter, setBillFooter] = useState("Thank you for visiting!");
  const [printerSize, setPrinterSize] = useState<"80mm" | "58mm">("80mm");
  const [savingBill, setSavingBill] = useState(false);
  const [billMsg, setBillMsg] = useState("");

  // Load bill + printer settings on mount
  useEffect(() => {
    supabase.from("bill_settings").select("*").eq("shop_id", shop.id).maybeSingle().then(({ data }) => {
      if (!data) return;
      if (data.shop_address)                setBillAddress(data.shop_address);
      if (data.shop_phone)                  setBillPhone(data.shop_phone);
      if (data.gstin)                       setGstin(data.gstin);
      if (data.default_gst_percent != null) setDefaultGstPct(data.default_gst_percent);
      if (data.gst_enabled_by_default != null) setGstEnabledByDefault(data.gst_enabled_by_default);
      if (data.default_dineout_charge_percent != null) setDineoutAmount(data.default_dineout_charge_percent);
      if (data.dineout_charge_label)        setDineoutLabel(data.dineout_charge_label);
      if (data.bill_footer)                 setBillFooter(data.bill_footer);
      if (data.printer_size)                setPrinterSize(data.printer_size);
      if (data.printer_enabled != null)     setPrinterEnabled(data.printer_enabled);
      if (data.printer_ip)                  setPrinterIp(data.printer_ip);
      if (data.printer_port)                setPrinterPort(data.printer_port);
      if (data.auto_cut != null)            setAutoCut(data.auto_cut);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop.id]);

  // Thermal printer direct-print settings
  const [printerEnabled, setPrinterEnabled] = useState(false);
  const [printerIp, setPrinterIp] = useState("");
  const [printerPort, setPrinterPort] = useState(9100);
  const [autoCut, setAutoCut] = useState(true);
  const [testingPrinter, setTestingPrinter] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveBillSettings() {
    setSavingBill(true);
    setBillMsg("");
    const res = await fetch("/api/bill-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop_id: shop.id,
        shop_address: billAddress || null,
        shop_phone: billPhone || null,
        gstin: gstin || null,
        default_gst_percent: defaultGstPct,
        gst_enabled_by_default: gstEnabledByDefault,
        default_dineout_charge_percent: dineoutAmount,
        dineout_charge_label: dineoutLabel,
        bill_footer: billFooter,
        printer_size: printerSize,
        printer_enabled: printerEnabled,
        printer_ip: printerIp || null,
        printer_port: printerPort,
        auto_cut: autoCut,
      }),
    });
    setSavingBill(false);
    setBillMsg(res.ok ? "Saved!" : "Failed to save");
    if (res.ok) setTimeout(() => setBillMsg(""), 2500);
  }

  async function testPrinterConnection() {
    setTestingPrinter(true);
    setTestMsg(null);
    const res = await fetch(`/api/print?shop_id=${shop.id}`);
    const data = await res.json();
    setTestingPrinter(false);
    if (data.ok) {
      setTestMsg({ ok: true, text: `Connected to ${data.ip}:${data.port} — test page sent!` });
    } else {
      setTestMsg({ ok: false, text: data.error ?? "Connection failed" });
    }
  }

  const trialEndsAt = subscription?.trial_ends_at
    ? new Date(subscription.trial_ends_at)
    : null;
  const trialDaysLeft = trialEndsAt
    ? Math.max(
        0,
        Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000)
      )
    : null;

  async function saveName() {
    setSavingName(true);
    setNameMsg("");
    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName },
    });
    setNameMsg(error ? error.message : "Saved");
    setSavingName(false);
  }

  async function saveCurrency() {
    setSavingCurrency(true);
    setCurrencyMsg("");
    const { error } = await supabase
      .from("shops")
      .update({ currency })
      .eq("id", shop.id);
    setCurrencyMsg(error ? error.message : "Saved");
    setSavingCurrency(false);
  }

  async function updatePassword() {
    setPasswordMsg("");
    setPasswordError(false);

    if (newPassword !== confirmPassword) {
      setPasswordMsg("Passwords do not match");
      setPasswordError(true);
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg("Password must be at least 6 characters");
      setPasswordError(true);
      return;
    }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) {
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMsg("Password updated successfully");
    } else {
      setPasswordMsg(error.message);
      setPasswordError(true);
    }
    setSavingPassword(false);
  }

  async function deleteShop() {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${shop.name}"? This cannot be undone.`
    );
    if (!confirmed) return;
    await supabase.from("shops").delete().eq("id", shop.id);
    router.push("/");
  }

  const planBadgeClass =
    subscription?.status === "trial"
      ? "bg-amber-100 text-amber-700"
      : plan?.name === "pro"
      ? "bg-purple-100 text-purple-700"
      : "bg-blue-100 text-blue-700";

  const planLabel =
    subscription?.status === "trial" ? "Trial" : (plan?.display_name ?? "Free");

  const inputCls = "w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent";
  const labelCls = "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1";
  const sectionCls = "bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-6 mb-6";

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-8">Settings</h1>

      <section className={sectionCls}>
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">Account</h2>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" value={user.email ?? ""} readOnly className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-400 cursor-not-allowed" />
          </div>
          <div>
            <label className={labelCls}>Full Name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={saveName} disabled={savingName} className="px-4 py-2 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-60 transition-colors">
              {savingName ? "Saving…" : "Save"}
            </button>
            {nameMsg && <span className="text-xs text-gray-500 dark:text-gray-400">{nameMsg}</span>}
          </div>
        </div>
      </section>

      <div className="border-t border-gray-100 dark:border-gray-800 mb-6" />

      <section className={sectionCls}>
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">Currency</h2>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Display Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
              <option value="INR">INR — Indian Rupee</option>
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — British Pound</option>
              <option value="AED">AED — UAE Dirham</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={saveCurrency} disabled={savingCurrency} className="px-4 py-2 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-60 transition-colors">
              {savingCurrency ? "Saving…" : "Save"}
            </button>
            {currencyMsg && <span className="text-xs text-gray-500 dark:text-gray-400">{currencyMsg}</span>}
          </div>
        </div>
      </section>

      <div className="border-t border-gray-100 dark:border-gray-800 mb-6" />

      <section className={sectionCls}>
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">Security</h2>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>New Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputCls} />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={updatePassword} disabled={savingPassword} className="px-4 py-2 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-60 transition-colors">
              {savingPassword ? "Updating…" : "Update Password"}
            </button>
            {passwordMsg && (
              <span className={`text-xs ${passwordError ? "text-red-500" : "text-green-600"}`}>
                {passwordMsg}
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="border-t border-gray-100 dark:border-gray-800 mb-6" />

      <section className={sectionCls}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Plan & Usage</h2>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${planBadgeClass}`}>
            {planLabel}
          </span>
        </div>
        {subscription?.status === "trial" && trialDaysLeft !== null && (
          <p className="text-sm text-amber-600 mb-4 font-medium">
            {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} left in your trial
          </p>
        )}
        <div className="space-y-4 mb-5">
          <UsageMeter label="Menu Items" current={usageCounts.menuItems} limit={plan?.menu_items_limit ?? null} />
          <UsageMeter label="Active Loyalty Customers" current={usageCounts.customers} limit={plan?.loyalty_customers_limit ?? null} />
          <UsageMeter label="QR Tables" current={usageCounts.tables} limit={plan?.qr_tables_limit ?? null} />
        </div>
        <Link href={`/admin/${shopSlug}/billing`} className="text-sm font-medium text-orange-600 hover:underline">
          Upgrade Plan →
        </Link>
      </section>

      <div className="border-t border-gray-100 dark:border-gray-800 mb-6" />

      {/* Bill Settings */}
      <section className="mb-6">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">Bill Settings</h2>
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Shop address</label>
              <input value={billAddress} onChange={(e) => setBillAddress(e.target.value)} placeholder="123 Main St, City" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Shop phone</label>
              <input value={billPhone} onChange={(e) => setBillPhone(e.target.value)} placeholder="+91 98765 43210" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">GSTIN <span className="text-gray-400 font-normal">(optional)</span></label>
            <input value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="27AAPFU0939F1ZV" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Default GST %</label>
              <input type="number" min={0} max={100} value={defaultGstPct} onChange={(e) => setDefaultGstPct(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer pb-1">
                <input type="checkbox" checked={gstEnabledByDefault} onChange={(e) => setGstEnabledByDefault(e.target.checked)} className="accent-orange-500" />
                <span className="text-xs text-gray-600 dark:text-gray-400">GST on by default</span>
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Default packaging/dineout charge</label>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0">₹</span>
                <input type="number" min={0} value={dineoutAmount} onChange={(e) => setDineoutAmount(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400" placeholder="0" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Charge label</label>
              <input value={dineoutLabel} onChange={(e) => setDineoutLabel(e.target.value)} placeholder="Packaging Charges" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Bill footer message</label>
            <input value={billFooter} onChange={(e) => setBillFooter(e.target.value)} placeholder="Thank you for visiting!" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Thermal printer size</label>
            <div className="flex gap-3">
              {(["80mm", "58mm"] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPrinterSize(size)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${printerSize === size ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-600" : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-orange-300"}`}
                >
                  {size} {size === "80mm" ? "(Standard)" : "(Narrow)"}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Match your thermal printer roll width for correct bill formatting.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={saveBillSettings} disabled={savingBill} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
              {savingBill ? "Saving…" : "Save Bill Settings"}
            </button>
            {billMsg && <span className="text-sm text-green-600">{billMsg}</span>}
          </div>
        </div>
      </section>

      <div className="border-t border-gray-100 dark:border-gray-800 mb-6" />

      {/* ── Thermal Printer Settings ─────────────────────────────────────── */}
      <section className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-1">Thermal Printer (Direct Wi-Fi)</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Print bills directly to your POSiFLOW or any ESC/POS-compatible receipt printer over Wi-Fi — bypasses the Android/browser print dialog entirely.
        </p>

        <div className="space-y-4">
          {/* Enable toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPrinterEnabled(!printerEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${printerEnabled ? "bg-orange-500" : "bg-gray-200 dark:bg-gray-600"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${printerEnabled ? "translate-x-6" : "translate-x-1"}`} />
            </button>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {printerEnabled ? "Direct thermal printing enabled" : "Direct thermal printing disabled"}
            </span>
          </div>

          {printerEnabled && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Printer IP Address</label>
                  <input
                    type="text" value={printerIp} onChange={(e) => setPrinterIp(e.target.value)}
                    placeholder="192.168.x.x"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Port</label>
                  <input
                    type="number" value={printerPort} onChange={(e) => setPrinterPort(Number(e.target.value))}
                    min={1} max={65535}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400 font-mono"
                  />
                  <p className="text-[11px] text-gray-400 mt-0.5">Default: 9100 (RAW)</p>
                </div>
              </div>

              {/* Auto-cut */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setAutoCut(!autoCut)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoCut ? "bg-orange-500" : "bg-gray-200 dark:bg-gray-600"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${autoCut ? "translate-x-6" : "translate-x-1"}`} />
                </button>
                <span className="text-sm text-gray-700 dark:text-gray-200">Auto-cut paper after each receipt</span>
              </div>

              {/* Info card */}
              <div className="flex gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3">
                <span className="text-blue-500 text-lg shrink-0">ℹ</span>
                <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                  <p><strong>POSiFLOW KP307-UEWB setup:</strong> Connect printer to Wi-Fi. Find its IP in the printer&apos;s network report (hold feed button 3s). Port is 9100 (RAW).</p>
                  <p>The Next.js server must be on the <strong>same network</strong> as the printer for direct printing to work.</p>
                </div>
              </div>

              {/* Test print */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={testPrinterConnection}
                  disabled={testingPrinter || !printerIp}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  {testingPrinter ? "Testing…" : "🖨 Test Print"}
                </button>
                {testMsg && (
                  <span className={`text-sm font-medium ${testMsg.ok ? "text-green-600" : "text-red-500"}`}>
                    {testMsg.ok ? "✓ " : "✗ "}{testMsg.text}
                  </span>
                )}
              </div>
            </>
          )}

          <div className="flex items-center gap-3">
            <button onClick={saveBillSettings} disabled={savingBill} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
              {savingBill ? "Saving…" : "Save Printer Settings"}
            </button>
            {billMsg && <span className="text-sm text-green-600">{billMsg}</span>}
          </div>
        </div>
      </section>

      <div className="border-t border-gray-100 dark:border-gray-800 mb-6" />

      <section className="border border-red-200 dark:border-red-800 rounded-xl p-6">
        <h2 className="text-base font-semibold text-red-600 mb-2">Danger Zone</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Deleting your shop is permanent and cannot be undone. All data
          including menu items, orders, and customers will be lost.
        </p>
        <button onClick={deleteShop} className="px-4 py-2 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
          Delete Shop
        </button>
      </section>
    </div>
  );
}
