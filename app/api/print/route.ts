import { NextRequest, NextResponse } from "next/server";
import net from "net";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildEscPosBuffer, type ReceiptData } from "@/lib/printer/receipt";

const CONNECT_TIMEOUT_MS = 6000;

// When PRINTER_BRIDGE_URL is set (cloud deployment), forward the job to the
// local print bridge instead of opening a direct TCP socket.
const BRIDGE_URL    = process.env.PRINTER_BRIDGE_URL?.replace(/\/$/, "");
const BRIDGE_SECRET = process.env.PRINTER_BRIDGE_SECRET ?? "";

/** Forward ESC/POS buffer to the local print bridge over HTTP. */
async function sendViaBridge(ip: string, port: number, data: Buffer): Promise<void> {
  const res = await fetch(`${BRIDGE_URL}/print`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(BRIDGE_SECRET ? { "X-Bridge-Secret": BRIDGE_SECRET } : {}),
    },
    body: JSON.stringify({
      printerIp:   ip,
      printerPort: port,
      data: data.toString("base64"),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json() as { ok?: boolean; error?: string };
  if (!json.ok) throw new Error(json.error ?? "Bridge returned failure");
}

/** Raw TCP send to printer IP:port (ESC/POS raw socket). Used when app is on same LAN. */
async function sendDirectTcp(ip: string, port: number, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;

    function done(err?: Error) {
      if (settled) return;
      settled = true;
      socket.destroy();
      err ? reject(err) : resolve();
    }

    socket.setTimeout(CONNECT_TIMEOUT_MS);

    socket.connect(port, ip, () => {
      socket.write(data, (writeErr) => {
        if (writeErr) return done(writeErr);
        socket.end(() => done());
      });
    });

    socket.on("timeout", () => done(new Error("Connection timed out after " + CONNECT_TIMEOUT_MS / 1000 + "s")));
    socket.on("error", (err) => done(err));
  });
}

async function sendToThermalPrinter(ip: string, port: number, data: Buffer): Promise<void> {
  if (BRIDGE_URL) {
    return sendViaBridge(ip, port, data);
  }
  return sendDirectTcp(ip, port, data);
}

// ── POST /api/print ─────────────────────────────────────────────────────────
//
// Body: { shop_id, receipt: ReceiptData }
// Looks up printer config from bill_settings.
// Returns: { ok: true } | { error: string, code: "NO_PRINTER" | "PRINT_FAILED" }
//
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { shop_id: string; receipt: ReceiptData };
  const { shop_id, receipt } = body;
  if (!shop_id) return NextResponse.json({ error: "shop_id required" }, { status: 400 });

  const admin = createAdminClient();

  // Verify caller has access to this shop
  const { data: ownerShop } = await admin.from("shops").select("id").eq("id", shop_id).eq("owner_id", user.id).maybeSingle();
  if (!ownerShop) {
    const { data: staffRow } = await admin.from("shop_staff").select("id").eq("shop_id", shop_id).eq("email", user.email ?? "").eq("is_active", true).maybeSingle();
    if (!staffRow) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch printer config from bill_settings
  const { data: settings } = await admin.from("bill_settings").select("printer_ip, printer_port, printer_enabled, auto_cut, full_cut, paper_width").eq("shop_id", shop_id).maybeSingle();

  if (!settings?.printer_enabled || !settings?.printer_ip) {
    return NextResponse.json({ error: "No thermal printer configured for this shop", code: "NO_PRINTER" }, { status: 200 });
  }

  const ip   = String(settings.printer_ip).trim();
  const port = Number(settings.printer_port ?? 9100);

  // Merge paper width and cut settings from DB into receipt data
  const receiptWithConfig: ReceiptData = {
    ...receipt,
    paperWidth: (settings.paper_width as "80mm" | "58mm") ?? "80mm",
    autoCut:    settings.auto_cut   !== false,
    fullCut:    settings.full_cut   === true,
  };

  let printBuffer: Buffer;
  try {
    printBuffer = buildEscPosBuffer(receiptWithConfig);
  } catch (err) {
    return NextResponse.json({ error: "Receipt formatting failed: " + String(err) }, { status: 500 });
  }

  try {
    await sendToThermalPrinter(ip, port, printBuffer);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg, code: "PRINT_FAILED" }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}

// ── GET /api/print?shop_id=xxx ───────────────────────────────────────────────
// Test the printer connection. Returns { ok: true } or { error, code }
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const shopId = request.nextUrl.searchParams.get("shop_id");
  if (!shopId) return NextResponse.json({ error: "shop_id required" }, { status: 400 });

  const admin = createAdminClient();

  const { data: ownerShop } = await admin.from("shops").select("id").eq("id", shopId).eq("owner_id", user.id).maybeSingle();
  if (!ownerShop) {
    const { data: staffRow } = await admin.from("shop_staff").select("id").eq("shop_id", shopId).eq("email", user.email ?? "").eq("is_active", true).maybeSingle();
    if (!staffRow) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: settings } = await admin.from("bill_settings").select("printer_ip, printer_port, printer_enabled").eq("shop_id", shopId).maybeSingle();

  if (!settings?.printer_ip) {
    return NextResponse.json({ error: "No printer IP configured", code: "NO_PRINTER" }, { status: 200 });
  }

  const ip   = String(settings.printer_ip).trim();
  const port = Number(settings.printer_port ?? 9100);

  // Send a minimal ESC/POS: just initialize + feed + cut (prints a short blank receipt)
  const testBuf = Buffer.from("\x1B@\x1Bd\x03\x1DV\x01", "binary");

  try {
    await sendToThermalPrinter(ip, port, testBuf);
    return NextResponse.json({ ok: true, ip, port });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg, code: "PRINT_FAILED", ip, port }, { status: 200 });
  }
}
