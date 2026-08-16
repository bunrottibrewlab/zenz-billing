"use client";

import { useState } from "react";

type OrderItem = { id: string; name: string; price: number; quantity: number };
type BillSettings = {
  shop_address?: string | null;
  shop_phone?: string | null;
  gstin?: string | null;
  default_gst_percent?: number;
  gst_enabled_by_default?: boolean;
  default_dineout_charge_percent?: number;
  dineout_charge_label?: string | null;
  bill_footer?: string | null;
  printer_size?: "80mm" | "58mm" | null;
  printer_enabled?: boolean | null;
  printer_ip?: string | null;
};

type Order = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  order_type: string | null;
  notes: string | null;
  created_at: string;
  subtotal: number;
};

const CURRENCY_SYMBOL: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "د.إ" };

export function BillModal({
  order,
  items,
  shopName,
  shopTagline,
  logoUrl,
  currency,
  billSettings,
  shopId,
  onClose,
  onBilled,
}: {
  order: Order;
  items: OrderItem[];
  shopName: string;
  shopTagline?: string | null;
  logoUrl?: string | null;
  currency: string;
  billSettings: BillSettings;
  shopId?: string;
  onClose: () => void;
  onBilled: () => void;
}) {
  const symbol = CURRENCY_SYMBOL[currency] ?? "₹";

  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [gstEnabled, setGstEnabled] = useState(billSettings.gst_enabled_by_default ?? false);
  const [gstPercent, setGstPercent] = useState(billSettings.default_gst_percent ?? 5);
  const [dineoutEnabled, setDineoutEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [printStatus, setPrintStatus] = useState<"idle" | "printing" | "ok" | "error">("idle");
  const [printError, setPrintError] = useState<string | null>(null);

  const subtotal = order.subtotal || items.reduce((s, i) => s + i.price * i.quantity, 0);
  // Seed flat dineout amount from the shop's default percent × subtotal
  const [dineoutAmount, setDineoutAmount] = useState(() => {
    const pct = billSettings.default_dineout_charge_percent ?? 0;
    return pct > 0 ? Math.round(subtotal * pct) / 100 : 0;
  });
  const discountAmt = discountEnabled ? Math.round(subtotal * discountPercent) / 100 : 0;
  const afterDiscount = subtotal - discountAmt;
  const gstAmt = gstEnabled ? Math.round(afterDiscount * gstPercent) / 100 : 0;
  const dineoutAmt = dineoutEnabled ? dineoutAmount : 0;
  const grandTotal = afterDiscount + gstAmt + dineoutAmt;

  const dineoutLabel = billSettings.dineout_charge_label ?? "Packaging Charges";

  const billDate = new Date(order.created_at).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  function buildReceiptHTML(): string {
    const is58 = (billSettings.printer_size ?? "80mm") === "58mm";
    const pageWidth = is58 ? "58mm" : "80mm";
    const bodyWidth = is58 ? "50mm" : "72mm";
    const baseFontSize = is58 ? 9 : 11;
    const fmt = (n: number) => `${symbol}${n.toFixed(2)}`;

    const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const logoEl = logoUrl
      ? `<div style="display:flex;justify-content:center;margin-bottom:6px"><img src="${logoUrl}" style="height:52px;width:52px;border-radius:50%;object-fit:cover;display:block" /></div>`
      : "";

    const shopInfo = [
      shopTagline ? `<div class="sub">${escHtml(shopTagline)}</div>` : "",
      billSettings.shop_address ? `<div class="sub">${escHtml(billSettings.shop_address)}</div>` : "",
      billSettings.shop_phone ? `<div class="sub">Ph: ${escHtml(billSettings.shop_phone)}</div>` : "",
      gstEnabled && billSettings.gstin ? `<div class="sub">GSTIN: ${escHtml(billSettings.gstin)}</div>` : "",
    ].join("");

    const billNo = "ORD-" + order.id.replace(/-/g, "").toUpperCase().slice(0, 16);

    const itemRows = items.map((item) => {
      const n = escHtml(item.name.length > (is58 ? 16 : 22) ? item.name.slice(0, is58 ? 15 : 21) + "…" : item.name);
      return `
        <tr>
          <td class="td-name">${n}</td>
          <td class="td-qty">${item.quantity}</td>
          <td class="td-amt">${fmt(item.price * item.quantity)}</td>
        </tr>`;
    }).join("");

    const chargeRows = [
      `<tr><td colspan="2" class="ch-label">Subtotal</td><td class="ch-val">${fmt(subtotal)}</td></tr>`,
      discountEnabled && discountAmt > 0
        ? `<tr><td colspan="2" class="ch-label">Discount (${discountPercent}%)</td><td class="ch-val">-${fmt(discountAmt)}</td></tr>` : "",
      gstEnabled && gstAmt > 0
        ? `<tr><td colspan="2" class="ch-label">GST (${gstPercent}%)</td><td class="ch-val">${fmt(gstAmt)}</td></tr>` : "",
      dineoutEnabled && dineoutAmt > 0
        ? `<tr><td colspan="2" class="ch-label">${escHtml(dineoutLabel)}</td><td class="ch-val">${fmt(dineoutAmt)}</td></tr>` : "",
    ].join("");

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Tax Invoice</title>
<style>
  @page { size: ${pageWidth} auto; margin: 4mm 3mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: ${baseFontSize}px;
    line-height: 1.45;
    width: ${bodyWidth};
    margin: 0 auto;
    color: #000;
  }
  .header { text-align: center; padding-bottom: 4px; }
  .shop-name { font-size: ${baseFontSize + 3}px; font-weight: 900; letter-spacing: 0.5px; }
  .sub { font-size: ${baseFontSize - 1}px; color: #333; }
  .invoice-title {
    text-align: center;
    font-size: ${baseFontSize + 1}px;
    font-weight: bold;
    letter-spacing: 2px;
    border-top: 2px solid #000;
    border-bottom: 2px solid #000;
    padding: 3px 0;
    margin: 5px 0;
  }
  .meta { font-size: ${baseFontSize - 1}px; margin-bottom: 4px; }
  .meta-row { display: flex; justify-content: space-between; }
  .sep { border: none; border-top: 1px dashed #555; margin: 4px 0; }
  .sep-solid { border: none; border-top: 1.5px solid #000; margin: 4px 0; }
  /* Items table */
  .items { width: 100%; border-collapse: collapse; font-size: ${baseFontSize}px; }
  .th { font-weight: bold; border-bottom: 1px solid #000; border-top: 1px solid #000; padding: 3px 0; }
  .td-name { width: 60%; padding: 2px 0; vertical-align: top; }
  .td-qty  { width: 10%; text-align: center; padding: 2px 2px; vertical-align: top; }
  .td-amt  { width: 30%; text-align: right; padding: 2px 0; vertical-align: top; }
  /* Charges table */
  .charges { width: 100%; border-collapse: collapse; font-size: ${baseFontSize}px; margin-top: 2px; }
  .ch-label { padding: 1.5px 0; }
  .ch-val { text-align: right; padding: 1.5px 0; }
  /* Total */
  .total-row { border-top: 2px solid #000; border-bottom: 2px solid #000; margin: 4px 0; }
  .total-inner { display: flex; justify-content: space-between; padding: 3px 0; font-weight: 900; font-size: ${baseFontSize + 3}px; }
  /* Footer */
  .footer { text-align: center; margin-top: 6px; font-size: ${baseFontSize - 1}px; }
  .powered { text-align: center; font-size: ${baseFontSize - 2}px; color: #888; margin-top: 2px; }
</style>
</head>
<body>

${logoEl}
<div class="header">
  <div class="shop-name">${escHtml(shopName)}</div>
  ${shopInfo}
</div>

<div class="invoice-title">TAX INVOICE</div>

<div class="meta">
  <div class="meta-row"><span>Bill No.</span><span>${billNo}</span></div>
  <div class="meta-row"><span>Date</span><span>${billDate}</span></div>
  ${order.customer_name ? `<div class="meta-row"><span>Customer</span><span>${escHtml(order.customer_name)}</span></div>` : ""}
  ${order.customer_phone ? `<div class="meta-row"><span>Phone</span><span>${escHtml(order.customer_phone)}</span></div>` : ""}
  <div class="meta-row"><span>Type</span><span>${order.order_type === "takeaway" ? "Takeaway" : "Dine In"}</span></div>
</div>

<table class="items">
  <thead>
    <tr class="th">
      <td class="td-name">ITEM</td>
      <td class="td-qty">QTY</td>
      <td class="td-amt">AMOUNT</td>
    </tr>
  </thead>
  <tbody>
    ${itemRows}
  </tbody>
</table>

<hr class="sep">

<table class="charges">
  ${chargeRows}
</table>

<div class="total-row">
  <div class="total-inner">
    <span>TOTAL</span>
    <span>${fmt(grandTotal)}</span>
  </div>
</div>

<div class="footer">${escHtml(billSettings.bill_footer ?? "Thank you for visiting!")}</div>
<div class="powered">Powered by ZenZ</div>

</body>
</html>`;
  }

  async function handlePrintAndClose() {
    setSaving(true);
    setPrintStatus("idle");
    setPrintError(null);

    // ── 1. Save the bill ──────────────────────────────────────────────────
    try {
      const res = await fetch("/api/orders/bill", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.id,
          discount_percent: discountEnabled ? discountPercent : 0,
          discount_amount: discountAmt,
          gst_percent: gstEnabled ? gstPercent : 0,
          gst_amount: gstAmt,
          dineout_charge_percent: dineoutEnabled ? (billSettings.default_dineout_charge_percent ?? 0) : 0,
          dineout_charge_amount: dineoutAmt,
          total: grandTotal,
          is_billed: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert("Failed to save bill: " + (err.error ?? res.statusText));
        setSaving(false);
        return;
      }
    } catch {
      alert("Network error — bill was not saved. Please try again.");
      setSaving(false);
      return;
    }
    setSaving(false);

    // ── 2. Try direct thermal printing ───────────────────────────────────
    const thermalConfigured = billSettings.printer_enabled && billSettings.printer_ip && shopId;

    if (thermalConfigured) {
      setPrintStatus("printing");

      const billNo = "ORD-" + order.id.replace(/-/g, "").toUpperCase().slice(0, 16);
      const billDate = new Date(order.created_at);
      const dateStr  = billDate.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
      const timeStr  = billDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

      const receipt = {
        shopName,
        tagline: shopTagline,
        address: billSettings.shop_address,
        phone:   billSettings.shop_phone,
        gstin:   gstEnabled ? (billSettings.gstin ?? null) : null,
        billNo, date: dateStr, time: timeStr,
        customerName:  order.customer_name,
        customerPhone: order.customer_phone,
        orderType:     order.order_type,
        items: items.map((i) => ({ name: i.name, quantity: i.quantity, unit_price: i.price })),
        subtotal,
        discountPercent: discountEnabled ? discountPercent : 0,
        discountAmount:  discountAmt,
        gstPercent:      gstEnabled ? gstPercent : 0,
        gstAmount:       gstAmt,
        extraChargeLabel:  dineoutEnabled ? dineoutLabel : null,
        extraChargeAmount: dineoutAmt,
        total: grandTotal,
        footer: billSettings.bill_footer,
        currencySymbol: symbol,
      };

      try {
        const pRes = await fetch("/api/print", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shop_id: shopId, receipt }),
        });
        const pData = await pRes.json();

        if (pData.ok) {
          setPrintStatus("ok");
          setTimeout(() => onBilled(), 1200);
          return;
        }

        if (pData.code === "NO_PRINTER") {
          // Printer not configured server-side — fall through to browser print
        } else {
          // Thermal print failed — show error, let user retry or use browser print
          setPrintStatus("error");
          setPrintError(pData.error ?? "Printer connection failed");
          return;
        }
      } catch {
        setPrintStatus("error");
        setPrintError("Network error reaching print service");
        return;
      }
    }

    // ── 3. Fallback: browser/OS print dialog ─────────────────────────────
    const receiptHtml = buildReceiptHTML();
    const styleContent = receiptHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1] ?? "";
    const bodyContent  = receiptHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? "";

    const printStyle = document.createElement("style");
    printStyle.id = "__zenz_print_style";
    printStyle.textContent = `
      @media print {
        body > *:not(#__zenz_receipt) { display: none !important; visibility: hidden; }
        #__zenz_receipt { display: block !important; visibility: visible; position: fixed; top: 0; left: 0; width: 100%; }
      }
      ${styleContent}
    `;
    const container = document.createElement("div");
    container.id = "__zenz_receipt";
    container.style.cssText = "display:none;";
    container.innerHTML = bodyContent;
    document.head.appendChild(printStyle);
    document.body.appendChild(container);
    const cleanup = () => {
      document.getElementById("__zenz_print_style")?.remove();
      document.getElementById("__zenz_receipt")?.remove();
    };
    window.onafterprint = cleanup;
    window.print();
    onBilled();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-gray-900">Generate Bill</h2>
          <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Items */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Items</p>
            <div className="space-y-1.5">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-700">{item.name} × {item.quantity}</span>
                  <span className="font-medium">{symbol}{(item.price * item.quantity).toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-dashed border-gray-200 mt-2 pt-2 flex justify-between text-sm font-semibold">
              <span>Subtotal</span>
              <span>{symbol}{subtotal.toLocaleString("en-IN")}</span>
            </div>
          </div>

          {/* Discount */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">Discount</p>
              <Toggle value={discountEnabled} onChange={setDiscountEnabled} />
            </div>
            {discountEnabled && (
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} max={100} value={discountPercent}
                  onChange={(e) => setDiscountPercent(Number(e.target.value))}
                  className="w-20 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <span className="text-sm text-gray-500">% off</span>
                <span className="ml-auto text-sm font-medium text-green-600">
                  −{symbol}{discountAmt.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* GST */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">GST</p>
              <Toggle value={gstEnabled} onChange={setGstEnabled} />
            </div>
            {gstEnabled && (
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} max={100} value={gstPercent}
                  onChange={(e) => setGstPercent(Number(e.target.value))}
                  className="w-20 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <span className="text-sm text-gray-500">% GST</span>
                <span className="ml-auto text-sm font-medium text-gray-700">
                  +{symbol}{gstAmt.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Dine-out / Packaging charges */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">{dineoutLabel}</p>
              <Toggle value={dineoutEnabled} onChange={setDineoutEnabled} />
            </div>
            {dineoutEnabled && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">{symbol}</span>
                <input
                  type="number" min={0} value={dineoutAmount}
                  onChange={(e) => setDineoutAmount(Number(e.target.value))}
                  className="w-24 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <span className="ml-auto text-sm font-medium text-gray-700">
                  +{symbol}{dineoutAmt.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Grand total */}
          <div className="bg-orange-50 rounded-xl px-4 py-3 flex justify-between items-center">
            <span className="font-bold text-gray-800">Grand Total</span>
            <span className="text-xl font-bold text-orange-600">
              {symbol}{grandTotal.toFixed(2)}
            </span>
          </div>

          {/* Actions */}
          <div className="pt-1 space-y-2">
            {/* Thermal print status */}
            {printStatus === "printing" && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 text-sm text-blue-700">
                <svg className="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                Sending to thermal printer…
              </div>
            )}
            {printStatus === "ok" && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 text-sm text-green-700 font-medium">
                ✓ Receipt printed successfully
              </div>
            )}
            {printStatus === "error" && (
              <div className="space-y-2">
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-sm text-red-700">
                  <span className="shrink-0 mt-0.5">✗</span>
                  <div>
                    <p className="font-medium">Printer error</p>
                    <p className="text-xs mt-0.5 opacity-80">{printError}</p>
                    <p className="text-xs mt-1 opacity-70">Check the printer is on and connected to Wi-Fi.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handlePrintAndClose}
                    className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 rounded-xl text-sm font-semibold text-white transition-colors"
                  >
                    Retry Print
                  </button>
                </div>
              </div>
            )}
            {printStatus !== "printing" && printStatus !== "ok" && (
              <button
                onClick={handlePrintAndClose}
                disabled={saving}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 rounded-xl text-sm font-semibold text-white transition-colors"
              >
                {saving ? "Saving…" : billSettings.printer_enabled && billSettings.printer_ip ? "🖨 Print Bill & Close (Thermal)" : "🖨 Print Bill & Close"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? "bg-orange-500" : "bg-gray-200"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}
