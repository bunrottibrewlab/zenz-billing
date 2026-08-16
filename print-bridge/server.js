/**
 * ZenZ Local Print Bridge
 * ========================
 * Runs on the café's local machine (Windows/Mac/Linux).
 * Receives ESC/POS print jobs from the cloud (Zoho Catalyst)
 * and sends them directly to the thermal printer via TCP.
 *
 * Start:  node server.js
 * Config: set env vars or edit the defaults below.
 */

const http = require("http");
const net  = require("net");

// ── Config (override with environment variables) ──────────────────────────
const BRIDGE_PORT      = Number(process.env.BRIDGE_PORT   ?? 7777);
const BRIDGE_SECRET    = process.env.BRIDGE_SECRET        ?? "";   // shared secret (set in Catalyst env too)
const DEFAULT_PRINTER_IP   = process.env.PRINTER_IP       ?? "192.168.1.100";
const DEFAULT_PRINTER_PORT = Number(process.env.PRINTER_PORT ?? 9100);
const CONNECT_TIMEOUT  = 6000; // ms

// ── Helpers ───────────────────────────────────────────────────────────────
function sendToThermal(ip, port, base64Data) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let done = false;

    function finish(err) {
      if (done) return;
      done = true;
      socket.destroy();
      err ? reject(err) : resolve();
    }

    socket.setTimeout(CONNECT_TIMEOUT);
    socket.connect(port, ip, () => {
      const buf = Buffer.from(base64Data, "base64");
      socket.write(buf, (err) => {
        if (err) return finish(err);
        socket.end(() => finish());
      });
    });
    socket.on("timeout", () => finish(new Error("Timed out connecting to printer")));
    socket.on("error",   (err) => finish(err));
  });
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(body));
}

// ── HTTP Server ───────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  // CORS pre-flight
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, X-Bridge-Secret", "Access-Control-Allow-Methods": "POST, GET" });
    return res.end();
  }

  // Simple secret check (prevents random internet traffic from printing)
  if (BRIDGE_SECRET && req.headers["x-bridge-secret"] !== BRIDGE_SECRET) {
    return json(res, 401, { error: "Unauthorized" });
  }

  // GET /health — liveness check
  if (req.method === "GET" && req.url === "/health") {
    return json(res, 200, { ok: true, printerIp: DEFAULT_PRINTER_IP, port: DEFAULT_PRINTER_PORT });
  }

  // POST /print — receive and forward print job
  if (req.method === "POST" && req.url === "/print") {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", async () => {
      let payload;
      try { payload = JSON.parse(body); } catch { return json(res, 400, { error: "Invalid JSON" }); }

      const ip   = payload.printerIp   ?? DEFAULT_PRINTER_IP;
      const port = Number(payload.printerPort ?? DEFAULT_PRINTER_PORT);
      const data = payload.data; // base64-encoded ESC/POS buffer

      if (!data) return json(res, 400, { error: "Missing data field (base64 ESC/POS buffer)" });

      try {
        await sendToThermal(ip, port, data);
        return json(res, 200, { ok: true });
      } catch (err) {
        console.error("[print-bridge] Print failed:", err.message);
        return json(res, 200, { error: err.message, code: "PRINT_FAILED" });
      }
    });
    return;
  }

  json(res, 404, { error: "Not found" });
});

server.listen(BRIDGE_PORT, "0.0.0.0", () => {
  console.log(`\n🖨  ZenZ Print Bridge running on port ${BRIDGE_PORT}`);
  console.log(`   Default printer: ${DEFAULT_PRINTER_IP}:${DEFAULT_PRINTER_PORT}`);
  if (BRIDGE_SECRET) {
    console.log(`   Secret header:  X-Bridge-Secret: ${BRIDGE_SECRET.slice(0, 4)}***`);
  } else {
    console.log(`   ⚠  No BRIDGE_SECRET set — anyone on the network can send print jobs`);
  }
  console.log(`\n   Set PRINTER_BRIDGE_URL=${getLocalIp()}:${BRIDGE_PORT} in Zoho Catalyst env vars\n`);
});

function getLocalIp() {
  try {
    const os = require("os");
    const ifaces = Object.values(os.networkInterfaces()).flat();
    const iface  = ifaces.find((i) => !i.internal && i.family === "IPv4");
    return iface ? `http://${iface.address}` : "http://<your-local-ip>";
  } catch { return "http://<your-local-ip>"; }
}
