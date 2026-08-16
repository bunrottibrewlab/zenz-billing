"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type LoyaltyProgram = {
  id: string;
  shop_id: string;
  active: boolean;
  stamps_per_visit: number;
  checkins_per_day: number | null;
  no_daily_limit: boolean;
  min_gap_minutes: number;
};

type LoyaltyReward = {
  id: string;
  program_id: string;
  shop_id: string;
  stamps_required: number;
  reward_name: string;
  reward_description: string | null;
  expiry_days: number;
};

type GapOption = "none" | "1h" | "4h" | "8h" | "custom";

function gapToOption(minutes: number): GapOption {
  if (minutes === 0) return "none";
  if (minutes === 60) return "1h";
  if (minutes === 240) return "4h";
  if (minutes === 480) return "8h";
  return "custom";
}

function optionToMinutes(option: GapOption, custom: number): number {
  if (option === "none") return 0;
  if (option === "1h") return 60;
  if (option === "4h") return 240;
  if (option === "8h") return 480;
  return custom;
}

function StampCircle({ filled }: { filled: boolean }) {
  return (
    <div
      className={`w-9 h-9 rounded-full flex items-center justify-center text-base transition-colors ${
        filled
          ? "bg-orange-400 text-white"
          : "border-2 border-dashed border-gray-300 text-gray-300"
      }`}
    >
      {filled ? "☕" : ""}
    </div>
  );
}

