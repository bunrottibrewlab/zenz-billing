"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  { value: "cafe", label: "Cafe", icon: "☕" },
  { value: "restaurant", label: "Restaurant", icon: "🍽" },
  { value: "bakery", label: "Bakery", icon: "🥐" },
  { value: "food_truck", label: "Food Truck", icon: "🚚" },
  { value: "bar", label: "Bar / Pub", icon: "🍺" },
  { value: "juice", label: "Juice / Beverages", icon: "🧃" },
  { value: "desserts", label: "Desserts / Ice Cream", icon: "🍦" },
  { value: "other", label: "Other", icon: "📦" },
];

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"];

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

type Step = 1 | 2;

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [shopName, setShopName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [category, setCategory] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [tagline, setTagline] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#F97316");

  function handleShopNameChange(val: string) {
    setShopName(val);
    if (!slugEdited) setSlug(slugify(val));
  }

  async function handleFinish() {
    setError(null);
    setLoading(true);

    const res = await fetch("/api/shops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: shopName,
        slug,
        category,
        currency,
        tagline,
        primary_color: primaryColor,
      }),
    });

    if (!res.ok) {
      const { error: err, code } = await res.json();
      if (code === "23505") {
        setError("That URL slug is already taken. Try a different one.");
        setStep(1);
      } else {
        setError(err ?? "Failed to create shop");
      }
      setLoading(false);
      return;
    }

    router.push(`/admin/${slug}/dashboard`);
    router.refresh();
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-orange-500">ZenZ</span>
          <h1 className="mt-4 text-2xl font-semibold text-gray-900">
            Set up your cafe
          </h1>
          <div className="flex items-center justify-center gap-2 mt-4">
            {([1, 2] as Step[]).map((s) => (
              <div
                key={s}
                className={`h-2 w-10 rounded-full transition-colors ${
                  s <= step ? "bg-orange-500" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-400">Step {step} of 2</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {/* Step 1 — Shop details */}
          {step === 1 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!category) {
                  setError("Please select a category.");
                  return;
                }
                setError(null);
                setStep(2);
              }}
              className="space-y-5"
            >
              <h2 className="text-lg font-semibold text-gray-800">
                Shop details
              </h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shop name
                </label>
                <input
                  type="text"
                  required
                  value={shopName}
                  onChange={(e) => handleShopNameChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Bunrotti Cafe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL slug
                </label>
                <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-orange-500 focus-within:border-transparent">
                  <span className="bg-gray-50 text-gray-400 text-sm px-3 py-2 border-r border-gray-300 whitespace-nowrap">
                    zenz.app/
                  </span>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => {
                      setSlugEdited(true);
                      setSlug(slugify(e.target.value));
                    }}
                    className="flex-1 px-3 py-2 text-sm focus:outline-none"
                    placeholder="bunrotti-cafe"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setCategory(cat.value)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-medium transition-colors ${
                        category === cat.value
                          ? "border-orange-500 bg-orange-50 text-orange-600"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      <span className="text-xl">{cat.icon}</span>
                      <span className="leading-tight text-center">
                        {cat.label}
                      </span>
                    </button>
                  ))}
                </div>
                {error && (
                  <p className="text-sm text-red-600 mt-2">{error}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-full transition-colors"
              >
                Continue
              </button>
            </form>
          )}

          {/* Step 2 — Branding */}
          {step === 2 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleFinish();
              }}
              className="space-y-4"
            >
              <h2 className="text-lg font-semibold text-gray-800">Branding</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tagline{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Great coffee, better vibes"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-16 rounded-lg border border-gray-300 cursor-pointer"
                  />
                  <span className="text-sm text-gray-500 font-mono">
                    {primaryColor}
                  </span>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60 rounded-full transition-colors"
                >
                  {loading ? "Creating your cafe…" : "Create my cafe"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
