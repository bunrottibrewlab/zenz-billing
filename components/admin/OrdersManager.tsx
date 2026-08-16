"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { BillModal } from "./BillModal";

type OrderItem = { id: string; name: string; price: number; quantity: number };
type MenuItem = { id: string; name: string; price: number; category_id: string; is_available: boolean };
type MenuCategory = { id: string; name: string };
type Order = {
  id: string;
  status: string;
  order_type: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  subtotal: number;
  total: number;
  is_billed: boolean;
  created_at: string;
  user_id: string | null;
};
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

const STATUS_ORDER = ["pending", "preparing", "ready", "completed"];

const STATUS_CONFIG: Record<string, { label: string; icon: string; pill: string; dot: string }> = {
  pending:   { label: "Pending",   icon: "🕐", pill: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",  dot: "bg-amber-400" },
  preparing: { label: "Preparing", icon: "👨‍🍳", pill: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",    dot: "bg-blue-400" },
  ready:     { label: "Ready",     icon: "✅", pill: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",  dot: "bg-green-400" },
  completed: { label: "Completed", icon: "🎉", pill: "bg-gray-100 text-gray-500 dark:bg-gray-700/60 dark:text-gray-400",      dot: "bg-gray-400" },
  cancelled: { label: "Cancelled", icon: "❌", pill: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",          dot: "bg-red-400" },
};

const NEXT_STATUS: Record<string, string> = { pending: "preparing", preparing: "ready", ready: "completed" };
const NEXT_LABEL:  Record<string, string> = { pending: "Mark Preparing", preparing: "Mark Ready", ready: "Complete" };
const CANCELLABLE = new Set(["pending", "preparing", "ready"]);

const CURRENCY_SYMBOL: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "د.إ" };

const TABS = [
  { key: "pending",   label: "Pending",   icon: "🕐" },
  { key: "preparing", label: "Preparing", icon: "👨‍🍳" },
  { key: "ready",     label: "Ready",     icon: "✅" },
  { key: "completed", label: "Done",      icon: "🎉" },
  { key: "cancelled", label: "Cancelled", icon: "❌" },
  { key: "all",       label: "All",       icon: "📋" },
];

export function OrdersManager({
  shopId, shopName, shopTagline, logoUrl, currency, billSettings,
}: {
  shopId: string;
  shopName: string;
  shopTagline?: string | null;
  logoUrl?: string | null;
  currency: string;
  billSettings: BillSettings;
}) {
  const supabase = createClient();
  const symbol = CURRENCY_SYMBOL[currency] ?? "₹";

  const [orders, setOrders]         = useState<Order[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [loadingItems, setLoadingItems] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [billingOrder, setBillingOrder] = useState<Order | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<Order | null>(null);
  const [activeTab, setActiveTab]   = useState("pending");
  const [loading, setLoading]       = useState(true);

  // New order modal state
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [newOrderStep, setNewOrderStep] = useState<"type" | "items">("type");
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [newOrderType, setNewOrderType] = useState<"dine_in" | "takeaway">("dine_in");
  const [newCart, setNewCart] = useState<Record<string, number>>({});
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [stampingId, setStampingId] = useState<string | null>(null);
  const [stampedIds, setStampedIds] = useState<Set<string>>(new Set());
  const [stampError, setStampError] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
    const channel = supabase
      .channel(`orders-${shopId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `shop_id=eq.${shopId}` },
        (payload) => {
          if (payload.eventType === "INSERT") setOrders((p) => [payload.new as Order, ...p]);
          else if (payload.eventType === "UPDATE") setOrders((p) => p.map((o) => o.id === payload.new.id ? payload.new as Order : o));
          else if (payload.eventType === "DELETE") setOrders((p) => p.filter((o) => o.id !== payload.old.id));
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [shopId]);

  async function loadOrders() {
    setLoading(true);
    const res = await fetch(`/api/admin/orders?shop_id=${shopId}`);
    const json = await res.json();
    const orders = (json.orders as Order[]) ?? [];
    setOrders(orders);

    // Pre-mark orders that already have a stamp event
    const orderIds = orders.filter((o) => o.user_id && o.status === "completed").map((o) => o.id);
    if (orderIds.length > 0) {
      const { data: events } = await supabase
        .from("loyalty_stamp_events")
        .select("order_id")
        .in("order_id", orderIds);
      if (events?.length) {
        setStampedIds(new Set(events.map((e: { order_id: string }) => e.order_id)));
      }
    }
    setLoading(false);
  }

  async function loadItems(orderId: string) {
    if (orderItems[orderId]) return;
    setLoadingItems(orderId);
    const res = await fetch(`/api/admin/orders/items?order_id=${orderId}`);
    const json = await res.json();
    setOrderItems((p) => ({ ...p, [orderId]: (json.items as OrderItem[]) ?? [] }));
    setLoadingItems(null);
  }

  async function updateStatus(order: Order) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setUpdatingId(order.id);
    setOrders((p) => p.map((o) => o.id === order.id ? { ...o, status: next } : o));
    await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: order.id, shop_id: shopId, status: next }),
    });
    setUpdatingId(null);
  }

  async function cancelOrder(order: Order) {
    setCancelConfirm(null);
    setUpdatingId(order.id);
    setOrders((p) => p.map((o) => o.id === order.id ? { ...o, status: "cancelled" } : o));
    await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: order.id, shop_id: shopId, status: "cancelled" }),
    });
    // Revert loyalty stamps if any were awarded for this order
    fetch("/api/loyalty/revert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_id: order.id, shop_id: shopId }) }).catch(() => {});
    setUpdatingId(null);
  }

  async function awardStamp(order: Order) {
    if (!order.user_id) return;
    setStampingId(order.id);
    setStampError(null);
    const res = await fetch("/api/loyalty/card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop_id: shopId, order_id: order.id, user_id: order.user_id }),
    });
    const data = await res.json();
    if (data?.ok || data?.reason === "already_awarded") {
      setStampedIds((prev) => new Set(prev).add(order.id));
    } else if (data?.message) {
      setStampError(data.message);
    }
    setStampingId(null);
  }

  async function openNewOrder() {
    setNewOrderOpen(true);
    setNewOrderStep("type");
    setNewCart({});
    setNewOrderType("dine_in");
    setMenuLoading(true);
    const [{ data: cats }, { data: items }] = await Promise.all([
      supabase.from("categories").select("id, name").eq("shop_id", shopId).order("sort_order"),
      supabase.from("products").select("id, name, price, category_id, is_available").eq("shop_id", shopId).eq("is_available", true).order("sort_order"),
    ]);
    setMenuCategories((cats as MenuCategory[]) ?? []);
    setMenuItems((items as MenuItem[]) ?? []);
    setMenuLoading(false);
  }

  async function chooseOrderType(type: "dine_in" | "takeaway") {
    setNewOrderType(type);
    setSelectedCategoryId(null);
    setItemSearch("");
    setNewOrderStep("items");
  }

  function cartAdd(itemId: string) {
    setNewCart((p) => ({ ...p, [itemId]: (p[itemId] ?? 0) + 1 }));
  }
  function cartSub(itemId: string) {
    setNewCart((p) => {
      const next = { ...p };
      if ((next[itemId] ?? 0) <= 1) delete next[itemId];
      else next[itemId]--;
      return next;
    });
  }

  async function submitNewOrder(billAfterOrder = false) {
    const cartItems = menuItems.filter((m) => (newCart[m.id] ?? 0) > 0);
    if (cartItems.length === 0) return;
    setSubmittingOrder(true);

    const items = cartItems.map((m) => ({
      product_id: m.id,
      name: m.name,
      price: m.price,
      quantity: newCart[m.id],
    }));

    const res = await fetch("/api/admin/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop_id: shopId, order_type: newOrderType, items }),
    });
    const json = await res.json();

    if (!res.ok || !json.order) {
      alert("Failed to place order: " + (json.error ?? "Unknown error"));
      setSubmittingOrder(false);
      return;
    }

    const order = json.order as Order;

    // Cache items locally for instant bill modal
    const localItems = cartItems.map((m) => ({
      id: `tmp-${m.id}`,
      name: m.name,
      price: m.price,
      quantity: newCart[m.id],
    }));
    setOrderItems((p) => ({ ...p, [order.id]: localItems }));

    setSubmittingOrder(false);
    setNewOrderOpen(false);
    setActiveTab("pending");
    if (billAfterOrder) setBillingOrder(order);
  }

  function toggleExpand(orderId: string) {
    if (expandedId === orderId) { setExpandedId(null); return; }
    setExpandedId(orderId);
    loadItems(orderId);
  }

  function timeAgo(dateStr: string) {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
  }

  const tabCounts = Object.fromEntries(
    TABS.map(({ key }) => [key, key === "all" ? orders.length : orders.filter((o) => o.status === key).length])
  );
  const filtered = activeTab === "all" ? orders : orders.filter((o) => o.status === activeTab);

  return (
    <div className="bg-gray-50 dark:bg-gray-950 transition-colors">
      <div className="max-w-4xl mx-auto p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Orders</h1>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{shopName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadOrders}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-colors"
            >
              <span className="text-base">↻</span> Refresh
            </button>
            <button
              onClick={openNewOrder}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-colors shadow-sm"
            >
              + New Order
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 scrollbar-hide">
          {TABS.map(({ key, label, icon }) => {
            const count = tabCounts[key];
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                  active
                    ? "bg-orange-500 text-white shadow-sm"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-700"
                }`}
              >
                <span>{icon}</span>
                {label}
                {count > 0 && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                    active ? "bg-white/20 text-white" : "bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
            <p className="text-sm text-gray-400 dark:text-gray-500">Loading orders…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-5xl mb-3 opacity-40">
              {STATUS_CONFIG[activeTab]?.icon ?? "📋"}
            </div>
            <p className="text-base font-semibold text-gray-400 dark:text-gray-500">
              No {activeTab !== "all" ? (STATUS_CONFIG[activeTab]?.label.toLowerCase() ?? "") : ""} orders
            </p>
            <p className="text-sm text-gray-300 dark:text-gray-600 mt-1">
              {activeTab === "pending" ? "New orders will appear here" : "Nothing to show"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((order) => {
              const isExpanded = expandedId === order.id;
              const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.completed;
              const items = orderItems[order.id];

              return (
                <div
                  key={order.id}
                  className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm hover:shadow-md dark:shadow-none transition-shadow"
                >
                  {/* Order row — clickable to expand */}
                  <button
                    className="w-full text-left px-5 py-4 flex items-center gap-4"
                    onClick={() => toggleExpand(order.id)}
                  >
                    {/* Status dot */}
                    <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${cfg.dot}`} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-800 dark:text-gray-100 font-mono tracking-wider">
                          #{order.id.slice(-6).toUpperCase()}
                        </span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.pill}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                        {order.is_billed && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400">
                            Billed
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5 mt-1 text-xs text-gray-400 dark:text-gray-500">
                        {order.customer_name && (
                          <span className="font-medium text-gray-500 dark:text-gray-400">{order.customer_name}</span>
                        )}
                        <span>{order.order_type === "takeaway" ? "📦 Dine Out" : "🍽 Dine In"}</span>
                        <span>{timeAgo(order.created_at)}</span>
                      </div>
                    </div>

                    {/* Total */}
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-gray-800 dark:text-gray-100">
                        {symbol}{order.total.toLocaleString("en-IN")}
                      </p>
                    </div>

                    {/* Chevron */}
                    <span className={`text-gray-300 dark:text-gray-600 text-sm transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>
                      ▼
                    </span>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-4 space-y-4 bg-gray-50/50 dark:bg-gray-800/30">
                      {/* Items list */}
                      {loadingItems === order.id ? (
                        <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
                          <div className="h-4 w-4 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
                          Loading items…
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {(items ?? []).map((item) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span className="text-gray-700 dark:text-gray-300">
                                {item.name}
                                <span className="text-gray-400 dark:text-gray-500 ml-1">× {item.quantity}</span>
                              </span>
                              <span className="font-semibold text-gray-700 dark:text-gray-300">
                                {symbol}{(item.price * item.quantity).toLocaleString("en-IN")}
                              </span>
                            </div>
                          ))}
                          <div className="border-t border-dashed border-gray-200 dark:border-gray-700 mt-2 pt-2 flex justify-between text-sm font-bold text-gray-800 dark:text-gray-200">
                            <span>Total</span>
                            <span>{symbol}{order.total.toLocaleString("en-IN")}</span>
                          </div>
                        </div>
                      )}

                      {order.notes && (
                        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2.5">
                          <span className="text-amber-500 text-sm">📝</span>
                          <p className="text-xs text-amber-700 dark:text-amber-300 italic">{order.notes}</p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 flex-wrap">
                        {NEXT_STATUS[order.status] && (
                          <button
                            onClick={() => updateStatus(order)}
                            disabled={updatingId === order.id}
                            className="flex-1 min-w-[120px] py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 rounded-xl text-sm font-semibold text-white transition-colors shadow-sm"
                          >
                            {updatingId === order.id ? "Updating…" : NEXT_LABEL[order.status]}
                          </button>
                        )}

                        {!order.is_billed && order.status !== "cancelled" && (
                          <button
                            onClick={async () => { await loadItems(order.id); setBillingOrder(order); }}
                            className="flex-1 min-w-[100px] py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          >
                            🧾 Bill
                          </button>
                        )}

                        {CANCELLABLE.has(order.status) && (
                          <button
                            onClick={() => setCancelConfirm(order)}
                            disabled={updatingId === order.id}
                            className="py-2.5 px-4 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 rounded-xl text-sm font-semibold text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60 transition-colors"
                          >
                            Cancel
                          </button>
                        )}

                        {/* Cashier stamp award — only for completed app orders */}
                        {order.status === "completed" && order.user_id && (
                          <button
                            onClick={() => awardStamp(order)}
                            disabled={stampingId === order.id || stampedIds.has(order.id)}
                            className={`py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors ${
                              stampedIds.has(order.id)
                                ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 cursor-default"
                                : "bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40 disabled:opacity-60"
                            }`}
                          >
                            {stampingId === order.id ? "Awarding…" : stampedIds.has(order.id) ? "✓ Stamp Given" : "☕ Give Stamp"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {newOrderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 flex flex-col max-h-[90vh]">

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
              <div className="flex items-center gap-3">
                {newOrderStep === "items" && (
                  <button
                    onClick={() => setNewOrderStep("type")}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  >
                    ←
                  </button>
                )}
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
                  {newOrderStep === "type" ? "New Order" : (
                    <span className="flex items-center gap-2">
                      New Order
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${newOrderType === "dine_in" ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"}`}>
                        {newOrderType === "dine_in" ? "🍽 Dine In" : "📦 Dine Out"}
                      </span>
                    </span>
                  )}
                </h2>
              </div>
              <button onClick={() => setNewOrderOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
            </div>

            {/* ── STEP 1: Choose order type ── */}
            {newOrderStep === "type" && (
              <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-4">
                <p className="text-sm text-gray-400 dark:text-gray-500 mb-2">Select order type to continue</p>
                <button
                  onClick={() => chooseOrderType("dine_in")}
                  className="w-full flex items-center gap-5 px-6 py-5 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 border-2 border-orange-200 dark:border-orange-800 hover:border-orange-400 dark:hover:border-orange-600 rounded-2xl transition-all group"
                >
                  <span className="text-4xl">🍽</span>
                  <div className="text-left">
                    <p className="text-base font-bold text-gray-800 dark:text-gray-100 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">Dine In</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Customer dining at the cafe</p>
                  </div>
                  <span className="ml-auto text-gray-300 dark:text-gray-600 group-hover:text-orange-400 transition-colors text-lg">→</span>
                </button>

                <button
                  onClick={() => chooseOrderType("takeaway")}
                  className="w-full flex items-center gap-5 px-6 py-5 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600 rounded-2xl transition-all group"
                >
                  <span className="text-4xl">📦</span>
                  <div className="text-left">
                    <p className="text-base font-bold text-gray-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Dine Out</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Takeaway / parcel order</p>
                  </div>
                  <span className="ml-auto text-gray-300 dark:text-gray-600 group-hover:text-blue-400 transition-colors text-lg">→</span>
                </button>

                <button onClick={() => setNewOrderOpen(false)} className="mt-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                  Cancel
                </button>
              </div>
            )}

            {/* ── STEP 2: Pick items ── */}
            {newOrderStep === "items" && (() => {
              const searchQ = itemSearch.trim().toLowerCase();
              const visibleItems = menuItems.filter((m) => {
                const matchesCat = !selectedCategoryId || m.category_id === selectedCategoryId;
                const matchesSearch = !searchQ || m.name.toLowerCase().includes(searchQ);
                return matchesCat && matchesSearch;
              });
              const visibleCats = searchQ
                ? menuCategories.filter((c) => visibleItems.some((m) => m.category_id === c.id))
                : selectedCategoryId
                  ? menuCategories.filter((c) => c.id === selectedCategoryId)
                  : menuCategories;
              const cartItems = menuItems.filter((m) => (newCart[m.id] ?? 0) > 0);
              const cartCount = cartItems.reduce((s, m) => s + newCart[m.id], 0);
              const total = cartItems.reduce((s, m) => s + m.price * newCart[m.id], 0);

              return (
                <>
                  {/* Search + category tiles */}
                  <div className="px-5 pt-3 pb-2 space-y-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
                    {/* Search */}
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                      <input
                        type="text"
                        placeholder="Search items…"
                        value={itemSearch}
                        onChange={(e) => { setItemSearch(e.target.value); setSelectedCategoryId(null); }}
                        className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                      {itemSearch && (
                        <button onClick={() => setItemSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
                      )}
                    </div>

                    {/* Category tiles */}
                    {!searchQ && (
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        <button
                          onClick={() => setSelectedCategoryId(null)}
                          className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                            !selectedCategoryId
                              ? "bg-orange-500 text-white"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                          }`}
                        >
                          All
                        </button>
                        {menuCategories.filter((c) => menuItems.some((m) => m.category_id === c.id)).map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => setSelectedCategoryId(selectedCategoryId === cat.id ? null : cat.id)}
                            className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                              selectedCategoryId === cat.id
                                ? "bg-orange-500 text-white"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                            }`}
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Items list */}
                  <div className="overflow-y-auto flex-1 px-5 py-3">
                    {menuLoading ? (
                      <div className="flex items-center gap-2 py-10 justify-center text-sm text-gray-400">
                        <div className="h-4 w-4 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
                        Loading menu…
                      </div>
                    ) : visibleItems.length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">
                        {searchQ ? `No items matching "${itemSearch}"` : "No items in this category"}
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {visibleCats.map((cat) => {
                          const catItems = visibleItems.filter((m) => m.category_id === cat.id);
                          if (catItems.length === 0) return null;
                          return (
                            <div key={cat.id}>
                              <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">{cat.name}</p>
                              <div className="space-y-1.5">
                                {catItems.map((item) => {
                                  const qty = newCart[item.id] ?? 0;
                                  return (
                                    <div key={item.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5">
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{item.name}</p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500">{symbol}{item.price.toLocaleString("en-IN")}</p>
                                      </div>
                                      <div className="flex items-center gap-2 ml-3 shrink-0">
                                        {qty > 0 ? (
                                          <>
                                            <button onClick={() => cartSub(item.id)} className="w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 font-bold flex items-center justify-center hover:bg-orange-200 dark:hover:bg-orange-900/60 text-lg leading-none">−</button>
                                            <span className="w-5 text-center text-sm font-bold text-gray-800 dark:text-gray-100">{qty}</span>
                                            <button onClick={() => cartAdd(item.id)} className="w-7 h-7 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center hover:bg-orange-600 text-lg leading-none">+</button>
                                          </>
                                        ) : (
                                          <button onClick={() => cartAdd(item.id)} className="w-7 h-7 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center hover:bg-orange-600 text-lg leading-none">+</button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 shrink-0">
                    <div className="flex items-center justify-between mb-3 text-sm min-h-[20px]">
                      {cartCount > 0 ? (
                        <>
                          <span className="text-gray-500 dark:text-gray-400">{cartCount} item{cartCount !== 1 ? "s" : ""}</span>
                          <span className="font-bold text-gray-900 dark:text-gray-50 text-base">{symbol}{total.toLocaleString("en-IN")}</span>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">No items selected</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setNewOrderStep("type")}
                        className="py-2.5 px-4 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0"
                      >
                        ← Back
                      </button>
                      <button
                        onClick={() => submitNewOrder(true)}
                        disabled={cartItems.length === 0 || submittingOrder}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white transition-colors"
                      >
                        {submittingOrder ? "Placing…" : "🧾 Place Order & Bill"}
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Stamp error popup */}
      {stampError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">☕</span>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">Cannot Award Stamp</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500">Loyalty program rule</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-6 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-4 py-3 border border-amber-200 dark:border-amber-800">
              {stampError}
            </p>
            <button
              onClick={() => setStampError(null)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {cancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">Cancel Order</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  #{cancelConfirm.id.slice(-6).toUpperCase()}
                  {cancelConfirm.customer_name ? ` · ${cancelConfirm.customer_name}` : ""}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              This will cancel the order and cannot be undone. Are you sure?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelConfirm(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Keep Order
              </button>
              <button
                onClick={() => cancelOrder(cancelConfirm)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                Cancel Order
              </button>
            </div>
          </div>
        </div>
      )}

      {billingOrder && (
        <BillModal
          order={billingOrder}
          items={orderItems[billingOrder.id] ?? []}
          shopName={shopName}
          shopTagline={shopTagline}
          logoUrl={logoUrl}
          currency={currency}
          billSettings={billSettings}
          shopId={shopId}
          onClose={() => setBillingOrder(null)}
          onBilled={() => {
            setBillingOrder(null);
            setOrders((p) => p.map((o) => o.id === billingOrder.id ? { ...o, is_billed: true, status: "completed" } : o));
          }}
        />
      )}
    </div>
  );
}
