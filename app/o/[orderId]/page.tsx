"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import PageShell from "@/components/layout/PageShell";
import ReceiptRail from "@/components/shopfront/ReceiptRail";
import LimitationBlock from "@/components/shopfront/LimitationBlock";
import { useCounter } from "@/lib/useCounter";
import type { OrderData, ShopData } from "@/lib/counter";

export default function OrderReceiptPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const resolvedParams = use(params);
  const orderId = BigInt(resolvedParams.orderId);

  const {
    fetchOrder,
    fetchShop,
    refundOrder,
    fetchBlockTimestamp,
    isTransacting,
    deployed,
  } = useCounter();
  const { address } = useAccount();

  const [order, setOrder] = useState<OrderData | null>(null);
  const [shop, setShop] = useState<ShopData | null>(null);
  const [chainTime, setChainTime] = useState<number>(Math.floor(Date.now() / 1000));
  const [loading, setLoading] = useState(true);

  const refreshOrder = async () => {
    if (!deployed) return;
    try {
      const [o, bTime] = await Promise.all([
        fetchOrder(orderId),
        fetchBlockTimestamp(),
      ]);
      setOrder(o);
      setChainTime(bTime);
      if (o) {
        const s = await fetchShop(o.shopId);
        setShop(s);
      }
    } catch (err) {
      console.error("Error refreshing order:", err);
    }
  };

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!deployed) {
        setLoading(false);
        return;
      }
      try {
        const [o, bTime] = await Promise.all([
          fetchOrder(orderId),
          fetchBlockTimestamp(),
        ]);
        if (mounted) {
          setOrder(o);
          setChainTime(bTime);
          if (o) {
            const s = await fetchShop(o.shopId);
            if (mounted) setShop(s);
          }
        }
      } catch (err) {
        console.error("Error loading order receipt:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [orderId, fetchOrder, fetchShop, fetchBlockTimestamp, deployed]);

  const handleClaimRefund = async (id: bigint) => {
    const ok = await refundOrder(id);
    if (ok) await refreshOrder();
  };

  if (loading) {
    return (
      <PageShell title="Loading Receipt...">
        <div className="max-w-[340px] mx-auto h-96 skeleton rounded-sm my-6" />
      </PageShell>
    );
  }

  if (!order) {
    return (
      <PageShell title="Receipt Not Found">
        <div className="p-12 text-center rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] my-6">
          <h2 className="font-heading font-bold text-xl text-[var(--text-primary)]">
            Order #{orderId.toString()} Does Not Exist
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1.5">
            This order ticket could not be found on BOT Chain.
          </p>
          <div className="mt-5">
            <Link
              href="/"
              className="inline-flex py-2 px-4 rounded-md font-heading font-bold text-xs bg-[var(--accent)] text-[var(--accent-ink)]"
            >
              ← Return to High Street
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  const shopName = shop ? shop.name : `Counter #${order.shopId.toString()}`;
  const refundAfterSeconds = shop ? shop.refundAfter : 3600;

  return (
    <PageShell
      title={`Receipt #${order.id.toString().padStart(4, "0")}`}
      description={`Shareable order ticket for ${shopName}. All status updates and automated refunds are tracked on-chain.`}
    >
      <div className="max-w-md mx-auto my-6 space-y-6">
        <ReceiptRail
          shopName={shopName}
          refundAfterSeconds={refundAfterSeconds}
          order={order}
          onClaimRefund={handleClaimRefund}
          isSubmitting={isTransacting}
          userAddress={address}
          currentTimeSec={chainTime}
        />

        <div className="flex items-center justify-center gap-4 text-xs font-heading font-bold">
          <Link
            href={`/s/${order.shopId}`}
            className="text-[var(--text-primary)] hover:text-[var(--accent)] underline"
          >
            ← Back to {shopName}
          </Link>
          <span className="text-[var(--border-default)]">•</span>
          <Link
            href="/me"
            className="text-[var(--text-primary)] hover:text-[var(--accent)] underline"
          >
            View All My Orders →
          </Link>
        </div>

        <LimitationBlock />
      </div>
    </PageShell>
  );
}
