"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import PageShell from "@/components/layout/PageShell";
import Awning from "@/components/shopfront/Awning";
import TinItem from "@/components/shopfront/TinItem";
import ReceiptRail, { type CartLine } from "@/components/shopfront/ReceiptRail";
import LimitationBlock from "@/components/shopfront/LimitationBlock";
import { useCounter } from "@/lib/useCounter";
import {
  formatRefundWindow,
  type ShopData,
  type ItemData,
} from "@/lib/counter";

export default function ShopPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const shopId = BigInt(resolvedParams.id);

  const { fetchShop, fetchShopItems, placeOrder, isTransacting, deployed } =
    useCounter();
  const { address } = useAccount();

  const [shop, setShop] = useState<ShopData | null>(null);
  const [items, setItems] = useState<ItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!deployed) {
        setLoading(false);
        return;
      }
      try {
        const [s, its] = await Promise.all([
          fetchShop(shopId),
          fetchShopItems(shopId),
        ]);
        if (mounted) {
          setShop(s);
          setItems(its);
        }
      } catch (err) {
        console.error("Error loading shop:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [shopId, fetchShop, fetchShopItems, deployed]);

  const isOwner =
    address && shop && shop.owner.toLowerCase() === address.toLowerCase();

  const handleQtyChange = (codeHex: string, newQty: number) => {
    // Single order model: pick one item to order at a time
    setCartQuantities({ [codeHex]: newQty });
  };

  const handlePlaceOrder = async (
    itemCode: `0x${string}`,
    qty: number,
    total: bigint
  ) => {
    const orderId = await placeOrder(shopId, itemCode, qty, total);
    if (orderId) {
      router.push(`/o/${orderId}`);
    }
  };

  const cartLines: CartLine[] = items.map((it) => ({
    item: it,
    qty: cartQuantities[it.code] || 0,
  }));

  if (loading) {
    return (
      <PageShell>
        <div className="h-32 skeleton rounded-t-xl mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-44 skeleton rounded-lg" />
            ))}
          </div>
          <div className="h-72 skeleton rounded-sm" />
        </div>
      </PageShell>
    );
  }

  if (!shop) {
    return (
      <PageShell title="Shop Not Found">
        <div className="p-12 text-center rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] my-6">
          <h2 className="font-heading font-bold text-xl text-[var(--text-primary)]">
            This Counter Does Not Exist
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1.5">
            Counter #{shopId.toString()} has not been opened on BOT Chain yet.
          </p>
          <div className="mt-5">
            <Link
              href="/"
              className="inline-flex py-2 px-4 rounded-md font-heading font-bold text-xs bg-[var(--accent)] text-[var(--accent-ink)]"
            >
              ← Back to The High Street
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* Striped Awning across top */}
      <Awning
        name={shop.name}
        subtitle={`Refund window: ${formatRefundWindow(shop.refundAfter)} • Counter #${shop.id.toString()}`}
      />

      {/* Owner Quick Bar */}
      {isOwner && (
        <div className="mb-6 p-3.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-default)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div>
            <span className="font-heading font-bold text-sm text-[var(--text-primary)]">
              You own this counter.
            </span>
            <p className="text-xs text-[var(--text-muted)]">
              Check incoming order tickets or update shelf prices in your order tray.
            </p>
          </div>
          <Link
            href={`/s/${shop.id}/manage`}
            className="py-1.5 px-4 rounded-md font-heading font-bold text-xs bg-[var(--text-primary)] text-[#FFFFFF] hover:bg-[#1C4E2D] transition-colors whitespace-nowrap shadow-xs"
          >
            Manage Till & Order Tray →
          </Link>
        </div>
      )}

      {/* Shopfront 2-column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start my-6">
        {/* Left: The Shelf Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-heading font-bold text-lg text-[var(--text-primary)]">
              On the Shelf ({items.length})
            </h2>
            <span className="text-xs text-[var(--text-muted)]">
              Pick quantity on any tin to order
            </span>
          </div>

          {items.length === 0 ? (
            <div className="p-12 text-center rounded-lg border-2 border-dashed border-[var(--border-default)] bg-[var(--bg-surface)]">
              <div className="w-10 h-10 mx-auto mb-2 text-2xl">🥫</div>
              <h3 className="font-heading font-bold text-base text-[var(--text-primary)]">
                Nothing on the shelf yet.
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
                The shopkeeper hasn&apos;t stocked any items on this counter yet. Check back soon.
              </p>
              {isOwner && (
                <div className="mt-4">
                  <Link
                    href={`/s/${shop.id}/manage`}
                    className="inline-flex py-1.5 px-3 rounded-md font-heading font-bold text-xs bg-[var(--accent)] text-[var(--accent-ink)]"
                  >
                    + Add Items to Shelf
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {items.map((it) => (
                <TinItem
                  key={it.code}
                  item={it}
                  qty={cartQuantities[it.code] || 0}
                  onQtyChange={(qty) => handleQtyChange(it.code, qty)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: Thermal Receipt Rail */}
        <div className="lg:col-span-1 w-full flex justify-center">
          <ReceiptRail
            shopName={shop.name}
            refundAfterSeconds={shop.refundAfter}
            lines={cartLines}
            onPlaceOrder={handlePlaceOrder}
            isSubmitting={isTransacting}
            userAddress={address}
          />
        </div>
      </div>

      <LimitationBlock />
    </PageShell>
  );
}
