import {
  INIT, LF, ALIGN_LEFT, ALIGN_CENTER, BOLD_ON, BOLD_OFF,
  TEXT_NORMAL, TEXT_DOUBLE_HEIGHT, TEXT_DOUBLE,
  CUT_PARTIAL, CUT_FULL, feedAndCut,
  padRight, padLeft, center, twoCol, sep,
} from "./escpos";

export type ReceiptItem = {
  name: string;
  quantity: number;
  unit_price: number;
};

export type ReceiptData = {
  shopName: string;
  tagline?: string | null;
  address?: string | null;
  phone?: string | null;
  gstin?: string | null;
  billNo: string;
  date: string;
  time: string;
  customerName?: string | null;
  customerPhone?: string | null;
  orderType?: string | null;
  items: ReceiptItem[];
  subtotal: number;
  discountPercent?: number;
  discountAmount?: number;
  gstPercent?: number;
  gstAmount?: number;
  extraChargeLabel?: string | null;
  extraChargeAmount?: number;
  total: number;
  footer?: string | null;
  currencySymbol?: string;
  autoCut?: boolean;
  fullCut?: boolean;
  paperWidth?: "80mm" | "58mm";
};

// Characters per line for each paper width (at standard font density)
const COLS: Record<"80mm" | "58mm", number> = { "80mm": 48, "58mm": 32 };

export function buildEscPosBuffer(data: ReceiptData): Buffer {
  const pw   = data.paperWidth ?? "80mm";
  const cols = COLS[pw];
  const sym  = data.currencySymbol ?? "₹";

  function fmt(n: number): string { return sym + n.toFixed(2); }
  function ln(s = ""): string { return s + LF; }
  function THICK(): string { return ln(sep(cols, "=")) }
  function THIN(): string  { return ln(sep(cols, "-")) }

  const parts: string[] = [];

  // ── Initialize ──────────────────────────────────────────────────────────
  parts.push(INIT);

  // ── Header: shop name ───────────────────────────────────────────────────
  parts.push(ALIGN_CENTER);
  parts.push(BOLD_ON);
  parts.push(TEXT_DOUBLE_HEIGHT);
  parts.push(ln(data.shopName.toUpperCase()));
  parts.push(TEXT_NORMAL);
  parts.push(BOLD_OFF);

  if (data.tagline) parts.push(ln(data.tagline));
  if (data.address) parts.push(ln(data.address));
  if (data.phone)   parts.push(ln("Tel: " + data.phone));
  if (data.gstin)   parts.push(ln("GSTIN: " + data.gstin));

  parts.push(THICK());

  // ── Bill meta ───────────────────────────────────────────────────────────
  parts.push(ALIGN_LEFT);
  parts.push(ln(twoCol("Bill No: " + data.billNo, "Date: " + data.date, cols)));
  parts.push(ln(twoCol("", "Time: " + data.time, cols)));
  if (data.customerName)  parts.push(ln("Customer : " + data.customerName));
  if (data.customerPhone) parts.push(ln("Phone    : " + data.customerPhone));
  if (data.orderType)     parts.push(ln("Type     : " + (data.orderType === "takeaway" ? "Takeaway" : "Dine In")));

  parts.push(THIN());

  // ── Items header ────────────────────────────────────────────────────────
  const nameW = cols - 11;  // qty(4) + space(1) + amount(9) + space(1) = 15
  parts.push(BOLD_ON);
  parts.push(ln(padRight("ITEM", nameW) + padLeft("QTY", 4) + padLeft("AMOUNT", 9)));
  parts.push(BOLD_OFF);
  parts.push(THIN());

  // ── Items ────────────────────────────────────────────────────────────────
  for (const item of data.items) {
    const totalAmt = item.unit_price * item.quantity;
    const firstLine = padRight(item.name, nameW) + padLeft(String(item.quantity), 4) + padLeft(fmt(totalAmt), 9);
    parts.push(ln(firstLine));
  }

  parts.push(THIN());

  // ── Charges ──────────────────────────────────────────────────────────────
  parts.push(ln(twoCol("Subtotal", fmt(data.subtotal), cols)));

  if (data.discountAmount && data.discountAmount > 0) {
    const label = "Discount" + (data.discountPercent ? ` (${data.discountPercent}%)` : "");
    parts.push(ln(twoCol(label, "-" + fmt(data.discountAmount), cols)));
  }
  if (data.gstAmount && data.gstAmount > 0) {
    const label = "GST" + (data.gstPercent ? ` (${data.gstPercent}%)` : "");
    parts.push(ln(twoCol(label, fmt(data.gstAmount), cols)));
  }
  if (data.extraChargeAmount && data.extraChargeAmount > 0) {
    parts.push(ln(twoCol(data.extraChargeLabel ?? "Charges", fmt(data.extraChargeAmount), cols)));
  }

  parts.push(THICK());

  // ── Total ────────────────────────────────────────────────────────────────
  parts.push(BOLD_ON);
  parts.push(TEXT_DOUBLE);
  // At double-width: each char takes 2 columns, so effective cols = cols/2
  const halfCols = Math.floor(cols / 2);
  parts.push(ALIGN_LEFT);
  parts.push(ln(twoCol("TOTAL", fmt(data.total), halfCols)));
  parts.push(TEXT_NORMAL);
  parts.push(BOLD_OFF);

  parts.push(THICK());

  // ── Footer ───────────────────────────────────────────────────────────────
  parts.push(ALIGN_CENTER);
  parts.push(ln(data.footer ?? "Thank you for visiting!"));
  parts.push(ln("Powered by ZenZ"));
  parts.push(LF + LF);

  // ── Cut ──────────────────────────────────────────────────────────────────
  if (data.autoCut !== false) {
    parts.push(feedAndCut(4, data.fullCut ?? false));
  }

  return Buffer.from(parts.join(""), "binary");
}
