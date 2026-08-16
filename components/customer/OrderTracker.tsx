"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const STATUS_STEPS = ["pending", "preparing", "ready", "completed"];
const STATUS_LABEL: Record<string, string> = {
  pending: "Order Received",
  preparing: "Preparing",
  ready: "Ready for Pickup",
  completed: "Completed",
  cancelled: "Cancelled",
};
const STATUS_ICON: Record<string, string> = {
  pending: "🕐",
  preparing: "👨‍🍳",
  ready: "✅",
  completed: "🎉",
  cancelled: "❌",
};
const STATUS_DESC: Record<string, string> = {
  pending: "Your order is being confirmed…",
  preparing: "Our team is preparing your order!",
  ready: "Please collect your order at the counter!",
  completed: "Thank you! Hope you enjoyed it.",
  cancelled: "Your order has been cancelled.",
};
const CURRENCY_SYMBOL: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "د.إ" };

type OrderItem = { id: string; name: string; price: number; quantity: number };
type Order = {
  id: string;
  status: string;
  total: number;
  subtotal: number;
  notes: string | null;
  order_type: string | null;
  customer_name: string | null;
  created_at: string;
  is_billed?: boolean | null;
  discount_percent?: number | null;
  discount_amount?: number | null;
  gst_percent?: number | null;
  gst_amount?: number | null;
  dineout_charge_percent?: number | null;
  dineout_charge_amount?: number | null;
  dineout_charge_label?: string | null;
};

type LoyaltyCard = { stamp_count: number; redeemed_count: number; pending_claim: boolean };
type LoyaltyProgram = { stamps_per_visit: number };
type LoyaltyReward = { stamps_required: number; reward_name: string };

