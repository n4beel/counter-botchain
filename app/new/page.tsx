"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/layout/PageShell";
import BotChainGate from "@/components/botchain/BotChainGate";
import Panel from "@/components/ui/Panel";
import LimitationBlock from "@/components/shopfront/LimitationBlock";
import { useCounter } from "@/lib/useCounter";
import { MAX_NAME_BYTES, MIN_REFUND_WINDOW, MAX_REFUND_WINDOW } from "@/lib/limits";

const WINDOW_PRESETS = [
  { label: "1 hour (Quick delivery)", seconds: 3600 },
  { label: "6 hours (Same day)", seconds: 21600 },
  { label: "24 hours (1 business day)", seconds: 86400 },
  { label: "7 days (Standard service)", seconds: 604800 },
  { label: "30 days (Long horizon / Pre-order)", seconds: 2592000 },
];

export default function OpenShopPage() {
  const router = useRouter();
  const { openShop, isTransacting } = useCounter();

  const [name, setName] = useState("");
  const [refundAfter, setRefundAfter] = useState<number>(3600);

  const nameBytes = new TextEncoder().encode(name).length;
  const isNameValid = name.trim().length > 0 && nameBytes <= MAX_NAME_BYTES;
  const isWindowValid =
    refundAfter >= MIN_REFUND_WINDOW && refundAfter <= MAX_REFUND_WINDOW;
  const canSubmit = isNameValid && isWindowValid && !isTransacting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const newShopId = await openShop(name.trim(), refundAfter);
    if (newShopId) {
      router.push(`/s/${newShopId}/manage`);
    }
  };

  return (
    <PageShell
      title="Open a Shop Counter"
      description="Set up your shopfront awning, name your counter, and choose a refund window. Once opened, you can stock up to 32 items on your shelf."
    >
      <div className="max-w-xl mx-auto space-y-6 my-6">
        <BotChainGate>
          <Panel awningStrip={true}>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Shop Name */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="shop-name"
                    className="block font-heading font-bold text-sm text-[var(--text-primary)]"
                  >
                    Shop Name
                  </label>
                  <span
                    className={`mono text-[11px] ${
                      nameBytes > MAX_NAME_BYTES
                        ? "text-[var(--danger)] font-bold"
                        : "text-[var(--text-muted)]"
                    }`}
                  >
                    {nameBytes} / {MAX_NAME_BYTES} bytes
                  </span>
                </div>
                <input
                  id="shop-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Corner Bakery & Provisions"
                  maxLength={50}
                  className="w-full px-3.5 py-2.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-medium text-sm"
                  required
                />
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Plain, courteous, specific. This name is stamped across your striped awning.
                </p>
              </div>

              {/* Refund Window */}
              <div>
                <label
                  htmlFor="refund-window"
                  className="block font-heading font-bold text-sm text-[var(--text-primary)] mb-1.5"
                >
                  Refund Window
                </label>
                <select
                  id="refund-window"
                  value={refundAfter}
                  onChange={(e) => setRefundAfter(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-medium text-sm"
                >
                  {WINDOW_PRESETS.map((p) => (
                    <option key={p.seconds} value={p.seconds}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <div className="mt-3 p-3 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                  <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    <span className="font-bold text-[var(--text-primary)]">
                      The Commitment:
                    </span>{" "}
                    Unfilled orders refund themselves. If you do not mark an order as fulfilled or declined within this timeframe, the customer can withdraw their funds immediately without your approval.
                  </div>
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full py-3 px-4 rounded-md font-heading font-bold text-sm bg-[var(--accent)] text-[var(--accent-ink)] hover:brightness-105 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                >
                  {isTransacting ? "Opening Counter..." : "Open Counter on BOT Chain"}
                </button>
              </div>
            </form>
          </Panel>
        </BotChainGate>

        <LimitationBlock />
      </div>
    </PageShell>
  );
}
