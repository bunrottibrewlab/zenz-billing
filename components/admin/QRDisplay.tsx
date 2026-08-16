"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CafeTable = {
  id: string;
  shop_id: string;
  table_number: number;
  label: string | null;
};

type AddTableModal =
  | { open: false }
  | { open: true };

function qrImageUrl(data: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;
}

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: do nothing silently
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
    >
      {copied ? "Copied!" : "Copy URL"}
    </button>
  );
}

export function QRDisplay({
  shopId,
  shopSlug,
  initialTables,
}: {
  shopId: string;
  shopSlug: string;
  initialTables: CafeTable[];
}) {
  const supabase = createClient();
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const [tables, setTables] = useState<CafeTable[]>(initialTables);
  const [modal, setModal] = useState<AddTableModal>({ open: false });
  const [tableNumber, setTableNumber] = useState("");
  const [tableLabel, setTableLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const menuUrl = `${origin}/${shopSlug}`;

  function openModal() {
    setTableNumber("");
    setTableLabel("");
    setError(null);
    setModal({ open: true });
  }

  function closeModal() {
    setModal({ open: false });
    setError(null);
  }

  async function handleAddTable() {
    const num = parseInt(tableNumber, 10);
    if (!tableNumber || isNaN(num)) {
      setError("Table number is required");
      return;
    }
    setSaving(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("cafe_tables")
      .insert({
        shop_id: shopId,
        table_number: num,
        label: tableLabel.trim() || null,
      })
      .select()
      .single();

    setSaving(false);

    if (err) {
      setError(err.message);
      return;
    }

    setTables((prev) =>
      [...prev, data].sort((a, b) => a.table_number - b.table_number)
    );
    closeModal();
  }

  async function handleDeleteTable(id: string) {
    if (!confirm("Delete this table?")) return;

    const { error: err } = await supabase
      .from("cafe_tables")
      .delete()
      .eq("id", id);

    if (err) {
      alert(err.message);
      return;
    }

    setTables((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Menu QR Codes
        </h2>

        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-6 mb-4 flex flex-col sm:flex-row gap-6 items-start">
          <div className="shrink-0">
            <img
              src={qrImageUrl(menuUrl)}
              alt="Menu QR code"
              width={160}
              height={160}
              className="rounded-lg border border-gray-100 dark:border-gray-800"
            />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Common Menu QR</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 break-all">{menuUrl}</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <CopyButton url={menuUrl} />
              <a
                href={qrImageUrl(menuUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 text-xs font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
              >
                Download PNG
              </a>
            </div>
          </div>
        </div>

        {tables.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tables.map((table) => {
              const tableUrl = `${origin}/${shopSlug}/table/${table.id}`;
              return (
                <div
                  key={table.id}
                  className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-5 flex flex-col items-center gap-3"
                >
                  <img
                    src={qrImageUrl(tableUrl)}
                    alt={`Table ${table.table_number} QR`}
                    width={140}
                    height={140}
                    className="rounded-lg border border-gray-100 dark:border-gray-800"
                  />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                      Table {table.table_number}
                      {table.label ? ` — ${table.label}` : ""}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 break-all">{tableUrl}</p>
                  </div>
                  <a
                    href={qrImageUrl(tableUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                  >
                    Download PNG
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Tables</h2>
          <button
            onClick={openModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon />
            Add Table
          </button>
        </div>

        {tables.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl py-16 flex flex-col items-center text-gray-400 dark:text-gray-500 text-sm">
            <p className="font-medium text-gray-600 dark:text-gray-300 mb-1">No tables yet</p>
            <p>Add your first table to generate a per-table QR code</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl divide-y divide-gray-50 dark:divide-gray-800 overflow-hidden">
            {tables.map((table) => (
              <div
                key={table.id}
                className="flex items-center justify-between px-5 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    Table {table.table_number}
                  </span>
                  {table.label && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">{table.label}</span>
                  )}
                  <span className="text-xs bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 font-medium px-2 py-0.5 rounded-full">
                    Active
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteTable(table.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Delete table"
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50 mb-5">
              Add Table
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Table number
                </label>
                <input
                  type="number"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="e.g. 1"
                  min={1}
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Label (optional)
                </label>
                <input
                  type="text"
                  value={tableLabel}
                  onChange={(e) => setTableLabel(e.target.value)}
                  placeholder="e.g. Window seat"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                />
              </div>
            </div>
            {error && (
              <p className="mt-2 text-xs text-red-500">{error}</p>
            )}
            <div className="flex gap-2 mt-5">
              <button
                onClick={closeModal}
                disabled={saving}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTable}
                disabled={saving || !tableNumber}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
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
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