export function OrderTracker({
  initialOrder,
  items,
  shopSlug,
  shopId,
  shopName,
  color,
  currency,
}: {
  initialOrder: Order;
  items: OrderItem[];
  shopSlug: string;
  shopId: string;
  shopName: string;
  color: string;
  currency: string;
}) {
  const [order, setOrder] = useState<Order>(initialOrder);
  const symbol = CURRENCY_SYMBOL[currency] ?? "₹";
  const supabase = createClient();

  const [loyaltyCard, setLoyaltyCard] = useState<LoyaltyCard | null>(null);
  const [loyaltyProgram, setLoyaltyProgram] = useState<LoyaltyProgram | null>(null);
  const [loyaltyRewards, setLoyaltyRewards] = useState<LoyaltyReward[]>([]);
  const [loyaltyUser, setLoyaltyUser] = useState<boolean>(false);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    fetch(`/api/loyalty/card?shop_id=${shopId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        setLoyaltyProgram(data.program ?? null);
        setLoyaltyRewards(data.rewards ?? []);
        setLoyaltyCard(data.card ?? null);
        setLoyaltyUser(!!data.user);
      })
      .catch(() => {});
  }, [shopId]);

  useEffect(() => {
    // Realtime subscription (works if Supabase Realtime is enabled for the table)
    const channel = supabase
      .channel(`order-track-${order.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${order.id}` },
        (payload) => {
          const updated = payload.new as Order;
          setOrder((prev) => ({ ...prev, ...updated }));
        }
      )
      .subscribe();

    // Polling fallback — bypasses RLS, always works
    const poll = setInterval(async () => {
      const res = await fetch(`/api/orders/track?id=${order.id}`);
      if (res.ok) {
        const data = await res.json();
        setOrder((prev) => ({ ...prev, ...data }));
      }
    }, 4000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [order.id]);

  const currentStep = STATUS_STEPS.indexOf(order.status);

  const subtotal = order.subtotal || items.reduce((s, i) => s + i.price * i.quantity, 0);
  const discountAmt = order.discount_amount ?? 0;
  const gstAmt = order.gst_amount ?? 0;
  const dineoutAmt = order.dineout_charge_amount ?? 0;
  const hasBillingBreakdown = order.is_billed && (discountAmt > 0 || gstAmt > 0 || dineoutAmt > 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ backgroundColor: color }} className="px-4 py-6 text-white">
        <p className="text-sm opacity-80">{shopName}</p>
        <h1 className="text-2xl font-bold mt-0.5">Order #{order.id.slice(-6).toUpperCase()}</h1>
        {order.customer_name && <p className="text-sm opacity-80 mt-0.5">Hey {order.customer_name}!</p>}
      </div>

      <div className="px-4 py-6 space-y-4 max-w-lg mx-auto">
        {/* Cancelled state */}
        {order.status === "cancelled" && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
            <p className="text-3xl mb-2">❌</p>
            <p className="font-bold text-red-700">Order Cancelled</p>
            <p className="text-sm text-red-500 mt-1">This order has been cancelled by the café.</p>
          </div>
        )}

        {/* Status stepper — hidden when cancelled */}
        {order.status !== "cancelled" && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-2">
              {STATUS_STEPS.map((step, i) => (
                <div key={step} className="flex flex-col items-center flex-1">
                  <div
                    className={`h-9 w-9 rounded-full flex items-center justify-center text-lg mb-1 transition-all duration-500 ${i <= currentStep ? "text-white" : "bg-gray-100 text-gray-300"}`}
                    style={i <= currentStep ? { backgroundColor: color } : {}}
                  >
                    {STATUS_ICON[step]}
                  </div>
                  <p className={`text-[10px] font-medium text-center leading-tight ${i <= currentStep ? "text-gray-700" : "text-gray-300"}`}>
                    {STATUS_LABEL[step]}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 bg-gray-100 rounded-full h-1.5 relative overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                style={{ backgroundColor: color, width: `${(currentStep / (STATUS_STEPS.length - 1)) * 100}%` }}
              />
            </div>
            <p className="text-center text-sm font-semibold text-gray-700 mt-3">
              {STATUS_ICON[order.status]} {STATUS_LABEL[order.status]}
            </p>
            <p className="text-center text-xs text-gray-400 mt-1">{STATUS_DESC[order.status]}</p>
          </div>
        )}

        {/* Order items */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-3">Order Summary</h2>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-gray-700">{item.name} × {item.quantity}</span>
                <span className="font-medium text-gray-800">{symbol}{(item.price * item.quantity).toLocaleString("en-IN")}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between text-sm text-gray-500">
            <span>Subtotal</span>
            <span>{symbol}{subtotal.toLocaleString("en-IN")}</span>
          </div>

          {/* Billing breakdown — shown after cashier bills the order */}
          {hasBillingBreakdown && (
            <div className="mt-2 space-y-1.5">
              {discountAmt > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount {order.discount_percent ? `(${order.discount_percent}%)` : ""}</span>
                  <span>−{symbol}{discountAmt.toLocaleString("en-IN")}</span>
                </div>
              )}
              {gstAmt > 0 && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>GST {order.gst_percent ? `(${order.gst_percent}%)` : ""}</span>
                  <span>+{symbol}{gstAmt.toLocaleString("en-IN")}</span>
                </div>
              )}
              {dineoutAmt > 0 && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>{order.dineout_charge_label ?? "Packaging"} {order.dineout_charge_percent ? `(${order.dineout_charge_percent}%)` : ""}</span>
                  <span>+{symbol}{dineoutAmt.toLocaleString("en-IN")}</span>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between font-bold text-sm">
            <span>{order.is_billed ? "Bill Total" : "Total"}</span>
            <span style={{ color }}>{symbol}{order.total.toLocaleString("en-IN")}</span>
          </div>

          {order.is_billed && (
            <div className="mt-3 flex items-center gap-2 bg-green-50 rounded-xl px-3 py-2">
              <span className="text-green-500 text-sm">✓</span>
              <span className="text-xs text-green-700 font-medium">Bill generated — please pay at the counter</span>
            </div>
          )}

          {order.notes && (
            <p className="mt-2 text-xs text-gray-400 italic">Note: {order.notes}</p>
          )}
        </div>

        {/* Loyalty stamp card — only shown when customer is signed in */}
        {loyaltyProgram && loyaltyUser && (() => {
          const firstReward = loyaltyRewards[0];
          const total = firstReward?.stamps_required ?? 10;
          const earned = loyaltyCard?.stamp_count ?? 0;
          const filled = Math.min(earned, total);
          const isComplete = earned >= total;
          const isPending = loyaltyCard?.pending_claim;

          async function claimReward() {
            setClaiming(true);
            const res = await fetch("/api/loyalty/card", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shop_id: shopId }) });
            if (res.ok) setLoyaltyCard((c) => c ? { ...c, pending_claim: true } : c);
            setClaiming(false);
          }

          return (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-700">Your Stamp Card</h2>
                <span className="text-xs font-semibold text-orange-500">{filled} / {total} stamps</span>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {Array.from({ length: total }).map((_, i) => (
                  <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors ${i < filled ? "bg-orange-400 text-white" : "border-2 border-dashed border-gray-200"}`}>
                    {i < filled ? "☕" : ""}
                  </div>
                ))}
              </div>

              {!loyaltyUser && (
                <p className="text-xs text-gray-400 text-center mt-2">Sign in with Google on the menu to earn stamps</p>
              )}

              {loyaltyUser && isPending && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 mt-2">
                  <span className="text-green-500 text-sm">🎁</span>
                  <span className="text-sm font-semibold text-green-700">Reward claimed! Show this screen to the cashier.</span>
                </div>
              )}

              {loyaltyUser && isComplete && !isPending && firstReward && (
                <button
                  onClick={claimReward}
                  disabled={claiming}
                  className="w-full mt-2 py-3 rounded-xl text-sm font-extrabold text-white disabled:opacity-60 transition-opacity"
                  style={{ backgroundColor: color }}
                >
                  {claiming ? "Claiming…" : `🎁 Claim: ${firstReward.reward_name}`}
                </button>
              )}
            </div>
          );
        })()}

        <Link href={`/${shopSlug}`} className="block text-center text-sm text-gray-400 hover:text-gray-600 py-2">
          ← Back to menu
        </Link>
      </div>
    </div>
  );
}
