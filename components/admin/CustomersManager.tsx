"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

type LoyaltyCard = {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  user_avatar: string | null;
  stamp_count: number;
  redeemed_count: number;
  pending_claim: boolean;
  updated_at: string;
};

type PendingCheckinRaw = {
  id: string;
  customer_id: string;
  shop_id: string;
  checked_in_at: string;
  status: string;
  customers: { name: string; phone: string } | null;
};

type PendingCheckin = {
  id: string;
  customer_id: string;
  shop_id: string;
  checked_in_at: string;
  status: string;
  name: string;
  phone: string;
};

type Checkin = {
  id: string;
  customer_id: string;
  checked_in_at: string;
  status: string;
};

type StaffMember = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: "manager" | "staff";
  salary_amount: number;
  salary_type: "monthly" | "weekly" | "daily";
  joined_date: string | null;
  is_active: boolean;
  created_at: string;
};

type TabKey = "users" | "staff";

const AVATAR_COLORS = [
  "bg-orange-100 text-orange-600",
  "bg-blue-100 text-blue-600",
  "bg-green-100 text-green-600",
  "bg-purple-100 text-purple-600",
  "bg-pink-100 text-pink-600",
  "bg-teal-100 text-teal-600",
  "bg-yellow-100 text-yellow-700",
  "bg-red-100 text-red-600",
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

const ROLE_COLORS = {
  manager: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  staff:   "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

export function CustomersManager({ shopId }: { shopId: string }) {
  const supabase = createClient();

  const [tab, setTab] = useState<TabKey>("users");
  const [loading, setLoading] = useState(true);

  // Users
  const [loyaltyCards, setLoyaltyCards] = useState<LoyaltyCard[]>([]);
  const [pendingCheckins, setPendingCheckins] = useState<PendingCheckin[]>([]);
  const [scanHistories, setScanHistories] = useState<Record<string, Checkin[]>>({});
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [claimActionId, setClaimActionId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");

  // Staff
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffSearch, setStaffSearch] = useState("");
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [editStaff, setEditStaff] = useState<StaffMember | null>(null);
  const [staffForm, setStaffForm] = useState({ name: "", email: "", phone: "", role: "staff" as "manager" | "staff", salary_amount: "", salary_type: "monthly" as "monthly" | "weekly" | "daily", joined_date: todayIso() });
  const [staffFormError, setStaffFormError] = useState<string | null>(null);
  const [savingStaff, setSavingStaff] = useState(false);

  useEffect(() => { if (shopId) fetchAll(); }, [shopId]);

  async function fetchAll() {
    setLoading(true);
    const [loyaltyCardsRes, pendingRes, staffRes] = await Promise.all([
      fetch(`/api/loyalty/cards?shop_id=${shopId}`).then((r) => r.ok ? r.json() : { cards: [] }),
      supabase
        .from("loyalty_checkins")
        .select("id, customer_id, shop_id, checked_in_at, status, customers(name, phone)")
        .eq("shop_id", shopId)
        .eq("status", "pending")
        .order("checked_in_at", { ascending: true }),
      fetch(`/api/staff?shop_id=${shopId}`).then((r) => r.ok ? r.json() : { staff: [] }),
    ]);

    setLoyaltyCards((loyaltyCardsRes as { cards: LoyaltyCard[] }).cards ?? []);

    const pending = ((pendingRes.data ?? []) as unknown as PendingCheckinRaw[]).map((row) => ({
      id: row.id,
      customer_id: row.customer_id,
      shop_id: row.shop_id,
      checked_in_at: row.checked_in_at,
      status: row.status,
      name: row.customers?.name ?? "",
      phone: row.customers?.phone ?? "",
    }));
    setPendingCheckins(pending);

    const allStaff = (staffRes as { staff: StaffMember[] }).staff ?? [];
    setStaff(allStaff.filter((s) => s.is_active && (s.role === "manager" || s.role === "staff")));

    setLoading(false);
  }

  async function handleApprove(checkin: PendingCheckin) {
    setApprovingId(checkin.id);
    const res = await fetch("/api/loyalty/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkin_id: checkin.id, shop_id: checkin.shop_id, customer_id: checkin.customer_id }),
    });
    if (res.ok) setPendingCheckins((prev) => prev.filter((p) => p.id !== checkin.id));
    setApprovingId(null);
  }

  async function handleReject(checkin: PendingCheckin) {
    setRejectingId(checkin.id);
    const { error } = await supabase.from("loyalty_checkins").update({ status: "rejected" }).eq("id", checkin.id);
    if (!error) setPendingCheckins((prev) => prev.filter((p) => p.id !== checkin.id));
    setRejectingId(null);
  }

  async function handleClaimAction(card: LoyaltyCard, action: "approve" | "dismiss") {
    setClaimActionId(card.id);
    const res = await fetch("/api/loyalty/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card_id: card.id, shop_id: shopId, action }),
    });
    if (res.ok) {
      setLoyaltyCards((prev) => prev.map((c) => c.id === card.id
        ? action === "approve"
          ? { ...c, pending_claim: false, redeemed_count: c.redeemed_count + 1 }
          : { ...c, pending_claim: false }
        : c
      ));
    }
    setClaimActionId(null);
  }

  async function fetchScanHistory(userId: string) {
    const { data } = await supabase
      .from("loyalty_stamp_events")
      .select("id, user_id, created_at, stamps")
      .eq("shop_id", shopId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);
    setScanHistories((prev) => ({
      ...prev,
      [userId]: (data ?? []).map((d: { id: string; user_id: string; created_at: string; stamps: number }) => ({
        id: d.id,
        customer_id: d.user_id,
        checked_in_at: d.created_at,
        status: "approved",
      })),
    }));
  }

  function openAddStaff() {
    setEditStaff(null);
    setStaffForm({ name: "", email: "", phone: "", role: "staff", salary_amount: "", salary_type: "monthly", joined_date: todayIso() });
    setStaffFormError(null);
    setAddStaffOpen(true);
  }

  function openEditStaff(m: StaffMember) {
    setEditStaff(m);
    setStaffForm({ name: m.name, email: m.email ?? "", phone: m.phone ?? "", role: m.role, salary_amount: String(m.salary_amount), salary_type: m.salary_type, joined_date: m.joined_date ?? todayIso() });
    setStaffFormError(null);
    setAddStaffOpen(true);
  }

  async function saveStaffMember(e: React.FormEvent) {
    e.preventDefault();
    setSavingStaff(true);
    setStaffFormError(null);
    const payload = { shop_id: shopId, name: staffForm.name, email: staffForm.email || null, phone: staffForm.phone || null, role: staffForm.role, salary_amount: parseFloat(staffForm.salary_amount) || 0, salary_type: staffForm.salary_type, joined_date: staffForm.joined_date || null };

    const res = await fetch("/api/staff", {
      method: editStaff ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editStaff ? { id: editStaff.id, ...payload } : payload),
    });
    const data = await res.json();
    if (!res.ok) { setStaffFormError(data.error ?? "Failed to save"); setSavingStaff(false); return; }

    const saved = data.staff as StaffMember;
    if (saved.role === "manager" || saved.role === "staff") {
      if (editStaff) {
        setStaff((prev) => prev.map((s) => s.id === editStaff.id ? saved : s));
      } else {
        setStaff((prev) => [saved, ...prev]);
      }
    }
    setAddStaffOpen(false);
    setSavingStaff(false);
  }

  async function deactivateStaff(id: string) {
    await fetch(`/api/staff?id=${id}&shop_id=${shopId}`, { method: "DELETE" });
    setStaff((prev) => prev.filter((s) => s.id !== id));
  }

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return loyaltyCards;
    const q = userSearch.toLowerCase();
    return loyaltyCards.filter((c) =>
      (c.user_name ?? "").toLowerCase().includes(q) ||
      (c.user_email ?? "").toLowerCase().includes(q)
    );
  }, [loyaltyCards, userSearch]);

  const filteredStaff = useMemo(() => {
    if (!staffSearch.trim()) return staff;
    const q = staffSearch.toLowerCase();
    return staff.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.phone ?? "").includes(q) ||
      (s.email ?? "").toLowerCase().includes(q)
    );
  }, [staff, staffSearch]);

  const pendingClaims = useMemo(() => loyaltyCards.filter((c) => c.pending_claim), [loyaltyCards]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">People</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
            {loyaltyCards.length} user{loyaltyCards.length !== 1 ? "s" : ""} · {staff.length} staff
          </p>
        </div>
        <button
          onClick={fetchAll}
          className="flex items-center gap-2 px-3 py-2 text-xs font-semibold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-0.5 w-fit">
        {([
          { key: "users" as TabKey, label: "Users", icon: "👤", count: loyaltyCards.length },
          { key: "staff" as TabKey, label: "Staff", icon: "🏢", count: staff.length },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-5 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t.key
                ? "bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
              tab === t.key ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* ── USERS TAB ── */}
      {tab === "users" && (
        <div className="space-y-4">
          {/* Pending QR checkins */}
          {pendingCheckins.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-400 mb-3">
                ⏳ {pendingCheckins.length} pending check-in{pendingCheckins.length !== 1 ? "s" : ""}
              </p>
              <div className="space-y-2">
                {pendingCheckins.map((checkin) => (
                  <div key={checkin.id} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg px-4 py-2.5 border border-amber-100 dark:border-amber-900">
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{checkin.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{checkin.phone} · {timeAgo(checkin.checked_in_at)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove(checkin)} disabled={approvingId === checkin.id}
                        className="px-3 py-1.5 text-xs font-semibold bg-green-500 hover:bg-green-600 text-white rounded-lg disabled:opacity-50">{approvingId === checkin.id ? "…" : "Approve"}</button>
                      <button onClick={() => handleReject(checkin)} disabled={rejectingId === checkin.id}
                        className="px-3 py-1.5 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white rounded-lg disabled:opacity-50">{rejectingId === checkin.id ? "…" : "Reject"}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending reward claims */}
          {pendingClaims.length > 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
              <p className="text-sm font-semibold text-green-800 dark:text-green-400 mb-3">
                🎁 {pendingClaims.length} pending reward claim{pendingClaims.length !== 1 ? "s" : ""}
              </p>
              <div className="space-y-2">
                {pendingClaims.map((card) => (
                  <div key={card.id} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg px-4 py-3 border border-green-100 dark:border-green-900">
                    <div className="flex items-center gap-3 min-w-0">
                      {card.user_avatar ? (
                        <img src={card.user_avatar} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${avatarColor(card.user_name ?? "U")}`}>
                          {initials(card.user_name ?? "U")}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{card.user_name ?? "—"}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{card.user_email ?? ""} · {card.stamp_count} stamps · {card.redeemed_count} redeemed</p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0 ml-3">
                      <button onClick={() => handleClaimAction(card, "approve")} disabled={claimActionId === card.id}
                        className="px-3 py-1.5 text-xs font-semibold bg-green-500 hover:bg-green-600 text-white rounded-lg disabled:opacity-50">
                        {claimActionId === card.id ? "…" : "Confirm"}
                      </button>
                      <button onClick={() => handleClaimAction(card, "dismiss")} disabled={claimActionId === card.id}
                        className="px-3 py-1.5 text-xs font-semibold bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 text-gray-700 dark:text-gray-200 rounded-lg disabled:opacity-50">Dismiss</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          <input
            type="text"
            placeholder="Search by name or email…"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            className="w-64 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
          />

          {/* User list */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            {filteredUsers.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-3xl mb-3">👤</p>
                <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">No app users yet</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Users appear here when they sign in via the menu app</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {filteredUsers.map((card) => {
                  const isExpanded = expandedUserId === card.user_id;
                  const history = scanHistories[card.user_id];
                  return (
                    <div key={card.id}>
                      <div
                        className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                        onClick={() => {
                          if (isExpanded) { setExpandedUserId(null); return; }
                          setExpandedUserId(card.user_id);
                          if (!scanHistories[card.user_id]) fetchScanHistory(card.user_id);
                        }}
                      >
                        {card.user_avatar ? (
                          <img src={card.user_avatar} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarColor(card.user_name ?? "U")}`}>
                            {initials(card.user_name ?? "U")}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{card.user_name ?? "—"}</p>
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-700 rounded-full px-1.5 py-0.5 shrink-0">App</span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{card.user_email ?? "—"}</p>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          {card.pending_claim && (
                            <span className="text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">Claim Pending</span>
                          )}
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            ⭐ <span className="font-semibold">{card.stamp_count}</span> stamps
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">{card.redeemed_count} redeemed</span>
                          <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-5 pb-5 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800">
                          <div className="grid grid-cols-3 gap-4 py-4">
                            <div>
                              <p className="text-xs text-gray-400 dark:text-gray-500">Stamps</p>
                              <p className="text-sm font-bold text-orange-600 dark:text-orange-400 mt-0.5">{card.stamp_count} ☕</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 dark:text-gray-500">Redeemed</p>
                              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-0.5">{card.redeemed_count}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 dark:text-gray-500">Last Activity</p>
                              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-0.5">{formatDate(card.updated_at)}</p>
                            </div>
                          </div>

                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Stamp History</p>
                          {history === undefined ? (
                            <div className="flex justify-center py-4">
                              <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : history.length === 0 ? (
                            <p className="text-xs text-gray-400 dark:text-gray-500 py-2">No stamp history yet</p>
                          ) : (
                            <div className="space-y-2">
                              {history.map((item) => (
                                <div key={item.id} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg px-3 py-2 border border-gray-100 dark:border-gray-700">
                                  <p className="text-xs text-gray-600 dark:text-gray-300">{formatDateTime(item.checked_in_at)}</p>
                                  <span className="text-xs font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">Stamp given</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STAFF TAB ── */}
      {tab === "staff" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <input
              type="text"
              placeholder="Search staff…"
              value={staffSearch}
              onChange={(e) => setStaffSearch(e.target.value)}
              className="w-56 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
            />
            <button
              onClick={openAddStaff}
              className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
            >
              + Add Staff
            </button>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            {filteredStaff.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-3xl mb-3">🏢</p>
                <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">No staff added yet</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Add managers and staff to get started</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {filteredStaff.map((member) => (
                  <div key={member.id} className="flex items-center gap-4 px-5 py-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarColor(member.name)}`}>
                      {initials(member.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{member.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${ROLE_COLORS[member.role]}`}>
                          {member.role}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {member.phone ?? member.email ?? "—"}
                        {member.joined_date && ` · Joined ${formatDate(member.joined_date)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {member.salary_amount > 0 ? (
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            ₹{Number(member.salary_amount).toLocaleString("en-IN")}
                            <span className="text-xs font-normal text-gray-400">/{member.salary_type === "monthly" ? "mo" : member.salary_type === "weekly" ? "wk" : "day"}</span>
                          </span>
                        ) : "—"}
                      </p>
                      <button onClick={() => openEditStaff(member)}
                        className="p-2 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors text-base">✏️</button>
                      <button onClick={() => deactivateStaff(member.id)}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-base">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ADD / EDIT STAFF MODAL ── */}
      {addStaffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-50">{editStaff ? "Edit Staff" : "Add Staff Member"}</h3>
              <button onClick={() => setAddStaffOpen(false)} className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700">✕</button>
            </div>
            <form onSubmit={saveStaffMember} className="space-y-3">
              <input required placeholder="Full name" value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              <input type="email" placeholder="Email (optional)" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              <input type="tel" placeholder="Phone (optional)" value={staffForm.phone} onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400" />

              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium">Role</p>
                <div className="flex gap-2">
                  {(["manager", "staff"] as const).map((r) => (
                    <button key={r} type="button" onClick={() => setStaffForm({ ...staffForm, role: r })}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border capitalize transition-colors ${staffForm.role === r ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-orange-300"}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">Salary</p>
                  <div className="flex">
                    <span className="px-3 py-2.5 bg-gray-100 dark:bg-gray-800 border border-r-0 border-gray-200 dark:border-gray-700 rounded-l-xl text-sm text-gray-500">₹</span>
                    <input type="number" min="0" placeholder="0" value={staffForm.salary_amount} onChange={(e) => setStaffForm({ ...staffForm, salary_amount: e.target.value })}
                      className="flex-1 px-3 py-2.5 rounded-r-xl border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">Type</p>
                  <select value={staffForm.salary_type} onChange={(e) => setStaffForm({ ...staffForm, salary_type: e.target.value as "monthly" | "weekly" | "daily" })}
                    className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400">
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="daily">Daily</option>
                  </select>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">Joined Date</p>
                <input type="date" value={staffForm.joined_date} onChange={(e) => setStaffForm({ ...staffForm, joined_date: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>

              {staffFormError && <p className="text-xs text-red-500 text-center">{staffFormError}</p>}
              <button type="submit" disabled={savingStaff}
                className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold disabled:opacity-60 transition-colors">
                {savingStaff ? "Saving…" : editStaff ? "Update Staff" : "Add Staff"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
