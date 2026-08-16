"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Shop = {
  id: string; name: string; tagline: string | null; logo_url: string | null;
  banner_url: string | null; banner_height_px: number | null;
  primary_color: string | null; currency: string | null; ordering_enabled: boolean | null;
};
type Category = { id: string; name: string; sort_order: number };
type Product = {
  id: string; name: string; description: string | null; price: number;
  image_url: string | null; is_veg: boolean; category_id: string | null; sort_order: number;
};
type Table = { id: string; table_number: string; label: string | null };
type CartItem = { product_id: string; name: string; price: number; quantity: number; is_veg: boolean };
type Theme = "light" | "dark" | "system";

const CURRENCY_SYMBOL: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "د.إ" };

function getContrastText(hex: string): string {
  const clean = hex.replace("#", "");
  if (clean.length < 6) return "#ffffff";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? "#111111" : "#ffffff";
}
function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export function MenuPage({ shop, shopSlug, categories, products, tables }: {
  shop: Shop; shopSlug: string; categories: Category[]; products: Product[]; tables: Table[];
}) {
  const router = useRouter();
  const color = shop.primary_color ?? "#6B3A2A";
  const textColor = getContrastText(color);
  const symbol = CURRENCY_SYMBOL[shop.currency ?? "INR"] ?? "₹";

  // ── Search / filter ──
  const [search, setSearch] = useState("");
  const [vegFilter, setVegFilter] = useState<"all" | "veg" | "nonveg">("all");

  // ── Category scrollspy ──
  const [activeCat, setActiveCat] = useState<string>(categories[0]?.id ?? "");
  const catRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const catTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // ── Cart ──
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartStep, setCartStep] = useState<"items" | "details">("items");
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway">("dine_in");
  const [tableId, setTableId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  // ── Auth ──
  const [profileOpen, setProfileOpen] = useState(false);
  const [savedProfile, setSavedProfile] = useState<{ name: string; phone: string; email?: string; avatar?: string } | null>(null);
  const [authMode, setAuthMode] = useState<"options" | "signin" | "signup">("options");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // ── Theme ──
  const [theme, setTheme] = useState<Theme>("system");
  const [themeOpen, setThemeOpen] = useState(false);

  const supabase = createClient();

  // Apply theme to <html>
  const applyTheme = useCallback((t: Theme) => {
    const html = document.documentElement;
    if (t === "dark") { html.classList.add("dark"); }
    else if (t === "light") { html.classList.remove("dark"); }
    else {
      html.classList.toggle("dark", window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
  }, []);

  useEffect(() => {
    const saved = (localStorage.getItem("zenz-theme") as Theme) ?? "system";
    setTheme(saved);
    applyTheme(saved);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => { if (theme === "system") applyTheme("system"); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  function changeTheme(t: Theme) {
    setTheme(t);
    localStorage.setItem("zenz-theme", t);
    applyTheme(t);
    setThemeOpen(false);
  }

  // ── Auth init ──
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const p = { name: user.user_metadata?.full_name ?? user.email ?? "", phone: "", email: user.email ?? "", avatar: user.user_metadata?.avatar_url ?? "" };
        setSavedProfile(p); setCustomerName(p.name);
        fetch("/api/customer/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shop_id: shop.id }) }).catch(() => {});
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        const u = session.user;
        const p = { name: u.user_metadata?.full_name ?? u.email ?? "", phone: "", email: u.email ?? "", avatar: u.user_metadata?.avatar_url ?? "" };
        setSavedProfile(p); setCustomerName(p.name);
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          fetch("/api/customer/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shop_id: shop.id }) }).catch(() => {});
        }
      } else { setSavedProfile(null); setCustomerName(""); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=${window.location.pathname}` } });
  }
  async function clearProfile() {
    await supabase.auth.signOut(); setSavedProfile(null); setCustomerName("");
    setProfileOpen(false); setAuthMode("options");
  }
  function openProfile() {
    setAuthMode("options"); setAuthError(null); setAuthSuccess(null);
    setAuthEmail(""); setAuthPassword(""); setAuthName(""); setProfileOpen(true);
  }
  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault(); setAuthError(null); setAuthSuccess(null); setAuthLoading(true);
    if (authMode === "signup") {
      const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword, options: { data: { full_name: authName } } });
      if (error) setAuthError(error.message); else setAuthSuccess("Check your email to confirm, then sign in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      if (error) setAuthError(error.message); else setProfileOpen(false);
    }
    setAuthLoading(false);
  }

  // ── Active order ──
  useEffect(() => {
    const stored = localStorage.getItem(`zenz-order-${shopSlug}`);
    if (!stored) return;
    try {
      const { orderId, placedAt } = JSON.parse(stored);
      if (Date.now() - placedAt >= 2 * 60 * 60 * 1000) { localStorage.removeItem(`zenz-order-${shopSlug}`); return; }
      fetch(`/api/orders/track?id=${orderId}`).then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (!data || data.status === "completed" || data.status === "cancelled") localStorage.removeItem(`zenz-order-${shopSlug}`);
          else setActiveOrderId(orderId);
        }).catch(() => setActiveOrderId(orderId));
    } catch { localStorage.removeItem(`zenz-order-${shopSlug}`); }
  }, [shopSlug]);

  // ── Scrollspy ──
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          const id = visible[0].target.id;
          setActiveCat(id);
          catTabRefs.current[id]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        }
      },
      { rootMargin: "-20% 0px -65% 0px" }
    );
    Object.values(catRefs.current).forEach((el) => { if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [categories]);

  // ── Filtering ──
  const filtered = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase());
    const matchVeg = vegFilter === "all" || (vegFilter === "veg" && p.is_veg) || (vegFilter === "nonveg" && !p.is_veg);
    return matchSearch && matchVeg;
  });

  // ── Cart helpers ──
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  function addToCart(p: Product) {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.product_id === p.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 }; return next; }
      return [...prev, { product_id: p.id, name: p.name, price: p.price, quantity: 1, is_veg: p.is_veg }];
    });
  }
  function removeFromCart(productId: string) {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.product_id === productId);
      if (idx < 0) return prev;
      const next = [...prev];
      if (next[idx].quantity === 1) next.splice(idx, 1); else next[idx] = { ...next[idx], quantity: next[idx].quantity - 1 };
      return next;
    });
  }
  function getQty(productId: string) { return cart.find((c) => c.product_id === productId)?.quantity ?? 0; }

  async function handlePlaceOrder() {
    setPlaceError(null); setPlacing(true);
    const { data: { user } } = await supabase.auth.getUser();
    const res = await fetch("/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop_id: shop.id, items: cart, customer_name: customerName || null, customer_phone: customerPhone || null, table_id: tableId || null, notes: notes || null, order_type: orderType, user_id: user?.id ?? null }),
    });
    const data = await res.json();
    setPlacing(false);
    if (!res.ok) { setPlaceError(data.error ?? "Failed to place order"); return; }
    localStorage.setItem(`zenz-order-${shopSlug}`, JSON.stringify({ orderId: data.orderId, placedAt: Date.now() }));
    setCart([]); setCartOpen(false); setCartStep("items");
    router.push(`/${shopSlug}/order/${data.orderId}`);
  }

  // ── Ordering disabled ──
  if (!shop.ordering_enabled) {
    return (
      <div className="min-h-screen bg-[#faf8f4] dark:bg-[#111111] flex flex-col">
        <Banner shop={shop} color={color} textColor={textColor} savedProfile={savedProfile} onProfile={openProfile} />
        <div className="flex flex-col items-center justify-center flex-1 py-24 text-center px-4">
          <p className="text-4xl mb-3">🚫</p>
          <p className="text-lg font-semibold text-gray-800 dark:text-white">Ordering is currently unavailable</p>
          <p className="text-sm text-gray-500 mt-1">Please check back later or visit us in person.</p>
        </div>
      </div>
    );
  }

  // ── THEME ICON ──
  const ThemeIcon = ({ t }: { t: Theme }) => (
    t === "light" ? <span className="text-base">☀️</span>
    : t === "dark" ? <span className="text-base">🌙</span>
    : <span className="text-base">💻</span>
  );

  return (
    <div className="min-h-screen bg-[#faf8f4] dark:bg-[#111111] pb-28">

      {/* ── Mobile sticky top header ── */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-[#faf8f4]/95 dark:bg-[#111111]/95 backdrop-blur-sm border-b border-gray-200 dark:border-[#1e1e1e]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{shop.name}</span>
            <span className="text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700/50 rounded-full px-2 py-0.5">● Open</span>
          </div>
        </div>
        {/* Theme toggle - mobile */}
        <div className="relative">
          <button
            onClick={() => setThemeOpen(!themeOpen)}
            className="p-2 rounded-xl bg-gray-100 dark:bg-[#1e1e1e] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2a2a2a] transition-colors"
          >
            <ThemeIcon t={theme} />
          </button>
          {themeOpen && <ThemeDropdown theme={theme} changeTheme={changeTheme} ThemeIcon={ThemeIcon} onClose={() => setThemeOpen(false)} />}
        </div>
        {/* Auth button */}
        <button
          onClick={openProfile}
          className="flex items-center gap-1.5 p-2 rounded-xl bg-gray-100 dark:bg-[#1e1e1e] hover:bg-gray-200 dark:hover:bg-[#2a2a2a] transition-colors"
        >
          {savedProfile?.avatar ? (
            <img src={savedProfile.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
          ) : (
            <span className="text-gray-500 dark:text-gray-400 text-sm">👤</span>
          )}
        </button>
        {/* Cart icon on mobile header */}
        {cartCount > 0 && (
          <button
            onClick={() => { setCartOpen(true); setCartStep("items"); }}
            className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white transition-colors"
            style={{ backgroundColor: color }}
          >
            🛒
            <span>{cartCount}</span>
          </button>
        )}
      </div>

      {/* ── Banner ── */}
      <Banner shop={shop} color={color} textColor={textColor} savedProfile={savedProfile} onProfile={openProfile} isDesktop />

      {/* ── Info + Search + Theme (desktop), Info + Search (mobile) ── */}
      <div className="border-b border-gray-200 dark:border-[#1e1e1e] bg-[#faf8f4] dark:bg-[#111111]">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          {/* Shop info — desktop only */}
          <div className="hidden lg:block shrink-0 min-w-0 w-52">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[17px] font-extrabold text-gray-900 dark:text-white leading-tight">{shop.name}</h1>
              <span className="text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700/50 rounded-full px-2 py-0.5">● Open</span>
            </div>
            {shop.tagline && <p className="text-xs text-gray-500 mt-0.5">{shop.tagline}</p>}
          </div>

          {/* Search — full width on mobile, flex-1 on desktop */}
          <div className="flex-1 relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes..."
              className="w-full pl-11 pr-10 py-2.5 rounded-2xl bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-gray-400 dark:focus:border-[#555] transition-colors shadow-sm"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
            )}
          </div>

          {/* Theme toggle — desktop only */}
          <div className="hidden lg:block relative shrink-0">
            <button
              onClick={() => setThemeOpen(!themeOpen)}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#222] transition-colors shadow-sm"
            >
              <ThemeIcon t={theme} />
              <span>{theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
              <span className="text-gray-400 text-xs">▾</span>
            </button>
            {themeOpen && <ThemeDropdown theme={theme} changeTheme={changeTheme} ThemeIcon={ThemeIcon} onClose={() => setThemeOpen(false)} />}
          </div>

          {/* Desktop auth + cart */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            <button
              onClick={openProfile}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#222] transition-colors shadow-sm"
            >
              {savedProfile?.avatar
                ? <img src={savedProfile.avatar} alt="" className="h-5 w-5 rounded-full object-cover" />
                : <span className="text-sm">👤</span>
              }
              <span className="text-xs font-medium max-w-[80px] truncate">{savedProfile?.name ?? "Sign in"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Filter pills ── */}
      <div className="max-w-5xl mx-auto px-4 pt-3 pb-2 flex items-center gap-2">
        {(["all", "veg", "nonveg"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setVegFilter(f)}
            style={vegFilter === f ? { backgroundColor: color, borderColor: color, color: textColor } : {}}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full border text-xs font-bold transition-all ${
              vegFilter === f ? "shadow-sm" : "border-gray-200 dark:border-[#2e2e2e] text-gray-600 dark:text-gray-400 bg-white dark:bg-[#1a1a1a] hover:border-gray-300 dark:hover:border-[#444]"
            }`}
          >
            {f === "all" ? "All" : (<><span className={`h-2 w-2 rounded-full ${f === "veg" ? "bg-green-500" : "bg-red-500"}`} />{f === "veg" ? "Veg" : "Non-veg"}</>)}
          </button>
        ))}
      </div>

      {/* ── Active order banner ── */}
      {activeOrderId && (
        <div className="max-w-5xl mx-auto px-4 pb-2">
          <a href={`/${shopSlug}/order/${activeOrderId}`}
            className="flex items-center justify-between px-4 py-3 rounded-2xl shadow-sm"
            style={{ backgroundColor: color, color: textColor }}
          >
            <div className="flex items-center gap-2.5">
              <span>🛍️</span>
              <div>
                <p className="text-sm font-bold" style={{ color: textColor }}>You have an active order</p>
                <p className="text-xs opacity-75" style={{ color: textColor }}>Tap to track your order status</p>
              </div>
            </div>
            <span className="text-lg" style={{ color: textColor }}>›</span>
          </a>
        </div>
      )}

      {/* ── Category tabs (sticky) ── */}
      {categories.length > 0 && (
        <div className="sticky top-0 lg:top-0 z-20 bg-[#faf8f4]/95 dark:bg-[#111111]/95 backdrop-blur-sm border-b border-gray-200 dark:border-[#1e1e1e] overflow-x-auto scrollbar-hide">
          <div className="max-w-5xl mx-auto flex px-4 gap-1 py-2 min-w-max">
            {categories.map((cat) => {
              const isActive = activeCat === cat.id;
              return (
                <button
                  key={cat.id}
                  ref={(el) => { catTabRefs.current[cat.id] = el; }}
                  onClick={() => { setActiveCat(cat.id); catRefs.current[cat.id]?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                  style={isActive ? { backgroundColor: color, color: textColor } : {}}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    isActive ? "shadow-sm" : "text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-white dark:hover:bg-[#1e1e1e]"
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Menu items ── */}
      <div className="max-w-5xl mx-auto">
        {categories.map((cat) => {
          const items = filtered.filter((p) => p.category_id === cat.id);
          if (!items.length) return null;
          return (
            <div key={cat.id} id={cat.id} ref={(el) => { catRefs.current[cat.id] = el; }}>
              {/* Section header */}
              <div className="px-4 pt-7 pb-3 flex items-center gap-3">
                <div className="h-4 w-1 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <p className="text-sm font-extrabold text-gray-800 dark:text-white tracking-wide uppercase">{cat.name}</p>
                <span className="text-xs text-gray-400 dark:text-gray-600 font-medium">{items.length} {items.length === 1 ? "item" : "items"}</span>
              </div>

              {/* Item rows */}
              <div className="divide-y divide-gray-100 dark:divide-[#1e1e1e]">
                {items.map((p) => {
                  const qty = getQty(p.id);
                  return (
                    <div key={p.id} className="flex gap-4 px-4 py-4 items-start bg-[#faf8f4] dark:bg-[#111111] hover:bg-white dark:hover:bg-[#161616] transition-colors">
                      {/* Left: content */}
                      <div className="flex-1 min-w-0">
                        <span className={`inline-flex h-4 w-4 items-center justify-center rounded-sm border mb-2 ${p.is_veg ? "border-green-500" : "border-red-500"}`}>
                          <span className={`h-2 w-2 rounded-full ${p.is_veg ? "bg-green-500" : "bg-red-500"}`} />
                        </span>
                        <p className="text-[15px] font-bold text-gray-900 dark:text-white leading-snug">{p.name}</p>
                        {p.description && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{p.description}</p>
                        )}
                        <p className="text-[15px] font-bold mt-1.5" style={{ color }}>
                          {symbol}{p.price.toLocaleString("en-IN")}
                        </p>
                        {/* Stepper / ADD */}
                        <div className="mt-3">
                          {qty === 0 ? (
                            <button
                              onClick={() => addToCart(p)}
                              style={{ borderColor: color, color }}
                              className="flex items-center gap-1.5 px-5 py-1.5 rounded-lg border-2 text-xs font-extrabold tracking-wide bg-white dark:bg-transparent hover:opacity-80 transition-opacity"
                            >
                              <span className="text-sm">+</span> ADD
                            </button>
                          ) : (
                            <div className="inline-flex items-center rounded-xl overflow-hidden shadow-md" style={{ backgroundColor: color }}>
                              <button onClick={() => removeFromCart(p.id)} style={{ color: textColor }} className="w-9 h-8 flex items-center justify-center text-lg font-bold hover:opacity-80">−</button>
                              <span style={{ color: textColor }} className="w-7 text-center text-sm font-extrabold">{qty}</span>
                              <button onClick={() => addToCart(p)} style={{ color: textColor }} className="w-9 h-8 flex items-center justify-center text-lg font-bold hover:opacity-80">+</button>
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Right: image */}
                      <div className="shrink-0">
                        <div className="h-[108px] w-[108px] rounded-2xl overflow-hidden bg-gray-100 dark:bg-[#1e1e1e] shadow-sm">
                          {p.image_url
                            ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                            : <div className="h-full w-full flex items-center justify-center text-4xl">{p.is_veg ? "🥗" : "🍗"}</div>
                          }
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-24">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-sm font-medium text-gray-500">No items found for &ldquo;{search}&rdquo;</p>
          </div>
        )}
      </div>

      {/* ── Cart bar ── */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-5 pt-2 bg-gradient-to-t from-[#faf8f4] dark:from-[#0a0a0a] to-transparent pointer-events-none">
          <div className="max-w-5xl mx-auto">
            <button
              onClick={() => { setCartOpen(true); setCartStep("items"); }}
              className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl shadow-xl pointer-events-auto"
              style={{ backgroundColor: color }}
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-sm font-extrabold" style={{ color: textColor }}>{cartCount}</span>
                </div>
                <span className="text-sm font-bold" style={{ color: textColor }}>View Cart</span>
              </div>
              <span className="text-sm font-extrabold" style={{ color: textColor }}>{symbol}{cartTotal.toLocaleString("en-IN")} ›</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Cart drawer (multi-step) ── */}
      {cartOpen && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setCartOpen(false); setCartStep("items"); }} />
          <div className="relative bg-white dark:bg-[#1a1a1a] rounded-t-3xl max-h-[92vh] overflow-y-auto shadow-2xl">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1"><div className="h-1 w-10 rounded-full bg-gray-200 dark:bg-[#333]" /></div>

            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-[#1a1a1a] px-5 py-3.5 flex items-center justify-between border-b border-gray-100 dark:border-[#2a2a2a]">
              <div>
                <h2 className="font-extrabold text-gray-900 dark:text-white text-lg">Your Order</h2>
                <p className="text-xs text-gray-400">{cartCount} item{cartCount !== 1 ? "s" : ""}</p>
              </div>
              <button onClick={() => { setCartOpen(false); setCartStep("items"); }} className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-[#2a2a2a] text-gray-500 dark:text-gray-400 text-sm hover:bg-gray-200 dark:hover:bg-[#333]">✕</button>
            </div>

            <div className="px-5 py-5 space-y-5">
              {/* Step indicator dots */}
              <div className="flex items-center justify-center gap-2">
                <div className="h-1.5 w-8 rounded-full transition-colors" style={{ backgroundColor: color }} />
                <div className="h-1.5 w-8 rounded-full transition-colors" style={{ backgroundColor: cartStep === "details" ? color : "#e5e7eb" }} />
              </div>

              {/* ── STEP 1: Items + Order type ── */}
              {cartStep === "items" && (
                <>
                  {/* Items */}
                  <div className="divide-y divide-gray-100 dark:divide-[#2a2a2a]">
                    {cart.map((item) => (
                      <div key={item.product_id} className="flex items-center gap-3 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{item.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{symbol}{item.price.toLocaleString("en-IN")} each</p>
                        </div>
                        <div className="flex items-center rounded-xl overflow-hidden" style={{ backgroundColor: color }}>
                          <button onClick={() => removeFromCart(item.product_id)} style={{ color: textColor }} className="w-8 h-8 flex items-center justify-center font-bold text-lg hover:opacity-80">−</button>
                          <span style={{ color: textColor }} className="w-6 text-center text-sm font-extrabold">{item.quantity}</span>
                          <button onClick={() => addToCart({ id: item.product_id, name: item.name, price: item.price, is_veg: item.is_veg, category_id: null, description: null, image_url: null, sort_order: 0 })} style={{ color: textColor }} className="w-8 h-8 flex items-center justify-center font-bold text-lg hover:opacity-80">+</button>
                        </div>
                        <p className="text-sm font-bold text-gray-800 dark:text-white w-14 text-right">{symbol}{(item.price * item.quantity).toLocaleString("en-IN")}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between text-sm font-bold text-gray-800 dark:text-white border-t border-dashed border-gray-200 dark:border-[#333] pt-3">
                    <span>Subtotal</span>
                    <span>{symbol}{cartTotal.toLocaleString("en-IN")}</span>
                  </div>

                  {/* Order type */}
                  <div>
                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Order Type</p>
                    <div className="flex gap-2">
                      {(["dine_in", "takeaway"] as const).map((t) => (
                        <button key={t} onClick={() => setOrderType(t)}
                          style={orderType === t ? { backgroundColor: color, borderColor: color, color: textColor } : {}}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${orderType === t ? "" : "border-gray-200 dark:border-[#333] text-gray-500 dark:text-gray-400"}`}
                        >
                          {t === "dine_in" ? "🍽 Dine In" : "📦 Takeaway"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Table selector */}
                  {orderType === "dine_in" && tables.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Select Table</p>
                      <select value={tableId} onChange={(e) => setTableId(e.target.value)}
                        className="w-full px-3 py-2.5 bg-gray-50 dark:bg-[#111] border-2 border-gray-200 dark:border-[#333] rounded-xl text-sm text-gray-800 dark:text-white focus:outline-none">
                        <option value="">Choose your table...</option>
                        {tables.map((t) => <option key={t.id} value={t.id}>Table {t.table_number}{t.label ? ` — ${t.label}` : ""}</option>)}
                      </select>
                    </div>
                  )}

                  <button onClick={() => setCartStep("details")}
                    className="w-full py-4 rounded-2xl font-extrabold text-sm shadow-md transition-opacity hover:opacity-90"
                    style={{ backgroundColor: color, color: textColor }}
                  >
                    Next →
                  </button>
                </>
              )}

              {/* ── STEP 2: Customer details ── */}
              {cartStep === "details" && (
                <>
                  <button onClick={() => setCartStep("items")} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                    ← Back
                  </button>

                  <div>
                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Your Details <span className="normal-case font-normal text-gray-400">(optional)</span></p>
                    <div className="space-y-3">
                      <input type="text" placeholder="Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-[#333] rounded-xl text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-gray-400 dark:focus:border-[#555]" />
                      <input type="tel" placeholder="Phone number" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-[#333] rounded-xl text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-gray-400 dark:focus:border-[#555]" />
                      <textarea placeholder="Special instructions..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-[#333] rounded-xl text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-gray-400 dark:focus:border-[#555] resize-none" />
                    </div>
                  </div>

                  {/* Summary strip */}
                  <div className="flex justify-between items-center px-4 py-3 bg-gray-50 dark:bg-[#111] rounded-xl text-sm">
                    <div>
                      <p className="font-semibold text-gray-700 dark:text-gray-200">{cartCount} item{cartCount !== 1 ? "s" : ""} · {orderType === "dine_in" ? "Dine In" : "Takeaway"}</p>
                    </div>
                    <p className="font-extrabold text-gray-900 dark:text-white">{symbol}{cartTotal.toLocaleString("en-IN")}</p>
                  </div>

                  {placeError && (
                    <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5">
                      <span className="text-red-500 text-sm">⚠</span>
                      <p className="text-sm text-red-600 dark:text-red-400">{placeError}</p>
                    </div>
                  )}

                  <button onClick={handlePlaceOrder} disabled={placing}
                    className="w-full py-4 rounded-2xl font-extrabold text-sm disabled:opacity-60 transition-opacity shadow-lg"
                    style={{ backgroundColor: color, color: textColor }}
                  >
                    {placing ? "Placing order…" : `Place Order · ${symbol}${cartTotal.toLocaleString("en-IN")}`}
                  </button>
                  <p className="text-center text-xs text-gray-400 pb-2">Payment is collected at the counter after service.</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Auth drawer ── */}
      {profileOpen && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setProfileOpen(false)} />
          <div className="relative bg-white dark:bg-[#1a1a1a] rounded-t-3xl shadow-2xl">
            <div className="flex justify-center pt-3 pb-1"><div className="h-1 w-10 rounded-full bg-gray-200 dark:bg-[#333]" /></div>
            <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100 dark:border-[#2a2a2a]">
              <h2 className="font-extrabold text-gray-900 dark:text-white text-lg">{savedProfile ? "My Account" : "Sign In"}</h2>
              <button onClick={() => setProfileOpen(false)} className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-[#2a2a2a] text-gray-500 dark:text-gray-400 text-sm">✕</button>
            </div>
            <div className="px-5 py-6 space-y-4">
              {savedProfile ? (
                <>
                  <div className="flex items-center gap-4 bg-gray-50 dark:bg-[#222] rounded-2xl px-4 py-4">
                    {savedProfile.avatar
                      ? <img src={savedProfile.avatar} alt="" className="h-12 w-12 rounded-full object-cover shrink-0" />
                      : <div className="h-12 w-12 rounded-full flex items-center justify-center font-bold text-base shrink-0" style={{ backgroundColor: color, color: textColor }}>{initials(savedProfile.name || "?")}</div>
                    }
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{savedProfile.name}</p>
                      <p className="text-xs text-gray-500 truncate">{savedProfile.email}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 text-center">Show your order to the cashier to earn a stamp on your loyalty card.</p>
                  <button onClick={clearProfile} className="w-full py-3 rounded-2xl font-semibold text-sm text-red-500 border border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">Sign Out</button>
                </>
              ) : authMode === "options" ? (
                <>
                  <p className="text-sm text-gray-500 text-center">Sign in to earn loyalty stamps and claim rewards.</p>
                  <button onClick={signInWithGoogle} className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl font-semibold text-sm bg-white dark:bg-[#222] text-gray-800 dark:text-white border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition-colors">
                    <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    Continue with Google
                  </button>
                  <div className="flex items-center gap-3"><div className="flex-1 h-px bg-gray-100 dark:bg-[#333]" /><span className="text-xs text-gray-400">or</span><div className="flex-1 h-px bg-gray-100 dark:bg-[#333]" /></div>
                  <button onClick={() => setAuthMode("signin")} className="w-full py-3.5 rounded-2xl font-semibold text-sm bg-gray-50 dark:bg-[#2a2a2a] text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-[#333] transition-colors">Sign in with Email</button>
                  <button onClick={() => setAuthMode("signup")} className="w-full py-3 rounded-2xl font-semibold text-sm border border-orange-200 dark:border-orange-900 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors">Create Account</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setAuthMode("options"); setAuthError(null); setAuthSuccess(null); }} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-1">← Back</button>
                  <h3 className="text-gray-900 dark:text-white font-bold text-base">{authMode === "signup" ? "Create Account" : "Sign In"}</h3>
                  <form onSubmit={handleEmailAuth} className="space-y-3">
                    {authMode === "signup" && <input type="text" placeholder="Your name" value={authName} onChange={(e) => setAuthName(e.target.value)} required className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-[#222] text-gray-800 dark:text-white text-sm border border-gray-200 dark:border-[#333] placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-orange-400" />}
                    <input type="email" placeholder="Email address" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-[#222] text-gray-800 dark:text-white text-sm border border-gray-200 dark:border-[#333] placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-orange-400" />
                    <input type="password" placeholder="Password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required minLength={6} className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-[#222] text-gray-800 dark:text-white text-sm border border-gray-200 dark:border-[#333] placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-orange-400" />
                    {authError && <p className="text-xs text-red-500 text-center">{authError}</p>}
                    {authSuccess && <p className="text-xs text-green-500 text-center">{authSuccess}</p>}
                    <button type="submit" disabled={authLoading} className="w-full py-3.5 rounded-2xl font-semibold text-sm bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60 transition-colors">
                      {authLoading ? "Please wait…" : authMode === "signup" ? "Create Account" : "Sign In"}
                    </button>
                  </form>
                  <p className="text-xs text-gray-400 text-center">
                    {authMode === "signup" ? "Already have an account? " : "No account? "}
                    <button onClick={() => { setAuthMode(authMode === "signup" ? "signin" : "signup"); setAuthError(null); setAuthSuccess(null); }} className="text-orange-500 hover:underline">{authMode === "signup" ? "Sign in" : "Register"}</button>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeDropdown({ theme, changeTheme, ThemeIcon, onClose }: {
  theme: Theme;
  changeTheme: (t: Theme) => void;
  ThemeIcon: ({ t }: { t: Theme }) => React.ReactElement;
  onClose: () => void;
}) {
  const options: { t: Theme; label: string; desc: string }[] = [
    { t: "light", label: "Light", desc: "Always use light theme" },
    { t: "dark", label: "Dark", desc: "Always use dark theme" },
    { t: "system", label: "System", desc: "Use device theme" },
  ];
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-[#1e1e1e] rounded-2xl border border-gray-100 dark:border-[#2a2a2a] shadow-xl z-20 overflow-hidden">
        <p className="px-4 pt-3 pb-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Theme</p>
        {options.map(({ t, label, desc }) => (
          <button key={t} onClick={() => changeTheme(t)}
            className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition-colors ${theme === t ? "bg-gray-50 dark:bg-[#2a2a2a]" : ""}`}
          >
            <ThemeIcon t={t} />
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-gray-800 dark:text-white">{label}</p>
              <p className="text-xs text-gray-400">{desc}</p>
            </div>
            {theme === t && <span className="text-green-500 text-sm font-bold">✓</span>}
          </button>
        ))}
      </div>
    </>
  );
}

function Banner({ shop, color, textColor, savedProfile, onProfile, isDesktop }: {
  shop: Shop; color: string; textColor: string;
  savedProfile: { name: string; phone: string; email?: string; avatar?: string } | null;
  onProfile: () => void;
  isDesktop?: boolean;
}) {
  return (
    <div className="relative w-full overflow-hidden" style={{ height: 180 }}>
      <div className="absolute inset-0 bg-gray-100 dark:bg-[#1a1a1a]" />
      {shop.banner_url && (
        <img src={shop.banner_url} alt="" className="absolute inset-0 w-full h-full object-cover object-center" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

      {/* Desktop profile button in banner */}
      {isDesktop && (
        <button
          onClick={onProfile}
          className="hidden lg:flex absolute top-4 right-4 z-20 items-center gap-2 rounded-full px-3 py-1.5 backdrop-blur-sm"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        >
          {savedProfile ? (
            <>
              {savedProfile.avatar
                ? <img src={savedProfile.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                : <div className="h-6 w-6 rounded-full flex items-center justify-center font-bold text-[10px]" style={{ backgroundColor: color, color: textColor }}>{savedProfile.name[0]?.toUpperCase()}</div>
              }
              <span className="text-white text-xs font-semibold max-w-[80px] truncate">{savedProfile.name}</span>
            </>
          ) : (
            <>
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              <span className="text-white text-xs font-semibold">Sign in</span>
            </>
          )}
        </button>
      )}

      {/* Logo */}
      <div className="absolute bottom-0 left-5 translate-y-1/2 z-10">
        {shop.logo_url
          ? <img src={shop.logo_url} alt={shop.name} className="h-14 w-14 rounded-full object-cover shadow-xl" style={{ border: "3px solid white" }} />
          : <div className="h-14 w-14 rounded-full shadow-xl flex items-center justify-center font-extrabold text-lg" style={{ backgroundColor: color, border: "3px solid white", color: textColor }}>{shop.name[0]?.toUpperCase()}</div>
        }
      </div>
    </div>
  );
}
