"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { parseEther, formatEther } from "viem";
import { useAccount } from "wagmi";
import PageShell from "@/components/layout/PageShell";
import Awning from "@/components/shopfront/Awning";
import OrderTray from "@/components/shopfront/OrderTray";
import Panel from "@/components/ui/Panel";
import LimitationBlock from "@/components/shopfront/LimitationBlock";
import { useCounter } from "@/lib/useCounter";
import {
  encodeCode,
  decodeCode,
  formatRefundWindow,
  type ShopData,
  type ItemData,
  type OrderData,
} from "@/lib/counter";
import { MAX_LABEL_BYTES, MAX_ITEMS_PER_SHOP } from "@/lib/limits";

export default function ShopManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const shopId = BigInt(resolvedParams.id);

  const {
    fetchShop,
    fetchShopItems,
    fetchShopOrders,
    setItem,
    fulfilOrder,
    declineOrder,
    isTransacting,
    deployed,
  } = useCounter();
  const { address } = useAccount();

  const [shop, setShop] = useState<ShopData | null>(null);
  const [items, setItems] = useState<ItemData[]>([]);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<bigint | null>(null);
  const [activeTab, setActiveTab] = useState<"orders" | "shelf">("orders");

  // New item form state
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newPrice, setNewPrice] = useState("");

  // Edit price modal/inline state
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");

  const refreshData = async () => {
    if (!deployed) return;
    try {
      const [s, its, ords] = await Promise.all([
        fetchShop(shopId),
        fetchShopItems(shopId),
        fetchShopOrders(shopId, 0n, 50n),
      ]);
      setShop(s);
      setItems(its);
      setOrders(ords);
    } catch (err) {
      console.error("Error refreshing shop management:", err);
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
        const [s, its, ords] = await Promise.all([
          fetchShop(shopId),
          fetchShopItems(shopId),
          fetchShopOrders(shopId, 0n, 50n),
        ]);
        if (mounted) {
          setShop(s);
          setItems(its);
          setOrders(ords);
        }
      } catch (err) {
        console.error("Error loading shop management:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [shopId, fetchShop, fetchShopItems, fetchShopOrders, deployed]);

  const isOwner =
    address && shop && shop.owner.toLowerCase() === address.toLowerCase();

  const handleFulfil = async (orderId: bigint) => {
    setActionId(orderId);
    try {
      const ok = await fulfilOrder(orderId);
      if (ok) await refreshData();
    } finally {
      setActionId(null);
    }
  };

  const handleDecline = async (orderId: bigint) => {
    setActionId(orderId);
    try {
      const ok = await declineOrder(orderId);
      if (ok) await refreshData();
    } finally {
      setActionId(null);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newLabel.trim() || !newPrice.trim()) return;

    try {
      const priceWei = parseEther(newPrice.trim());
      const encoded = encodeCode(newCode.trim());
      const ok = await setItem(shopId, encoded, newLabel.trim(), priceWei);
      if (ok) {
        setNewCode("");
        setNewLabel("");
        setNewPrice("");
        await refreshData();
      }
    } catch (err) {
      console.error("Add item error:", err);
    }
  };

  const handleUpdatePrice = async (codeHex: `0x${string}`, label: string) => {
    if (!editPrice.trim()) return;
    try {
      const priceWei = parseEther(editPrice.trim());
      const ok = await setItem(shopId, codeHex, label, priceWei);
      if (ok) {
        setEditingCode(null);
        setEditPrice("");
        await refreshData();
      }
    } catch (err) {
      console.error("Update price error:", err);
    }
  };

  const handleToggleActive = async (it: ItemData) => {
    try {
      // Toggle between 0 and previous price
      const nextPrice = it.active ? 0n : parseEther("0.05");
      const ok = await setItem(shopId, it.code, it.label, nextPrice);
      if (ok) await refreshData();
    } catch (err) {
      console.error("Toggle item error:", err);
    }
  };

  const labelBytes = new TextEncoder().encode(newLabel).length;
  const canAddItem =
    newCode.trim().length > 0 &&
    newLabel.trim().length > 0 &&
    labelBytes <= MAX_LABEL_BYTES &&
    items.length < MAX_ITEMS_PER_SHOP &&
    !isNaN(Number(newPrice)) &&
    Number(newPrice) > 0 &&
    !isTransacting;

  if (loading) {
    return (
      <PageShell>
        <div className="h-32 skeleton rounded-t-xl mb-6" />
        <div className="space-y-4">
          <div className="h-10 skeleton w-48 rounded-md" />
          <div className="h-64 skeleton rounded-lg" />
        </div>
      </PageShell>
    );
  }

  if (!shop) {
    return (
      <PageShell title="Shop Not Found">
        <p className="text-sm text-[var(--text-muted)]">This counter does not exist.</p>
      </PageShell>
    );
  }

  if (!isOwner) {
    return (
      <PageShell title="Shopkeeper Access Only">
        <div className="p-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] text-center my-6">
          <div className="w-10 h-10 mx-auto mb-2 text-2xl">🔒</div>
          <h2 className="font-heading font-bold text-lg text-[var(--text-primary)]">
            Restricted Behind the Counter
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1 max-w-md mx-auto">
            Only the shopkeeper who opened this shop ({shop.owner.slice(0, 6)}…{shop.owner.slice(-4)}) can manage the till and price list.
          </p>
          <div className="mt-4">
            <Link
              href={`/s/${shop.id}`}
              className="inline-flex py-2 px-4 rounded-md font-heading font-bold text-xs bg-[var(--accent)] text-[var(--accent-ink)]"
            >
              Step to Front of Counter →
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Awning
        name={shop.name}
        subtitle={`Behind the Till • Auto-refunds at ${formatRefundWindow(shop.refundAfter)} • Counter #${shop.id.toString()}`}
      />

      {/* Navigation sub-tabs: Order Tray vs Shelf Price List */}
      <div className="flex items-center justify-between border-b border-[var(--border-default)] mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`py-2 px-4 font-heading font-bold text-sm border-b-2 transition-colors ${
              activeTab === "orders"
                ? "border-[var(--accent)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            Order Tray ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("shelf")}
            className={`py-2 px-4 font-heading font-bold text-sm border-b-2 transition-colors ${
              activeTab === "shelf"
                ? "border-[var(--accent)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            Manage Shelf & Prices ({items.length})
          </button>
        </div>

        <Link
          href={`/s/${shop.id}`}
          className="text-xs font-bold font-heading text-[var(--text-muted)] hover:text-[var(--text-primary)] underline"
        >
          View Public Counter →
        </Link>
      </div>

      {activeTab === "orders" ? (
        <OrderTray
          orders={orders}
          onFulfil={handleFulfil}
          onDecline={handleDecline}
          actionLoadingId={actionId}
          refundAfterSeconds={shop.refundAfter}
        />
      ) : (
        <div className="space-y-6">
          {/* Add New Item Form */}
          <Panel awningStrip={true}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-base text-[var(--text-primary)]">
                Add Item to Shelf
              </h3>
              <span className="mono text-xs text-[var(--text-muted)]">
                {items.length} / {MAX_ITEMS_PER_SHOP} items stocked
              </span>
            </div>

            <form onSubmit={handleAddItem} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="item-code" className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">
                    Item Code (Short)
                  </label>
                  <input
                    id="item-code"
                    type="text"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    placeholder="e.g. COFFEE_DARK"
                    maxLength={16}
                    className="w-full px-3 py-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] mono text-xs font-bold uppercase focus:ring-1 focus:ring-[var(--accent)]"
                    required
                  />
                  <span className="text-[10px] text-[var(--text-muted)]">Max 16 chars (bytes16)</span>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="item-label" className="block text-xs font-bold text-[var(--text-muted)] uppercase">
                      Shelf Label
                    </label>
                    <span className="mono text-[10px] text-[var(--text-muted)]">
                      {labelBytes} / {MAX_LABEL_BYTES}
                    </span>
                  </div>
                  <input
                    id="item-label"
                    type="text"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="e.g. Dark Roast Colombian Tin"
                    maxLength={32}
                    className="w-full px-3 py-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs font-medium focus:ring-1 focus:ring-[var(--accent)]"
                    required
                  />
                  <span className="text-[10px] text-[var(--text-muted)]">Max 32 bytes</span>
                </div>

                <div>
                  <label htmlFor="item-price" className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">
                    Price (BOT)
                  </label>
                  <input
                    id="item-price"
                    type="number"
                    step="any"
                    min="0"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="e.g. 0.05"
                    className="w-full px-3 py-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] mono text-xs font-bold focus:ring-1 focus:ring-[var(--accent)]"
                    required
                  />
                  <span className="text-[10px] text-[var(--text-muted)]">Unit price upfront</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={!canAddItem}
                  className="py-2 px-5 rounded-md font-heading font-bold text-xs bg-[var(--accent)] text-[var(--accent-ink)] hover:brightness-105 active:scale-[0.99] disabled:opacity-40"
                >
                  {isTransacting ? "Adding to Shelf..." : "+ Stock Tin on Shelf"}
                </button>
              </div>
            </form>
          </Panel>

          {/* Current Shelf Items List */}
          <div className="bg-[var(--bg-surface)] rounded-lg border border-[var(--border-default)] p-5">
            <h3 className="font-heading font-bold text-base text-[var(--text-primary)] mb-4">
              Current Shelf Inventory
            </h3>

            {items.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] italic">
                No items on the shelf yet. Use the form above to add your first product.
              </p>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {items.map((it) => {
                  const codeStr = decodeCode(it.code);
                  const isEditing = editingCode === it.code;

                  return (
                    <div
                      key={it.code}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="mono text-xs font-bold text-[var(--text-muted)]">
                            {codeStr}
                          </span>
                          {!it.active && (
                            <span className="px-1.5 py-0.2 rounded-xs bg-[#FDF2F2] text-[var(--danger)] text-[10px] font-bold">
                              Off Shelf
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-sm text-[var(--text-primary)]">
                          {it.label}
                        </h4>
                      </div>

                      <div className="flex items-center gap-3">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                              placeholder={formatEther(it.price)}
                              className="w-20 px-2 py-1 text-xs mono border border-[var(--border-default)] rounded-xs"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdatePrice(it.code, it.label)}
                              disabled={isTransacting}
                              className="py-1 px-2.5 rounded-xs font-heading font-bold text-xs bg-[var(--text-primary)] text-[#FFFFFF]"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCode(null)}
                              className="py-1 px-2 rounded-xs text-xs text-[var(--text-muted)]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-heading font-bold text-sm text-[var(--text-primary)]">
                              {formatEther(it.price)} BOT
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCode(it.code);
                                setEditPrice(formatEther(it.price));
                              }}
                              className="py-1 px-2 rounded-xs text-xs border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                            >
                              Edit Price
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleActive(it)}
                              className={`py-1 px-2 rounded-xs text-xs border ${
                                it.active
                                  ? "border-[var(--danger)] text-[var(--danger)]"
                                  : "border-[var(--success)] text-[var(--success)]"
                              }`}
                            >
                              {it.active ? "Take Off Shelf" : "Put on Shelf"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <LimitationBlock />
    </PageShell>
  );
}
