"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Shop = {
  id: string;
  name: string;
  tagline: string | null;
  primary_color: string | null;
  banner_height_px: number | null;
  logo_url: string | null;
  banner_url: string | null;
  ordering_enabled: boolean | null;
};

type Tab = "branding" | "ordering" | "bill" | "social";

// ── Receipt preview ──────────────────────────────────────────────────
type BillPreviewProps = {
  shopName: string;
  logoUrl: string;
  shopAddress: string;
  shopPhone: string;
  gstin: string;
  showAddress: boolean;
  showPhone: boolean;
  showGstin: boolean;
  billFooter: string;
  printerSize: "80mm" | "58mm";
  showGst: boolean;
  gstPercent: number;
  showDiscount: boolean;
  showDineout: boolean;
  dineoutLabel: string;
};

function ReceiptPreview(p: BillPreviewProps) {
  const W = p.printerSize === "58mm" ? 220 : 296;
  const fs = p.printerSize === "58mm" ? 10 : 11;

  const subtotal = 135, discount = p.showDiscount ? 13.50 : 0, afterDis = subtotal - discount;
  const gst = p.showGst ? Math.round(afterDis * p.gstPercent) / 100 : 0;
  const dineout = p.showDineout ? 5 : 0;
  const total = afterDis + gst + dineout;

  const row2 = (l: string, r: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
      <span>{l}</span><span>{r}</span>
    </div>
  );

  const sep = <hr style={{ border: "none", borderTop: "1px solid #000", margin: "5px 0" }} />;
  const sepD = <hr style={{ border: "none", borderTop: "2px solid #000", margin: "5px 0" }} />;

  return (
    <div style={{
      width: W, fontFamily: "'Courier New', monospace", fontSize: fs,
      lineHeight: 1.5, color: "#000", background: "#fff",
      padding: "14px 12px", borderRadius: 6,
      boxShadow: "0 2px 16px rgba(0,0,0,0.18)",
    }}>
      {/* Logo */}
      {p.logoUrl && (
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
          <img src={p.logoUrl} alt="logo" style={{ height: 48, width: 48, borderRadius: "50%", objectFit: "cover", display: "block" }} />
        </div>
      )}

      {/* Shop header */}
      <div style={{ textAlign: "center", fontWeight: 900, fontSize: fs + 3, marginBottom: 2 }}>{p.shopName || "Shop Name"}</div>
      {p.showAddress && p.shopAddress && <div style={{ textAlign: "center", fontSize: fs - 1 }}>{p.shopAddress}</div>}
      {p.showPhone && p.shopPhone && <div style={{ textAlign: "center", fontSize: fs - 1 }}>Ph: {p.shopPhone}</div>}
      {p.showGstin && p.gstin && <div style={{ textAlign: "center", fontSize: fs - 1 }}>GSTIN: {p.gstin}</div>}

      {/* TAX INVOICE title */}
      <div style={{
        textAlign: "center", fontWeight: "bold", fontSize: fs + 1,
        letterSpacing: 2, borderTop: "2px solid #000", borderBottom: "2px solid #000",
        padding: "3px 0", margin: "6px 0",
      }}>
        TAX INVOICE
      </div>

      {/* Meta */}
      <div style={{ fontSize: fs - 1, marginBottom: 4 }}>
        {row2("Bill No.", "ORD-AB12CD34EF56")}
        {row2("Date", "15-Aug-2026 12:30")}
        {row2("Customer", "John Doe")}
        {row2("Type", "Dine In")}
      </div>

      {/* Items */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: fs }}>
        <thead>
          <tr style={{ borderTop: "1px solid #000", borderBottom: "1px solid #000" }}>
            <th style={{ textAlign: "left", padding: "2px 0", fontWeight: "bold", width: "60%" }}>ITEM</th>
            <th style={{ textAlign: "center", padding: "2px 0", fontWeight: "bold", width: "10%" }}>QTY</th>
            <th style={{ textAlign: "right", padding: "2px 0", fontWeight: "bold", width: "30%" }}>AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          {[["Tea", 1, 15], ["Coffee", 2, 40], ["Sandwich", 1, 80]].map(([name, qty, amt]) => (
            <tr key={String(name)}>
              <td style={{ padding: "2px 0" }}>{name}</td>
              <td style={{ textAlign: "center", padding: "2px 0" }}>{qty}</td>
              <td style={{ textAlign: "right", padding: "2px 0" }}>₹{Number(amt).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {sep}

      {/* Charges */}
      <div style={{ fontSize: fs }}>
        {row2("Subtotal", "₹135.00")}
        {p.showDiscount && row2("Discount (10%)", `-₹${discount.toFixed(2)}`)}
        {p.showGst && row2(`GST (${p.gstPercent}%)`, `₹${gst.toFixed(2)}`)}
        {p.showDineout && row2(`${p.dineoutLabel || "Packaging"}`, `₹${dineout.toFixed(2)}`)}
      </div>

      {/* Total */}
      <div style={{ borderTop: "2px solid #000", borderBottom: "2px solid #000", margin: "5px 0", padding: "3px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: fs + 3 }}>
          <span>TOTAL</span>
          <span>₹{total.toFixed(2)}</span>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", fontSize: fs - 1, marginTop: 6, fontWeight: "bold" }}>{p.billFooter || "Thank you for visiting!"}</div>
      <div style={{ textAlign: "center", fontSize: fs - 2, color: "#888", marginTop: 2 }}>Powered by ZenZ</div>
    </div>
  );
}

export function ShopCustomizer({ shop }: { shop: Shop }) {
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<Tab>("branding");

  // Branding
  const [name, setName] = useState(shop.name ?? "");
  const [tagline, setTagline] = useState(shop.tagline ?? "");
  const [primaryColor, setPrimaryColor] = useState(shop.primary_color ?? "#F97316");
  const [bannerHeight, setBannerHeight] = useState(shop.banner_height_px ?? 180);
  const [logoUrl, setLogoUrl] = useState(shop.logo_url ?? "");
  const [bannerUrl, setBannerUrl] = useState(shop.banner_url ?? "");
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const [brandingSaved, setBrandingSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Ordering
  const [orderingEnabled, setOrderingEnabled] = useState(shop.ordering_enabled ?? false);
  const [orderingUpdating, setOrderingUpdating] = useState(false);

  // Bill template
  const [shopAddress, setShopAddress] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [gstin, setGstin] = useState("");
  const [billFooter, setBillFooter] = useState("Thank you for visiting!");
  const [printerSize, setPrinterSize] = useState<"80mm" | "58mm">("80mm");
  const [showAddress, setShowAddress] = useState(true);
  const [showPhone, setShowPhone] = useState(true);
  const [showGstin, setShowGstin] = useState(true);
  const [showGst, setShowGst] = useState(false);
  const [gstPercent, setGstPercent] = useState(5);
  const [showDiscount, setShowDiscount] = useState(true);
  const [showDineout, setShowDineout] = useState(false);
  const [dineoutLabel, setDineoutLabel] = useState("Packaging Charges");
  const [billSaving, setBillSaving] = useState(false);
  const [billSaved, setBillSaved] = useState(false);

  useEffect(() => {
    supabase
      .from("bill_settings")
      .select("*")
      .eq("shop_id", shop.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setShopAddress(data.shop_address ?? "");
        setShopPhone(data.shop_phone ?? "");
        setGstin(data.gstin ?? "");
        setBillFooter(data.bill_footer ?? "Thank you for visiting!");
        setPrinterSize((data.printer_size as "80mm" | "58mm") ?? "80mm");
        setShowGst(data.gst_enabled_by_default ?? false);
        setGstPercent(data.default_gst_percent ?? 5);
        setDineoutLabel(data.dineout_charge_label ?? "Packaging Charges");
      });
  }, [shop.id]);

  async function handleSaveBranding() {
    if (!name.trim()) { setBrandingError("Shop name is required"); return; }
    setBrandingSaving(true); setBrandingError(null); setBrandingSaved(false);
    const { error } = await supabase.from("shops").update({
      name: name.trim(), tagline: tagline.trim() || null,
      primary_color: primaryColor, banner_height_px: bannerHeight,
      logo_url: logoUrl.trim() || null, banner_url: bannerUrl.trim() || null,
    }).eq("id", shop.id);
    setBrandingSaving(false);
    if (error) { setBrandingError(error.message); return; }
    setBrandingSaved(true);
    setTimeout(() => setBrandingSaved(false), 2500);
  }

  async function handleImageUpload(file: File, type: "logo" | "banner") {
    const ext = file.name.split(".").pop();
    const path = `${shop.id}/${type}.${ext}`;
    const setUploading = type === "logo" ? setLogoUploading : setBannerUploading;
    const setUrl = type === "logo" ? setLogoUrl : setBannerUrl;
    setUploading(true);
    const { error } = await supabase.storage.from("shop-assets").upload(path, file, { upsert: true });
    if (error) { alert(`Upload failed: ${error.message}`); setUploading(false); return; }
    const { data } = supabase.storage.from("shop-assets").getPublicUrl(path);
    setUrl(data.publicUrl);
    setUploading(false);
    await supabase.from("shops").update({ [`${type}_url`]: data.publicUrl }).eq("id", shop.id);
  }

  async function handleToggleOrdering(value: boolean) {
    setOrderingEnabled(value); setOrderingUpdating(true);
    const { error } = await supabase.from("shops").update({ ordering_enabled: value }).eq("id", shop.id);
    setOrderingUpdating(false);
    if (error) { setOrderingEnabled(!value); alert(error.message); }
  }

  async function saveBillTemplate() {
    setBillSaving(true);
    await fetch("/api/bill-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop_id: shop.id,
        shop_address: shopAddress || null,
        shop_phone: shopPhone || null,
        gstin: gstin || null,
        bill_footer: billFooter,
        printer_size: printerSize,
        gst_enabled_by_default: showGst,
        default_gst_percent: gstPercent,
        dineout_charge_label: dineoutLabel,
      }),
    });
    setBillSaving(false);
    setBillSaved(true);
    setTimeout(() => setBillSaved(false), 2500);
  }

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "branding", label: "Branding", icon: "🎨" },
    { key: "ordering", label: "Ordering", icon: "🛒" },
    { key: "bill", label: "Bill Template", icon: "🧾" },
    { key: "social", label: "Social", icon: "🔗" },
  ];

  const billPreviewProps: BillPreviewProps = {
    shopName: name, logoUrl, shopAddress, shopPhone, gstin,
    showAddress, showPhone, showGstin, billFooter,
    printerSize, showGst, gstPercent, showDiscount, showDineout, dineoutLabel,
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Left panel */}
      <div className="flex-1 min-w-0">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Branding tab */}
        {activeTab === "branding" && (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-6 space-y-5">
            <Field label="Shop name">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Cafe" className={inputCls} />
            </Field>
            <Field label="Tagline">
              <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Good food, great vibes" className={inputCls} />
            </Field>
            <Field label="Primary color">
              <div className="flex items-center gap-3">
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-10 h-10 p-0.5 border border-gray-200 rounded-lg cursor-pointer" />
                <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} maxLength={7} className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500" />
              </div>
            </Field>
            <Field label={`Banner height: ${bannerHeight}px`}>
              <input type="range" min={100} max={300} value={bannerHeight} onChange={(e) => setBannerHeight(Number(e.target.value))} className="w-full accent-orange-500" />
              <div className="flex justify-between text-xs text-gray-400 mt-1"><span>100px</span><span>300px</span></div>
            </Field>
            <Field label="Logo">
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "logo"); }} />
              <div className="flex items-center gap-3">
                {logoUrl && <img src={logoUrl} alt="Logo" className="h-12 w-12 rounded-lg border border-gray-100 object-cover" />}
                <button type="button" disabled={logoUploading} onClick={() => logoInputRef.current?.click()} className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 transition-colors">
                  {logoUploading ? "Uploading…" : logoUrl ? "Change Logo" : "Upload Logo"}
                </button>
                {logoUrl && <button type="button" onClick={() => setLogoUrl("")} className="text-xs text-red-400 hover:text-red-600">Remove</button>}
              </div>
            </Field>
            <Field label="Banner image">
              <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "banner"); }} />
              {bannerUrl && <img src={bannerUrl} alt="Banner" className="mb-2 w-full h-24 rounded-lg border border-gray-100 object-cover" />}
              <div className="flex items-center gap-3">
                <button type="button" disabled={bannerUploading} onClick={() => bannerInputRef.current?.click()} className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 transition-colors">
                  {bannerUploading ? "Uploading…" : bannerUrl ? "Change Banner" : "Upload Banner"}
                </button>
                {bannerUrl && <button type="button" onClick={() => setBannerUrl("")} className="text-xs text-red-400 hover:text-red-600">Remove</button>}
              </div>
            </Field>
            {brandingError && <p className="text-xs text-red-500">{brandingError}</p>}
            <div className="pt-1">
              <button onClick={handleSaveBranding} disabled={brandingSaving} className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                {brandingSaving ? "Saving..." : brandingSaved ? "Saved!" : "Save Branding"}
              </button>
            </div>
          </div>
        )}

        {/* Ordering tab */}
        {activeTab === "ordering" && (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Enable online ordering</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Customers can browse your menu and place orders.</p>
              </div>
              <button type="button" disabled={orderingUpdating} onClick={() => handleToggleOrdering(!orderingEnabled)}
                className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-60 ${orderingEnabled ? "bg-orange-500" : "bg-gray-200 dark:bg-gray-700"}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${orderingEnabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          </div>
        )}

        {/* Bill Template tab */}
        {activeTab === "bill" && (
          <div className="space-y-4">
            {/* Printer size */}
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-5">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">Printer Size</p>
              <div className="flex gap-3">
                {(["80mm", "58mm"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setPrinterSize(s)}
                    className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-colors ${printerSize === s ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-600" : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"}`}>
                    {s} {s === "80mm" ? "— Standard" : "— Narrow"}
                  </button>
                ))}
              </div>
            </div>

            {/* Shop details on bill */}
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-5 space-y-4">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Shop Details on Bill</p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Toggle value={showAddress} onChange={setShowAddress} />
                  <div className="flex-1">
                    <p className="text-sm text-gray-700 dark:text-gray-300">Show address</p>
                    {showAddress && <input value={shopAddress} onChange={(e) => setShopAddress(e.target.value)} placeholder="123 Main St, City" className={`mt-1.5 ${inputCls}`} />}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Toggle value={showPhone} onChange={setShowPhone} />
                  <div className="flex-1">
                    <p className="text-sm text-gray-700 dark:text-gray-300">Show phone number</p>
                    {showPhone && <input value={shopPhone} onChange={(e) => setShopPhone(e.target.value)} placeholder="+91 98765 43210" className={`mt-1.5 ${inputCls}`} />}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Toggle value={showGstin} onChange={setShowGstin} />
                  <div className="flex-1">
                    <p className="text-sm text-gray-700 dark:text-gray-300">Show GSTIN</p>
                    {showGstin && <input value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="27AAPFU0939F1ZV" className={`mt-1.5 ${inputCls}`} />}
                  </div>
                </div>
              </div>
            </div>

            {/* Charges preview settings */}
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-5 space-y-4">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Sample Charges (for preview)</p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Toggle value={showDiscount} onChange={setShowDiscount} />
                  <p className="text-sm text-gray-700 dark:text-gray-300">Show discount row in preview</p>
                </div>
                <div className="flex items-center gap-3">
                  <Toggle value={showGst} onChange={setShowGst} />
                  <div className="flex-1">
                    <p className="text-sm text-gray-700 dark:text-gray-300">GST on by default</p>
                    {showGst && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <input type="number" min={0} max={100} value={gstPercent} onChange={(e) => setGstPercent(Number(e.target.value))} className="w-20 px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-center focus:outline-none" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">% default GST</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Toggle value={showDineout} onChange={setShowDineout} />
                  <div className="flex-1">
                    <p className="text-sm text-gray-700 dark:text-gray-300">Show packaging/dineout charge</p>
                    {showDineout && <input value={dineoutLabel} onChange={(e) => setDineoutLabel(e.target.value)} placeholder="Packaging Charges" className={`mt-1.5 ${inputCls}`} />}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-5">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">Bill Footer Message</p>
              <input value={billFooter} onChange={(e) => setBillFooter(e.target.value)} placeholder="Thank you for visiting!" className={inputCls} />
            </div>

            <button onClick={saveBillTemplate} disabled={billSaving} className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
              {billSaving ? "Saving…" : billSaved ? "✓ Saved!" : "Save Bill Template"}
            </button>

            {/* Mobile preview */}
            <div className="lg:hidden bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Receipt Preview</p>
              <div className="overflow-x-auto">
                <ReceiptPreview {...billPreviewProps} />
              </div>
            </div>
          </div>
        )}

        {/* Social tab */}
        {activeTab === "social" && (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">Social links &amp; review prompts — coming soon</p>
          </div>
        )}
      </div>

      {/* Right panel — live preview */}
      <div className="hidden lg:block w-80 shrink-0">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">
          {activeTab === "bill" ? "Receipt Preview" : "Live Preview"}
        </p>

        {activeTab === "bill" ? (
          <div className="flex justify-center">
            <ReceiptPreview {...billPreviewProps} />
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-56 bg-gray-900 rounded-3xl p-2 shadow-xl">
              <div className="bg-white rounded-2xl overflow-hidden">
                <div
                  style={{
                    backgroundColor: primaryColor,
                    backgroundImage: bannerUrl ? `url(${bannerUrl})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    height: `${Math.round((bannerHeight / 300) * 100 + 40)}px`,
                    transition: "height 0.15s, background-color 0.15s",
                  }}
                  className="w-full relative flex items-end px-3 pb-2"
                >
                  {bannerUrl && <div className="absolute inset-0 bg-black/30 rounded-t-2xl" />}
                  {logoUrl && (
                    <img src={logoUrl} alt="Logo" className="relative z-10 h-10 w-10 rounded-full object-cover border-2 border-white shadow" />
                  )}
                </div>
                <div className="px-3 py-2">
                  <p className="text-xs font-bold text-gray-900 truncate">{name || "Shop Name"}</p>
                  {tagline && <p className="text-[10px] text-gray-400 truncate mt-0.5">{tagline}</p>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? "bg-orange-500" : "bg-gray-200 dark:bg-gray-700"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}
