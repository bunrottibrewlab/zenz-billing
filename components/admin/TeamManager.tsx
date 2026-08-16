"use client";

import { useState, useEffect, useMemo } from "react";

type Role = "admin" | "manager" | "staff";
type SalaryType = "monthly" | "weekly" | "daily";
type LeaveType = "casual" | "sick" | "emergency" | "unpaid";
type LeaveStatus = "pending" | "approved" | "rejected";

type StaffMember = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  salary_amount: number;
  salary_type: SalaryType;
  joined_date: string | null;
  is_active: boolean;
  created_at: string;
};

type SalaryPayment = {
  id: string;
  staff_id: string;
  amount: number;
  period_label: string;
  payment_method: string;
  notes: string | null;
  paid_at: string;
  shop_staff: { name: string; role: string } | null;
};

type Leave = {
  id: string;
  staff_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: LeaveStatus;
  created_at: string;
  shop_staff: { name: string; role: string } | null;
};

const ROLE_CONFIG: Record<Role, { label: string; color: string; dot: string }> = {
  admin:   { label: "Admin",   color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", dot: "bg-purple-500" },
  manager: { label: "Manager", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",       dot: "bg-blue-500"   },
  staff:   { label: "Staff",   color: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",          dot: "bg-gray-400"   },
};

const LEAVE_TYPE_COLORS: Record<LeaveType, string> = {
  casual:    "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
  sick:      "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300",
  emergency: "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300",
  unpaid:    "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
};

const STATUS_COLORS: Record<LeaveStatus, string> = {
  pending:  "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
  approved: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
  rejected: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
};

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function leaveDays(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.floor(ms / 86400000) + 1;
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtMonth(date: string) {
  return new Date(date).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

const CURRENT_PERIOD = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });

export function TeamManager({ shopId, currency }: { shopId: string; currency: string }) {
  const symbol = { INR: "₹", USD: "$", EUR: "€", GBP: "£" }[currency] ?? "₹";

  const [tab, setTab] = useState<"members" | "salary" | "leaves">("members");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);

  // Add staff modal
  const [addOpen, setAddOpen] = useState(false);
  const [editMember, setEditMember] = useState<StaffMember | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "staff" as Role, salary_amount: "", salary_type: "monthly" as SalaryType, joined_date: todayIso() });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Salary modal
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [salaryStaff, setSalaryStaff] = useState<StaffMember | null>(null);
  const [salaryForm, setSalaryForm] = useState({ amount: "", period_label: CURRENT_PERIOD, payment_method: "cash", notes: "" });
  const [savingSalary, setSavingSalary] = useState(false);

  // Leave modal
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveStaff, setLeaveStaff] = useState<StaffMember | null>(null);
  const [leaveForm, setLeaveForm] = useState({ leave_type: "casual" as LeaveType, start_date: todayIso(), end_date: todayIso(), reason: "" });
  const [savingLeave, setSavingLeave] = useState(false);

  const [updatingLeaveId, setUpdatingLeaveId] = useState<string | null>(null);

  useEffect(() => { fetchAll(); }, [shopId]);

  async function fetchAll() {
    setLoading(true);
    const [staffRes, salaryRes, leavesRes] = await Promise.all([
      fetch(`/api/staff?shop_id=${shopId}`).then((r) => r.json()),
      fetch(`/api/salary?shop_id=${shopId}`).then((r) => r.json()),
      fetch(`/api/leaves?shop_id=${shopId}`).then((r) => r.json()),
    ]);
    setStaff(staffRes.staff ?? []);
    setSalaryPayments(salaryRes.payments ?? []);
    setLeaves(leavesRes.leaves ?? []);
    setLoading(false);
  }

  function openAdd() {
    setEditMember(null);
    setForm({ name: "", email: "", phone: "", role: "staff", salary_amount: "", salary_type: "monthly", joined_date: todayIso() });
    setFormError(null);
    setAddOpen(true);
  }

  function openEdit(m: StaffMember) {
    setEditMember(m);
    setForm({ name: m.name, email: m.email ?? "", phone: m.phone ?? "", role: m.role, salary_amount: String(m.salary_amount), salary_type: m.salary_type, joined_date: m.joined_date ?? todayIso() });
    setFormError(null);
    setAddOpen(true);
  }

  async function saveStaff(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const payload = { shop_id: shopId, name: form.name, email: form.email || null, phone: form.phone || null, role: form.role, salary_amount: parseFloat(form.salary_amount) || 0, salary_type: form.salary_type, joined_date: form.joined_date || null };

    const res = await fetch("/api/staff", {
      method: editMember ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editMember ? { id: editMember.id, ...payload } : payload),
    });
    const data = await res.json();
    if (!res.ok) { setFormError(data.error ?? "Failed to save"); setSaving(false); return; }

    if (editMember) {
      setStaff((prev) => prev.map((s) => s.id === editMember.id ? data.staff : s));
    } else {
      setStaff((prev) => [data.staff, ...prev]);
    }
    setAddOpen(false);
    setSaving(false);
  }

  async function deactivate(id: string) {
    await fetch(`/api/staff?id=${id}&shop_id=${shopId}`, { method: "DELETE" });
    setStaff((prev) => prev.map((s) => s.id === id ? { ...s, is_active: false } : s));
  }

  async function saveSalary(e: React.FormEvent) {
    e.preventDefault();
    if (!salaryStaff) return;
    setSavingSalary(true);
    const res = await fetch("/api/salary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop_id: shopId, staff_id: salaryStaff.id, amount: parseFloat(salaryForm.amount), period_label: salaryForm.period_label, payment_method: salaryForm.payment_method, notes: salaryForm.notes || null }),
    });
    const data = await res.json();
    if (res.ok) {
      setSalaryPayments((prev) => [{ ...data.payment, shop_staff: { name: salaryStaff.name, role: salaryStaff.role } }, ...prev]);
      setSalaryOpen(false);
    }
    setSavingSalary(false);
  }

  async function saveLeave(e: React.FormEvent) {
    e.preventDefault();
    if (!leaveStaff) return;
    setSavingLeave(true);
    const res = await fetch("/api/leaves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop_id: shopId, staff_id: leaveStaff.id, ...leaveForm }),
    });
    const data = await res.json();
    if (res.ok) {
      setLeaves((prev) => [data.leave, ...prev]);
      setLeaveOpen(false);
    }
    setSavingLeave(false);
  }

  async function updateLeaveStatus(id: string, status: LeaveStatus) {
    setUpdatingLeaveId(id);
    const res = await fetch("/api/leaves", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, shop_id: shopId, status }),
    });
    if (res.ok) setLeaves((prev) => prev.map((l) => l.id === id ? { ...l, status } : l));
    setUpdatingLeaveId(null);
  }

  const activeStaff = useMemo(() => staff.filter((s) => s.is_active), [staff]);
  const pendingLeaves = useMemo(() => leaves.filter((l) => l.status === "pending"), [leaves]);

  const roleGroups = useMemo(() => ({
    admin: activeStaff.filter((s) => s.role === "admin"),
    manager: activeStaff.filter((s) => s.role === "manager"),
    staff: activeStaff.filter((s) => s.role === "staff"),
  }), [activeStaff]);

  const totalMonthlySalary = useMemo(() =>
    activeStaff.reduce((sum, s) => sum + (s.salary_type === "monthly" ? s.salary_amount : 0), 0),
  [activeStaff]);

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Team</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{activeStaff.length} active members</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          + Add Member
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["admin", "manager", "staff"] as Role[]).map((role) => (
          <div key={role} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4">
            <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">{role}s</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-1">{roleGroups[role].length}</p>
            <div className={`inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_CONFIG[role].color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${ROLE_CONFIG[role].dot}`} />
              {ROLE_CONFIG[role].label}
            </div>
          </div>
        ))}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4">
          <p className="text-xs text-gray-400 dark:text-gray-500">Monthly Salary</p>
          <p className="text-xl font-bold text-gray-800 dark:text-gray-100 mt-1">{symbol}{totalMonthlySalary.toLocaleString("en-IN")}</p>
          {pendingLeaves.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">{pendingLeaves.length} leave pending</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-0.5 w-fit">
        {([
          { key: "members", label: "Team Members", icon: "👥" },
          { key: "salary", label: "Salary", icon: "💰" },
          { key: "leaves", label: "Leaves", icon: "🌿" },
        ] as { key: typeof tab; label: string; icon: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t.key
                ? "bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            <span>{t.icon}</span> {t.label}
            {t.key === "leaves" && pendingLeaves.length > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingLeaves.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── MEMBERS TAB ── */}
      {tab === "members" && (
        <div className="space-y-4">
          {(["admin", "manager", "staff"] as Role[]).map((role) => (
            roleGroups[role].length > 0 && (
              <div key={role}>
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">{ROLE_CONFIG[role].label}s</p>
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-50 dark:divide-gray-800">
                  {roleGroups[role].map((member) => (
                    <div key={member.id} className="flex items-center gap-4 px-5 py-4">
                      <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-sm font-bold text-orange-600 dark:text-orange-400 shrink-0">
                        {initials(member.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{member.name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_CONFIG[member.role].color}`}>
                            {ROLE_CONFIG[member.role].label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {member.phone ?? member.email ?? "—"}
                          {member.joined_date && ` · Joined ${fmt(member.joined_date)}`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          {symbol}{member.salary_amount.toLocaleString("en-IN")}
                          <span className="text-xs font-normal text-gray-400 dark:text-gray-500">/{member.salary_type === "monthly" ? "mo" : member.salary_type === "weekly" ? "wk" : "day"}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          title="Pay Salary"
                          onClick={() => { setSalaryStaff(member); setSalaryForm({ amount: String(member.salary_amount), period_label: CURRENT_PERIOD, payment_method: "cash", notes: "" }); setSalaryOpen(true); }}
                          className="p-2 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                        >💰</button>
                        <button
                          title="Add Leave"
                          onClick={() => { setLeaveStaff(member); setLeaveForm({ leave_type: "casual", start_date: todayIso(), end_date: todayIso(), reason: "" }); setLeaveOpen(true); }}
                          className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >🌿</button>
                        <button
                          title="Edit"
                          onClick={() => openEdit(member)}
                          className="p-2 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                        >✏️</button>
                        <button
                          title="Deactivate"
                          onClick={() => deactivate(member.id)}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
          {activeStaff.length === 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-12 text-center">
              <p className="text-3xl mb-3">👥</p>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">No team members yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Add admin, manager or staff to get started</p>
            </div>
          )}
        </div>
      )}

      {/* ── SALARY TAB ── */}
      {tab === "salary" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">{salaryPayments.length} payment records</p>
            <button
              onClick={() => { setSalaryStaff(null); setSalaryForm({ amount: "", period_label: CURRENT_PERIOD, payment_method: "cash", notes: "" }); setSalaryOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              + Record Payment
            </button>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            {salaryPayments.length === 0 ? (
              <p className="p-12 text-center text-sm text-gray-400 dark:text-gray-500">No salary payments recorded yet</p>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {salaryPayments.map((p) => (
                  <div key={p.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-sm shrink-0">💰</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{p.shop_staff?.name ?? "—"}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {p.period_label} · {p.payment_method.toUpperCase()}
                        {p.notes && ` · ${p.notes}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-green-600 dark:text-green-400">{symbol}{Number(p.amount).toLocaleString("en-IN")}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{fmt(p.paid_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── LEAVES TAB ── */}
      {tab === "leaves" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">{leaves.length} leave records</p>
            <button
              onClick={() => { setLeaveStaff(null); setLeaveForm({ leave_type: "casual", start_date: todayIso(), end_date: todayIso(), reason: "" }); setLeaveOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              + Add Leave
            </button>
          </div>

          {pendingLeaves.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-3">⏳ Pending Approval</p>
              <div className="space-y-2">
                {pendingLeaves.map((leave) => (
                  <div key={leave.id} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl px-4 py-3 border border-amber-100 dark:border-amber-900">
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{leave.shop_staff?.name ?? "—"}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold mr-1 ${LEAVE_TYPE_COLORS[leave.leave_type]}`}>
                          {leave.leave_type}
                        </span>
                        {fmt(leave.start_date)} – {fmt(leave.end_date)} · {leaveDays(leave.start_date, leave.end_date)} day{leaveDays(leave.start_date, leave.end_date) !== 1 ? "s" : ""}
                      </p>
                      {leave.reason && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 italic">{leave.reason}</p>}
                    </div>
                    <div className="flex gap-2 shrink-0 ml-3">
                      <button
                        onClick={() => updateLeaveStatus(leave.id, "approved")}
                        disabled={updatingLeaveId === leave.id}
                        className="px-3 py-1.5 text-xs font-semibold bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50"
                      >Approve</button>
                      <button
                        onClick={() => updateLeaveStatus(leave.id, "rejected")}
                        disabled={updatingLeaveId === leave.id}
                        className="px-3 py-1.5 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50"
                      >Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            {leaves.length === 0 ? (
              <p className="p-12 text-center text-sm text-gray-400 dark:text-gray-500">No leave records yet</p>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {leaves.map((leave) => (
                  <div key={leave.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm shrink-0">🌿</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{leave.shop_staff?.name ?? "—"}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${LEAVE_TYPE_COLORS[leave.leave_type]}`}>
                          {leave.leave_type}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[leave.status]}`}>
                          {leave.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {fmt(leave.start_date)} – {fmt(leave.end_date)} · {leaveDays(leave.start_date, leave.end_date)} day{leaveDays(leave.start_date, leave.end_date) !== 1 ? "s" : ""}
                        {leave.reason && ` · ${leave.reason}`}
                      </p>
                    </div>
                    {leave.status === "pending" && (
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => updateLeaveStatus(leave.id, "approved")} disabled={updatingLeaveId === leave.id} className="px-2.5 py-1 text-xs font-semibold bg-green-500 text-white rounded-lg disabled:opacity-50">✓</button>
                        <button onClick={() => updateLeaveStatus(leave.id, "rejected")} disabled={updatingLeaveId === leave.id} className="px-2.5 py-1 text-xs font-semibold bg-red-500 text-white rounded-lg disabled:opacity-50">✕</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ADD / EDIT STAFF MODAL ── */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-50">{editMember ? "Edit Member" : "Add Team Member"}</h3>
              <button onClick={() => setAddOpen(false)} className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700">✕</button>
            </div>
            <form onSubmit={saveStaff} className="space-y-3">
              <input required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              <input type="email" placeholder="Email (optional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              <input type="tel" placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400" />

              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium">Role</p>
                <div className="flex gap-2">
                  {(["admin", "manager", "staff"] as Role[]).map((r) => (
                    <button key={r} type="button" onClick={() => setForm({ ...form, role: r })}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${form.role === r ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-orange-300"}`}>
                      {ROLE_CONFIG[r].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">Salary</p>
                  <div className="flex">
                    <span className="px-3 py-2.5 bg-gray-100 dark:bg-gray-800 border border-r-0 border-gray-200 dark:border-gray-700 rounded-l-xl text-sm text-gray-500">{symbol}</span>
                    <input type="number" min="0" placeholder="0" value={form.salary_amount} onChange={(e) => setForm({ ...form, salary_amount: e.target.value })}
                      className="flex-1 px-3 py-2.5 rounded-r-xl border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">Type</p>
                  <select value={form.salary_type} onChange={(e) => setForm({ ...form, salary_type: e.target.value as SalaryType })}
                    className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400">
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="daily">Daily</option>
                  </select>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">Joined Date</p>
                <input type="date" value={form.joined_date} onChange={(e) => setForm({ ...form, joined_date: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>

              {formError && <p className="text-xs text-red-500 text-center">{formError}</p>}
              <button type="submit" disabled={saving}
                className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold disabled:opacity-60 transition-colors">
                {saving ? "Saving…" : editMember ? "Update Member" : "Add Member"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── SALARY PAYMENT MODAL ── */}
      {salaryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-50">Record Salary Payment</h3>
                {salaryStaff && <p className="text-sm text-gray-400 dark:text-gray-500">{salaryStaff.name} · {ROLE_CONFIG[salaryStaff.role].label}</p>}
              </div>
              <button onClick={() => setSalaryOpen(false)} className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">✕</button>
            </div>
            <form onSubmit={saveSalary} className="space-y-3">
              {!salaryStaff && (
                <select required value="" onChange={(e) => setSalaryStaff(activeStaff.find((s) => s.id === e.target.value) ?? null)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="">Select staff member</option>
                  {activeStaff.map((s) => <option key={s.id} value={s.id}>{s.name} ({ROLE_CONFIG[s.role].label})</option>)}
                </select>
              )}
              <div className="flex">
                <span className="px-3 py-2.5 bg-gray-100 dark:bg-gray-800 border border-r-0 border-gray-200 dark:border-gray-700 rounded-l-xl text-sm text-gray-500">{symbol}</span>
                <input required type="number" min="0" placeholder="Amount" value={salaryForm.amount} onChange={(e) => setSalaryForm({ ...salaryForm, amount: e.target.value })}
                  className="flex-1 px-3 py-2.5 rounded-r-xl border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <input required placeholder="Period (e.g. August 2026)" value={salaryForm.period_label} onChange={(e) => setSalaryForm({ ...salaryForm, period_label: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              <select value={salaryForm.payment_method} onChange={(e) => setSalaryForm({ ...salaryForm, payment_method: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
                <option value="upi">UPI</option>
              </select>
              <input placeholder="Notes (optional)" value={salaryForm.notes} onChange={(e) => setSalaryForm({ ...salaryForm, notes: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              <button type="submit" disabled={savingSalary}
                className="w-full py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold disabled:opacity-60 transition-colors">
                {savingSalary ? "Saving…" : "Record Payment"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── LEAVE MODAL ── */}
      {leaveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-50">Add Leave</h3>
                {leaveStaff && <p className="text-sm text-gray-400 dark:text-gray-500">{leaveStaff.name}</p>}
              </div>
              <button onClick={() => setLeaveOpen(false)} className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">✕</button>
            </div>
            <form onSubmit={saveLeave} className="space-y-3">
              {!leaveStaff && (
                <select required value="" onChange={(e) => setLeaveStaff(activeStaff.find((s) => s.id === e.target.value) ?? null)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="">Select staff member</option>
                  {activeStaff.map((s) => <option key={s.id} value={s.id}>{s.name} ({ROLE_CONFIG[s.role].label})</option>)}
                </select>
              )}
              <select value={leaveForm.leave_type} onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value as LeaveType })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="casual">Casual Leave</option>
                <option value="sick">Sick Leave</option>
                <option value="emergency">Emergency Leave</option>
                <option value="unpaid">Unpaid Leave</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">From</p>
                  <input required type="date" value={leaveForm.start_date} onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">To</p>
                  <input required type="date" value={leaveForm.end_date} min={leaveForm.start_date} onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
              </div>
              {leaveForm.start_date && leaveForm.end_date && (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  {leaveDays(leaveForm.start_date, leaveForm.end_date)} day{leaveDays(leaveForm.start_date, leaveForm.end_date) !== 1 ? "s" : ""}
                </p>
              )}
              <textarea placeholder="Reason (optional)" value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} rows={2}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
              <button type="submit" disabled={savingLeave}
                className="w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold disabled:opacity-60 transition-colors">
                {savingLeave ? "Saving…" : "Add Leave"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
