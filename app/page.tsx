"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import PageShell from "@/components/layout/PageShell";
import Awning from "@/components/shopfront/Awning";
import LimitationBlock from "@/components/shopfront/LimitationBlock";
import { useCounter } from "@/lib/useCounter";
import { formatRefundWindow, type ShopData } from "@/lib/counter";
import { useAccount } from "wagmi";

export default function Home() {
  const { fetchLatestShops, deployed } = useCounter();
  const { address } = useAccount();

  const [shops, setShops] = useState<ShopData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!deployed) {
        setLoading(false);
        return;
      }
      try {
        const list = await fetchLatestShops(0n, 50n);
        if (mounted) setShops(list);
      } catch (err) {
        console.error("Error loading shops:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [fetchLatestShops, deployed]);

  return (
    <PageShell
      title="The High Street"
      description="Step up to any counter. Pick items, pay in BOT, and get an order receipt. If the shop doesn't fill your order in time, it refunds itself."
    >
      {/* Directory of shops: 3-up awnings */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 my-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 rounded-lg skeleton border border-[var(--border-subtle)]"
            />
          ))}
        </div>
      ) : shops.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-[var(--border-default)] p-12 text-center bg-[var(--bg-surface)] my-6">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center font-heading text-xl text-[var(--accent)] font-bold">
            🏪
          </div>
          <h2 className="font-heading font-bold text-xl text-[var(--text-primary)]">
            No Shops on the Street Yet
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1.5 max-w-md mx-auto leading-relaxed">
            Be the first shopkeeper to set up a counter, hang items on the shelf, and accept upfront orders.
          </p>
          <div className="mt-5">
            <Link
              href="/new"
              className="inline-flex items-center gap-2 py-2.5 px-5 rounded-md font-heading font-bold text-sm bg-[var(--accent)] text-[var(--accent-ink)] hover:brightness-105 active:scale-[0.99] transition-all shadow-xs"
            >
              Open a Shop Counter →
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4 my-6">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-heading font-bold text-lg text-[var(--text-primary)]">
              Open Counters ({shops.length})
            </h2>
            <Link
              href="/new"
              className="text-xs font-bold font-heading text-[var(--text-primary)] hover:text-[var(--accent)] underline"
            >
              + Open New Counter
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {shops.map((s) => {
              const isOwner =
                address &&
                s.owner.toLowerCase() === address.toLowerCase();

              return (
                <div
                  key={s.id.toString()}
                  className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden group"
                >
                  <Awning name={s.name} mini={true} />

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-muted)]">Shelf Items:</span>
                        <span className="font-bold text-[var(--text-primary)]">
                          {s.itemCount} item{s.itemCount === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-muted)]">Refund Window:</span>
                        <span className="font-bold text-[var(--text-primary)]">
                          {formatRefundWindow(s.refundAfter)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-muted)]">Shopkeeper:</span>
                        <span className="mono text-[11px] text-[var(--text-primary)]">
                          {s.owner.slice(0, 6)}…{s.owner.slice(-4)}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
                      <Link
                        href={`/s/${s.id}`}
                        className="block w-full py-2.5 px-3 rounded-md font-heading font-bold text-xs text-center bg-[var(--accent)] text-[var(--accent-ink)] hover:brightness-105 active:scale-[0.99] transition-all shadow-xs"
                      >
                        Step Up to Counter →
                      </Link>

                      {isOwner && (
                        <Link
                          href={`/s/${s.id}/manage`}
                          className="block w-full py-1.5 px-3 rounded-md font-heading font-bold text-[11px] text-center border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                        >
                          Manage Till & Orders
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mandatory spec limitation block */}
      <LimitationBlock />
    </PageShell>
  );
}
