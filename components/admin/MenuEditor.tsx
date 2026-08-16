"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

type Category = {
  id: string;
  shop_id: string;
  name: string;
  sort_order: number;
  complement_enabled: boolean;
};

type Product = {
  id: string;
  shop_id: string;
  category_id: string;
  name: string;
  price: number;
  description: string | null;
  is_veg: boolean;
  is_available: boolean;
  sort_order: number;
};

type ComplementLink = {
  product_id: string;
  complement_id: string;
};

type CategoryModalState =
  | { open: false }
  | { open: true; mode: "add" }
  | { open: true; mode: "edit"; category: Category };

type ProductModalState =
  | { open: false }
  | { open: true; mode: "add"; defaultCategoryId: string }
  | { open: true; mode: "edit"; product: Product };

export function MenuEditor({
  shopId,
  initialCategories,
  initialProducts,
  initialComplements,
}: {
  shopId: string;
  initialCategories: Category[];
  initialProducts: Product[];
  initialComplements: ComplementLink[];
}) {
  const supabase = createClient();

  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [complements, setComplements] = useState<ComplementLink[]>(initialComplements);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(initialCategories.map((c) => c.id))
  );

  const [categoryModal, setCategoryModal] = useState<CategoryModalState>({ open: false });
  const [productModal, setProductModal] = useState<ProductModalState>({ open: false });

  const [categoryName, setCategoryName] = useState("");
  const [categoryComplementEnabled, setCategoryComplementEnabled] = useState(false);

  const [productForm, setProductForm] = useState({
    name: "",
    price: "",
    description: "",
    category_id: "",
    is_veg: true,
    is_available: true,
  });
  const [selectedComplements, setSelectedComplements] = useState<string[]>([]);
  const [complementSearch, setComplementSearch] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Map: product_id → complement product ids
  const complementMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const link of complements) {
      if (!map[link.product_id]) map[link.product_id] = [];
      map[link.product_id].push(link.complement_id);
    }
    return map;
  }, [complements]);

  // Map: product id → product (for quick lookup)
  const productById = useMemo(() => {
    const m: Record<string, Product> = {};
    for (const p of products) m[p.id] = p;
    return m;
  }, [products]);

  // Category of the product being added/edited (to know if complements are enabled)
  const activeCategory = useMemo(() => {
    if (!productModal.open) return null;
    const catId = productModal.mode === "add" ? productModal.defaultCategoryId : productModal.product.category_id;
    return categories.find((c) => c.id === (productForm.category_id || catId)) ?? null;
  }, [productModal, productForm.category_id, categories]);

  // Products available to pick as complements (all products except the one being edited, sorted by category)
  const complementCandidates = useMemo(() => {
    const editingId = productModal.open && productModal.mode === "edit" ? productModal.product.id : null;
    return products.filter((p) => p.id !== editingId && p.is_available);
  }, [products, productModal]);

  const filteredCandidates = useMemo(() => {
    if (!complementSearch.trim()) return complementCandidates;
    const q = complementSearch.toLowerCase();
    return complementCandidates.filter((p) => p.name.toLowerCase().includes(q));
  }, [complementCandidates, complementSearch]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openAddCategory() {
    setCategoryName("");
    setCategoryComplementEnabled(false);
    setError(null);
    setCategoryModal({ open: true, mode: "add" });
  }

  function openEditCategory(category: Category) {
    setCategoryName(category.name);
    setCategoryComplementEnabled(category.complement_enabled);
    setError(null);
    setCategoryModal({ open: true, mode: "edit", category });
  }

  function openAddProduct(categoryId: string) {
    setProductForm({ name: "", price: "", description: "", category_id: categoryId, is_veg: true, is_available: true });
    setSelectedComplements([]);
    setComplementSearch("");
    setError(null);
    setProductModal({ open: true, mode: "add", defaultCategoryId: categoryId });
  }

  function openEditProduct(product: Product) {
    setProductForm({
      name: product.name,
      price: String(product.price),
      description: product.description ?? "",
      category_id: product.category_id,
      is_veg: product.is_veg,
      is_available: product.is_available,
    });
    setSelectedComplements(complementMap[product.id] ?? []);
    setComplementSearch("");
    setError(null);
    setProductModal({ open: true, mode: "edit", product });
  }

  async function handleSaveCategory() {
    if (!categoryName.trim()) return;
    setSaving(true);
    setError(null);

    try {
      if (categoryModal.open && categoryModal.mode === "add") {
        const { data, error: err } = await supabase
          .from("categories")
          .insert({ shop_id: shopId, name: categoryName.trim(), complement_enabled: categoryComplementEnabled })
          .select()
          .single();
        if (err) throw err;
        setCategories((prev) => [...prev, data]);
        setExpandedIds((prev) => new Set([...prev, data.id]));
      } else if (categoryModal.open && categoryModal.mode === "edit") {
        const { error: err } = await supabase
          .from("categories")
          .update({ name: categoryName.trim(), complement_enabled: categoryComplementEnabled })
          .eq("id", categoryModal.category.id);
        if (err) throw err;
        setCategories((prev) =>
          prev.map((c) =>
            c.id === (categoryModal as { open: true; mode: "edit"; category: Category }).category.id
              ? { ...c, name: categoryName.trim(), complement_enabled: categoryComplementEnabled }
              : c
          )
        );
      }
      setCategoryModal({ open: false });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCategory(id: string) {
    if (!confirm("Delete this category? All its items will also be deleted.")) return;
    const { error: err } = await supabase.from("categories").delete().eq("id", id);
    if (err) { alert(err.message); return; }
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setProducts((prev) => prev.filter((p) => p.category_id !== id));
  }

  async function handleSaveProduct() {
    if (!productForm.name.trim() || !productForm.price) return;
    setSaving(true);
    setError(null);

    const payload = {
      shop_id: shopId,
      category_id: productForm.category_id,
      name: productForm.name.trim(),
      price: Number(productForm.price),
      description: productForm.description.trim() || null,
      is_veg: productForm.is_veg,
      is_available: productForm.is_available,
    };

    try {
      let productId: string;

      if (productModal.open && productModal.mode === "add") {
        const { data, error: err } = await supabase.from("products").insert(payload).select().single();
        if (err) throw err;
        setProducts((prev) => [...prev, data]);
        productId = data.id;
      } else if (productModal.open && productModal.mode === "edit") {
        const { error: err } = await supabase.from("products").update(payload).eq("id", productModal.product.id);
        if (err) throw err;
        productId = productModal.product.id;
        setProducts((prev) =>
          prev.map((p) =>
            p.id === productId ? { ...p, ...payload } : p
          )
        );
      } else {
        return;
      }

      // Save complement links
      const targetCategory = categories.find((c) => c.id === productForm.category_id);
      if (targetCategory?.complement_enabled) {
        // Delete old links for this product
        await supabase.from("product_complements").delete().eq("product_id", productId);
        // Insert new links
        if (selectedComplements.length > 0) {
          await supabase.from("product_complements").insert(
            selectedComplements.map((cid) => ({ shop_id: shopId, product_id: productId, complement_id: cid }))
          );
        }
        // Update local state
        setComplements((prev) => [
          ...prev.filter((l) => l.product_id !== productId),
          ...selectedComplements.map((cid) => ({ product_id: productId, complement_id: cid })),
        ]);
      }

      setProductModal({ open: false });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleAvailability(product: Product) {
    const newVal = !product.is_available;
    setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, is_available: newVal } : p));
    const { error: err } = await supabase.from("products").update({ is_available: newVal }).eq("id", product.id);
    if (err) {
      setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, is_available: product.is_available } : p));
      alert(err.message);
    }
  }

  async function handleDeleteProduct(id: string) {
    if (!confirm("Delete this item?")) return;
    const { error: err } = await supabase.from("products").delete().eq("id", id);
    if (err) { alert(err.message); return; }
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setComplements((prev) => prev.filter((l) => l.product_id !== id && l.complement_id !== id));
  }

  function toggleComplement(id: string) {
    setSelectedComplements((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={openAddCategory}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <PlusIcon />
          Add Category
        </button>
        <button
          onClick={() => categories.length > 0 ? openAddProduct(categories[0].id) : undefined}
          disabled={categories.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <PlusIcon />
          Add Item
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
          <span className="text-5xl mb-4">📋</span>
          <p className="text-gray-700 dark:text-gray-200 font-semibold text-lg mb-1">No categories yet</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mb-6">Start by adding your first menu category</p>
          <button
            onClick={openAddCategory}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon />
            Add your first category
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => {
            const catProducts = products.filter((p) => p.category_id === cat.id);
            const expanded = expandedIds.has(cat.id);
            return (
              <div key={cat.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 cursor-pointer select-none" onClick={() => toggleExpand(cat.id)}>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-800 dark:text-gray-100">{cat.name}</span>
                    <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">
                      {catProducts.length} {catProducts.length === 1 ? "item" : "items"}
                    </span>
                    {cat.complement_enabled && (
                      <span className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
                        + Complements
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditCategory(cat); }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <TrashIcon />
                    </button>
                    <span className={`text-gray-400 dark:text-gray-500 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
                      <ChevronDownIcon />
                    </span>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-gray-100 dark:border-gray-800">
                    {catProducts.length === 0 ? (
                      <div className="py-8 flex flex-col items-center text-gray-400 dark:text-gray-500 text-sm">
                        <p>No items in this category</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50 dark:divide-gray-800">
                        {catProducts.map((product) => {
                          const productComplementIds = complementMap[product.id] ?? [];
                          const productComplements = productComplementIds.map((id) => productById[id]).filter(Boolean);
                          return (
                            <div key={product.id} className="px-5 py-3">
                              <div className="flex items-center gap-4">
                                <div className="shrink-0">
                                  {product.is_veg ? (
                                    <span className="block w-4 h-4 rounded-full bg-green-500" />
                                  ) : (
                                    <span className="block w-4 h-4 rounded bg-red-700" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{product.name}</p>
                                  {product.description && (
                                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{product.description}</p>
                                  )}
                                </div>
                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 shrink-0">₹{product.price}</span>
                                <button
                                  onClick={() => handleToggleAvailability(product)}
                                  className={`shrink-0 relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${product.is_available ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"}`}
                                  title={product.is_available ? "Available" : "Unavailable"}
                                >
                                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${product.is_available ? "translate-x-4" : "translate-x-1"}`} />
                                </button>
                                <button
                                  onClick={() => openEditProduct(product)}
                                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                >
                                  <PencilIcon />
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(product.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                >
                                  <TrashIcon />
                                </button>
                              </div>

                              {/* Complement tags */}
                              {productComplements.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2 ml-8">
                                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">Complements:</span>
                                  {productComplements.map((cp) => (
                                    <span key={cp.id} className="inline-flex items-center gap-1 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                                      {cp.is_veg ? "🟢" : "🔴"} {cp.name}
                                      <span className="text-amber-500 dark:text-amber-400 font-semibold">₹{cp.price}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="px-5 py-3 border-t border-gray-50 dark:border-gray-800">
                      <button
                        onClick={() => openAddProduct(cat.id)}
                        className="flex items-center gap-1.5 text-sm text-orange-500 hover:text-orange-600 font-medium transition-colors"
                      >
                        <PlusIcon />
                        Add Item
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── CATEGORY MODAL ── */}
      {categoryModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50 mb-4">
              {categoryModal.mode === "add" ? "Add Category" : "Edit Category"}
            </h2>

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Category name
            </label>
            <input
              type="text"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveCategory()}
              placeholder="e.g. Beverages"
              autoFocus
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            />

            <div className="flex items-center justify-between mt-4 p-3.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Complement Items</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Allow complement upsells on items in this category</p>
              </div>
              <button
                type="button"
                onClick={() => setCategoryComplementEnabled((v) => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none shrink-0 ${categoryComplementEnabled ? "bg-amber-500" : "bg-gray-200 dark:bg-gray-700"}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${categoryComplementEnabled ? "translate-x-4" : "translate-x-1"}`} />
              </button>
            </div>

            {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setCategoryModal({ open: false })}
                disabled={saving}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCategory}
                disabled={saving || !categoryName.trim()}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRODUCT MODAL ── */}
      {productModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50 mb-5">
              {productModal.mode === "add" ? "Add Item" : "Edit Item"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Name</label>
                <input
                  type="text"
                  value={productForm.name}
                  onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Masala Chai"
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Price (₹)</label>
                <input
                  type="number"
                  value={productForm.price}
                  onChange={(e) => setProductForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="0"
                  min={0}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description (optional)</label>
                <textarea
                  value={productForm.description}
                  onChange={(e) => setProductForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Category</label>
                <select
                  value={productForm.category_id}
                  onChange={(e) => {
                    setProductForm((f) => ({ ...f, category_id: e.target.value }));
                    setSelectedComplements([]);
                  }}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}{cat.complement_enabled ? " ✦" : ""}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-6">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Is Veg</label>
                  <button
                    type="button"
                    onClick={() => setProductForm((f) => ({ ...f, is_veg: !f.is_veg }))}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${productForm.is_veg ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${productForm.is_veg ? "translate-x-4" : "translate-x-1"}`} />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Available</label>
                  <button
                    type="button"
                    onClick={() => setProductForm((f) => ({ ...f, is_available: !f.is_available }))}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${productForm.is_available ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${productForm.is_available ? "translate-x-4" : "translate-x-1"}`} />
                  </button>
                </div>
              </div>

              {/* Complement items section — only shown when category has complement_enabled */}
              {activeCategory?.complement_enabled && (
                <div className="border border-amber-200 dark:border-amber-800 rounded-xl overflow-hidden">
                  <div className="bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                      ✦ Complement Items
                      {selectedComplements.length > 0 && (
                        <span className="ml-2 text-xs font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full">{selectedComplements.length}</span>
                      )}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">Select products to suggest when this item is ordered</p>
                  </div>

                  {/* Selected complements chips */}
                  {selectedComplements.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-4 py-2.5 border-b border-amber-100 dark:border-amber-900 bg-white dark:bg-gray-900">
                      {selectedComplements.map((cid) => {
                        const cp = productById[cid];
                        if (!cp) return null;
                        return (
                          <span key={cid} className="inline-flex items-center gap-1 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-1 rounded-full">
                            {cp.name} · ₹{cp.price}
                            <button type="button" onClick={() => toggleComplement(cid)} className="ml-0.5 hover:text-red-500 transition-colors text-amber-500">×</button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="bg-white dark:bg-gray-900 px-4 pt-2 pb-1">
                    <input
                      type="text"
                      placeholder="Search products…"
                      value={complementSearch}
                      onChange={(e) => setComplementSearch(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  </div>

                  <div className="max-h-44 overflow-y-auto bg-white dark:bg-gray-900 divide-y divide-gray-50 dark:divide-gray-800">
                    {filteredCandidates.length === 0 ? (
                      <p className="py-4 text-center text-xs text-gray-400 dark:text-gray-500">No products found</p>
                    ) : (
                      filteredCandidates.map((p) => {
                        const checked = selectedComplements.includes(p.id);
                        const catName = categories.find((c) => c.id === p.category_id)?.name ?? "";
                        return (
                          <label key={p.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${checked ? "bg-amber-50/60 dark:bg-amber-900/10" : ""}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleComplement(p.id)}
                              className="w-3.5 h-3.5 accent-amber-500 shrink-0"
                            />
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${p.is_veg ? "bg-green-500" : "bg-red-700"}`} />
                              <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{p.name}</span>
                              {catName && <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">({catName})</span>}
                            </div>
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 shrink-0">₹{p.price}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setProductModal({ open: false })}
                disabled={saving}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProduct}
                disabled={saving || !productForm.name.trim() || !productForm.price}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" /><path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