function PhonePreview({
  stampsPerVisit,
  rewards,
}: {
  stampsPerVisit: number;
  rewards: LoyaltyReward[];
}) {
  const firstReward = rewards[0];
  const totalStamps = firstReward?.stamps_required ?? 10;
  const filledCount = Math.min(stampsPerVisit, totalStamps);

  return (
    <div className="flex justify-center">
      <div className="w-64 bg-white rounded-3xl border-4 border-gray-800 shadow-2xl overflow-hidden">
        <div className="bg-gray-800 h-5 flex items-center justify-center">
          <div className="w-16 h-2 bg-gray-600 rounded-full" />
        </div>
        <div className="p-4 bg-orange-50 min-h-96">
          <div className="text-center mb-4">
            <p className="text-base font-bold text-gray-800">☕ Stamp Card</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Collect stamps, earn rewards
            </p>
          </div>

          <div className="bg-white rounded-2xl p-3 mb-4 shadow-sm">
            <p className="text-xs text-gray-400 mb-2 font-medium">
              Your stamps
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {Array.from({ length: totalStamps }).map((_, i) => (
                <StampCircle key={i} filled={i < filledCount} />
              ))}
            </div>
            <p className="text-xs text-center text-gray-400 mt-2">
              {filledCount} / {totalStamps} stamps
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-600 mb-1">
              Rewards
            </p>
            {rewards.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">
                No rewards yet
              </p>
            )}
            {rewards.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-xl p-2.5 shadow-sm flex justify-between items-center"
              >
                <div>
                  <p className="text-xs font-semibold text-gray-800">
                    {r.reward_name}
                  </p>
                  <p className="text-xs text-orange-500">
                    {r.stamps_required} stamps
                  </p>
                </div>
                {r.expiry_days > 0 && (
                  <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">
                    {r.expiry_days}d
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="bg-gray-800 h-6 flex items-center justify-center">
          <div className="w-8 h-1 bg-gray-600 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function StampCardConfig({
  shopId,
  initialProgram,
  initialRewards,
}: {
  shopId: string;
  shopSlug: string;
  initialProgram: LoyaltyProgram | null;
  initialRewards: LoyaltyReward[];
}) {
  const supabase = createClient();

  const [active, setActive] = useState(initialProgram?.active ?? false);
  const [stampsPerVisit, setStampsPerVisit] = useState(
    initialProgram?.stamps_per_visit ?? 1
  );
  const [checkinsPerDay, setCheckinsPerDay] = useState(
    initialProgram?.checkins_per_day ?? 1
  );
  const [noDailyLimit, setNoDailyLimit] = useState(
    initialProgram?.no_daily_limit ?? false
  );
  const [gapOption, setGapOption] = useState<GapOption>(
    gapToOption(initialProgram?.min_gap_minutes ?? 0)
  );
  const [customMinutes, setCustomMinutes] = useState(
    initialProgram?.min_gap_minutes &&
      gapToOption(initialProgram.min_gap_minutes) === "custom"
      ? initialProgram.min_gap_minutes
      : 30
  );

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const [rewards, setRewards] = useState<LoyaltyReward[]>(initialRewards);
  const [showAddModal, setShowAddModal] = useState(false);
  const [rewardForm, setRewardForm] = useState({
    stamps_required: 10,
    reward_name: "",
    reward_description: "",
    expiry_days: 0,
  });
  const [addingReward, setAddingReward] = useState(false);
  const [addRewardMsg, setAddRewardMsg] = useState("");

  async function saveSettings() {
    if (!initialProgram) return;
    setSaving(true);
    setSaveMsg("");
    const minGap = optionToMinutes(gapOption, customMinutes);
    const { error } = await supabase
      .from("loyalty_programs")
      .update({
        active,
        stamps_per_visit: stampsPerVisit,
        checkins_per_day: noDailyLimit ? null : checkinsPerDay,
        no_daily_limit: noDailyLimit,
        min_gap_minutes: minGap,
      })
      .eq("shop_id", shopId);
    setSaveMsg(error ? error.message : "Settings saved");
    setSaving(false);
  }

  async function deleteReward(id: string) {
    await supabase.from("loyalty_rewards").delete().eq("id", id);
    setRewards((prev) => prev.filter((r) => r.id !== id));
  }

  async function addReward() {
    if (!rewardForm.reward_name.trim()) {
      setAddRewardMsg("Reward name is required");
      return;
    }
    if (!initialProgram) return;
    setAddingReward(true);
    setAddRewardMsg("");
    const { data, error } = await supabase
      .from("loyalty_rewards")
      .insert({
        program_id: initialProgram.id,
        shop_id: shopId,
        stamps_required: rewardForm.stamps_required,
        reward_name: rewardForm.reward_name.trim(),
        reward_description: rewardForm.reward_description.trim() || null,
        expiry_days: rewardForm.expiry_days,
      })
      .select()
      .single();
    if (error) {
      setAddRewardMsg(error.message);
    } else if (data) {
      setRewards((prev) =>
        [...prev, data as LoyaltyReward].sort(
          (a, b) => a.stamps_required - b.stamps_required
        )
      );
      setShowAddModal(false);
      setRewardForm({
        stamps_required: 10,
        reward_name: "",
        reward_description: "",
        expiry_days: 0,
      });
    }
    setAddingReward(false);
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">
        Stamp Card Loyalty
      </h1>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-6">
          <section className="bg-white border border-gray-100 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-semibold text-gray-800">
                  Program Settings
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Configure how stamps are earned
                </p>
              </div>
              <button
                onClick={() => {
                  setActive((v) => !v);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  active ? "bg-orange-500" : "bg-gray-200"
                }`}
                role="switch"
                aria-checked={active}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    active ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stamps per visit
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      setStampsPerVisit((v) => Math.max(1, v - 1))
                    }
                    className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold transition-colors"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-semibold text-gray-800">
                    {stampsPerVisit}
                  </span>
                  <button
                    onClick={() =>
                      setStampsPerVisit((v) => Math.min(5, v + 1))
                    }
                    className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Daily check-in limit
                </label>
                <div className="flex items-center gap-3 mb-2">
                  <button
                    onClick={() =>
                      setCheckinsPerDay((v) => Math.max(1, v - 1))
                    }
                    disabled={noDailyLimit}
                    className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold transition-colors disabled:opacity-40"
                  >
                    −
                  </button>
                  <span
                    className={`w-8 text-center text-sm font-semibold ${
                      noDailyLimit ? "text-gray-300" : "text-gray-800"
                    }`}
                  >
                    {checkinsPerDay}
                  </span>
                  <button
                    onClick={() => setCheckinsPerDay((v) => v + 1)}
                    disabled={noDailyLimit}
                    className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold transition-colors disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={noDailyLimit}
                    onChange={(e) => setNoDailyLimit(e.target.checked)}
                    className="rounded border-gray-300 text-orange-500 focus:ring-orange-300"
                  />
                  <span className="text-sm text-gray-600">No daily limit</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum gap between check-ins
                </label>
                <div className="space-y-2">
                  {(
                    [
                      { value: "none", label: "No gap" },
                      { value: "1h", label: "1 hour" },
                      { value: "4h", label: "4 hours" },
                      { value: "8h", label: "8 hours" },
                      { value: "custom", label: "Custom" },
                    ] as { value: GapOption; label: string }[]
                  ).map((opt) => (
                    <label
                      key={opt.value}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="gap"
                        value={opt.value}
                        checked={gapOption === opt.value}
                        onChange={() => setGapOption(opt.value)}
                        className="text-orange-500 focus:ring-orange-300"
                      />
                      <span className="text-sm text-gray-700">{opt.label}</span>
                    </label>
                  ))}
                </div>
                {gapOption === "custom" && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={customMinutes}
                      onChange={(e) =>
                        setCustomMinutes(Math.max(1, Number(e.target.value)))
                      }
                      className="w-20 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
                    />
                    <span className="text-sm text-gray-500">minutes</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-3">
              <button
                onClick={saveSettings}
                disabled={saving || !initialProgram}
                className="px-4 py-2 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-60 transition-colors"
              >
                {saving ? "Saving…" : "Save Settings"}
              </button>
              {saveMsg && (
                <span className="text-xs text-gray-500">{saveMsg}</span>
              )}
            </div>
          </section>

          <section className="bg-white border border-gray-100 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800">
                Reward Tiers
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(true);
                  setAddRewardMsg("");
                }}
                className="px-3 py-1.5 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                + Add Reward
              </button>
            </div>

            {rewards.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                No reward tiers yet. Add one to get started.
              </p>
            ) : (
              <div className="space-y-2">
                {rewards.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-lg min-w-12 text-center">
                        {r.stamps_required} ★
                      </span>
                      <span className="text-sm font-medium text-gray-800">
                        {r.reward_name}
                      </span>
                      {r.expiry_days > 0 && (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          {r.expiry_days}d expiry
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => deleteReward(r.id)}
                      className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="lg:w-72 lg:shrink-0">
          <div className="lg:sticky lg:top-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 text-center">
              Preview
            </p>
            <PhonePreview
              stampsPerVisit={stampsPerVisit}
              rewards={rewards}
            />
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              Add Reward
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Stamps Required
                </label>
                <input
                  type="number"
                  min={1}
                  value={rewardForm.stamps_required}
                  onChange={(e) =>
                    setRewardForm((f) => ({
                      ...f,
                      stamps_required: Math.max(1, Number(e.target.value)),
                    }))
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Reward Name
                </label>
                <input
                  type="text"
                  value={rewardForm.reward_name}
                  onChange={(e) =>
                    setRewardForm((f) => ({
                      ...f,
                      reward_name: e.target.value,
                    }))
                  }
                  placeholder="e.g. Free Coffee"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Description{" "}
                  <span className="text-gray-300 font-normal">optional</span>
                </label>
                <textarea
                  value={rewardForm.reward_description}
                  onChange={(e) =>
                    setRewardForm((f) => ({
                      ...f,
                      reward_description: e.target.value,
                    }))
                  }
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Expiry Days{" "}
                  <span className="text-gray-300 font-normal">
                    (0 = no expiry)
                  </span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={rewardForm.expiry_days}
                  onChange={(e) =>
                    setRewardForm((f) => ({
                      ...f,
                      expiry_days: Math.max(0, Number(e.target.value)),
                    }))
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              {addRewardMsg && (
                <p className="text-xs text-red-500">{addRewardMsg}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setAddRewardMsg("");
                }}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addReward}
                disabled={addingReward}
                className="px-4 py-2 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-60 transition-colors"
              >
                {addingReward ? "Saving…" : "Save Reward"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
