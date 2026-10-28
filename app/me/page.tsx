"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import PageShell from "@/components/layout/PageShell";
import BotChainGate from "@/components/botchain/BotChainGate";
import Panel from "@/components/ui/Panel";
import LimitationBlock from "@/components/shopfront/LimitationBlock";
import { useCounter } from "@/lib/useCounter";
import {
  decodeCode,
  statusBadge,
  isRefundReady,
  OrderStatus,
  type OrderData,
  type ShopData,
} from "@/lib/counter";

export default function MyOrdersAndTillPage() {
  const { address } = useAccount();
  const {
    fetchCustomerOrders,
    fetchPendingBalance,
    fetchLatestShops,
    fetchShop,
    refundOrder,
    withdrawBalance,
    fetchBlockTimestamp,
    isTransacting,
    deployed,
  } = useCounter();

  const [orders, setOrders] = useState<OrderData[]>([]);
  const [pending, setPending] = useState<bigint>(0n);
  const [ownedShops, setOwnedShops] = useState<ShopData[]>([]);
  const [shopRefundWindows, setShopRefundWindows] = useState<Record<string, number>>({});
  const [chainTime, setChainTime] = useState<number>(Math.floor(Date.now() / 1000));
  const [loading, setLoading] = useState(true);
  const [refundingId, setRefundingId] = useState<bigint | null>(null);

  const refresh = async () => {
    if (!deployed || !address) return;
    try {
      const [ords, pend, allShops, bTime] = await Promise.all([
        fetchCustomerOrders(address, 0n, 50n),
        fetchPendingBalance(address),
        fetchLatestShops(0n, 50n),
        fetchBlockTimestamp(),
      ]);
      setOrders(ords);
      setPending(pend);
      setChainTime(bTime);

      const owned = allShops.filter(
        (s) => s.owner.toLowerCase() === address.toLowerCase()
      );
      setOwnedShops(owned);

      // Build refund windows lookup
      const windows: Record<string, number> = {};
      for (const s of allShops) {
        windows[s.id.toString()] = s.refundAfter;
      }
      setShopRefundWindows(windows);
    } catch (err) {
      console.error("Error refreshing /me data:", err);
    }
  };

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!deployed || !address) {
        setLoading(false);
        return;
      }
      try {
        const [ords, pend, allShops, bTime] = await Promise.all([
          fetchCustomerOrders(address, 0n, 50n),
          fetchPendingBalance(address),
          fetchLatestShops(0n, 50n),
          fetchBlockTimestamp(),
        ]);
        if (mounted) {
          setOrders(ords);
          setPending(pend);
          setChainTime(bTime);

          const owned = allShops.filter(
            (s) => s.owner.toLowerCase() === address.toLowerCase()
          );
          setOwnedShops(owned);

          const windows: Record<string, number> = {};
          for (const s of allShops) {
            windows[s.id.toString()] = s.refundAfter;
          }
          setShopRefundWindows(windows);
        }
      } catch (err) {
        console.error("Error loading /me data:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [
    address,
    fetchCustomerOrders,
    fetchPendingBalance,
    fetchLatestShops,
    fetchBlockTimestamp,
    deployed,
  ]);

  const handleWithdraw = async () => {
    const ok = await withdrawBalance();
    if (ok) await refresh();
  };

  const handleRefund = async (orderId: bigint) => {
    setRefundingId(orderId);
    try {
      const ok = await refundOrder(orderId);
      if (ok) await refresh();
    } finally {
      setRefundingId(null);
    }
  };

  return (
    <PageShell
      title="Orders & Pending Balance"
      description="Track the status of your purchases, claim automatic refunds when past due, and withdraw your pull-payment balance."
    >
      <BotChainGate>
        <div className="space-y-8 my-6">
          {/* Pending Balance (Pull payment) Card */}
          <Panel elevated={true} awningStrip={true}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="mono text-[11px] uppercase tracking-wider text-[var(--text-muted)] block font-bold">
                  Withdrawable Balance (Pull Payment)
                </span>
                <div className="font-heading font-black text-3xl sm:text-4xl text-[var(--text-primary)] mt-1">
                  {formatEther(pending)} BOT
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1 max-w-md leading-relaxed">
                  Revenues from your fulfilled sales and refunds from cancelled or expired orders are credited to your pending till.
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleWithdraw}
                  disabled={pending === 0n || isTransacting}
                  className="w-full sm:w-auto py-2.5 px-6 rounded-md font-heading font-bold text-sm bg-[var(--accent)] text-[var(--accent-ink)] hover:brightness-105 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                >
                  {isTransacting ? "Withdrawing..." : "Withdraw to Wallet"}
                </button>
              </div>
            </div>
          </Panel>

          {/* Your Placed Orders */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-heading font-bold text-lg text-[var(--text-primary)]">
                Your Orders ({orders.length})
              </h2>
              <span className="text-xs text-[var(--text-muted)]">
                Unfilled orders refund themselves automatically
              </span>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 skeleton rounded-lg" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="p-8 text-center rounded-lg border-2 border-dashed border-[var(--border-default)] bg-[var(--bg-surface)]">
                <p className="text-xs text-[var(--text-muted)] italic">
                  You haven&apos;t placed any orders yet. Visit any counter on the High Street to make a purchase.
                </p>
                <div className="mt-3">
                  <Link
                    href="/"
                    className="inline-flex py-1.5 px-3 rounded-md font-heading font-bold text-xs bg-[var(--accent)] text-[var(--accent-ink)]"
                  >
                    Explore The Street →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((o) => {
                  const badge = statusBadge(o.status);
                  const itemCode = decodeCode(o.item);
                  const placedDate = new Date(Number(o.placedAt) * 1000);
                  const refundWindow = shopRefundWindows[o.shopId.toString()] || 3600;
                  const refundableNow =
                    o.status === OrderStatus.Placed &&
                    isRefundReady(o.placedAt, refundWindow, chainTime);
                  const isRefundingThis = refundingId === o.id;

                  return (
                    <div
                      key={o.id.toString()}
                      className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="mono text-xs font-bold text-[var(--text-muted)]">
                            #{o.id.toString().padStart(4, "0")}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1"
                            style={{
                              backgroundColor:
                                badge.tone === "fulfilled"
                                  ? "#EAF6EC"
                                  : badge.tone === "refunded"
                                  ? "#F0F4F8"
                                  : badge.tone === "declined"
                                  ? "#FDF2F2"
                                  : "#FFF9E6",
                              borderColor:
                                badge.tone === "fulfilled"
                                  ? "var(--success)"
                                  : badge.tone === "refunded"
                                  ? "var(--text-muted)"
                                  : badge.tone === "declined"
                                  ? "var(--danger)"
                                  : "var(--accent)",
                              color:
                                badge.tone === "fulfilled"
                                  ? "var(--success)"
                                  : badge.tone === "refunded"
                                  ? "var(--text-muted)"
                                  : badge.tone === "declined"
                                  ? "var(--danger)"
                                  : "var(--accent-ink)",
                            }}
                          >
                            {badge.label}
                          </span>
                        </div>

                        <div className="font-bold text-sm text-[var(--text-primary)]">
                          {o.qty}x {itemCode}
                        </div>

                        <div className="mono text-[11px] text-[var(--text-muted)]">
                          Shop #{o.shopId.toString()} • {placedDate.toLocaleDateString()} {placedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-[var(--border-subtle)]">
                        <div className="text-right">
                          <span className="font-heading font-bold text-base text-[var(--text-primary)] block">
                            {formatEther(o.amount)} BOT
                          </span>
                          <Link
                            href={`/o/${o.id}`}
                            className="mono text-[11px] underline text-[var(--text-muted)] hover:text-[var(--text-primary)] block"
                          >
                            Receipt →
                          </Link>
                        </div>

                        {refundableNow && (
                          <button
                            type="button"
                            onClick={() => handleRefund(o.id)}
                            disabled={isTransacting}
                            className="py-1.5 px-3 rounded-xs font-heading font-bold text-xs bg-[var(--accent)] text-[var(--accent-ink)] hover:brightness-105 active:scale-[0.99] transition-all disabled:opacity-40"
                          >
                            {isRefundingThis ? "Claiming..." : "Claim Refund"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Owned Shops Section */}
          {ownedShops.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-[var(--border-subtle)]">
              <h2 className="font-heading font-bold text-lg text-[var(--text-primary)]">
                Counters You Own ({ownedShops.length})
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {ownedShops.map((s) => (
                  <div
                    key={s.id.toString()}
                    className="p-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div>
                      <h3 className="font-heading font-bold text-sm text-[var(--text-primary)]">
                        {s.name}
                      </h3>
                      <p className="text-xs text-[var(--text-muted)]">
                        {s.itemCount} items stocked • Shop #{s.id.toString()}
                      </p>
                    </div>

                    <Link
                      href={`/s/${s.id}/manage`}
                      className="py-1.5 px-3 rounded-md font-heading font-bold text-xs bg-[var(--text-primary)] text-[#FFFFFF] hover:bg-[#1C4E2D] transition-colors"
                    >
                      Manage Till →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </BotChainGate>

      <LimitationBlock />
    </PageShell>
  );
}
