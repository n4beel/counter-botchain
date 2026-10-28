"use client";

import React from "react";
import Link from "next/link";
import { formatEther } from "viem";
import {
  decodeCode,
  statusBadge,
  isRefundReady,
  OrderStatus,
  type ItemData,
  type OrderData,
} from "@/lib/counter";

export interface CartLine {
  item: ItemData;
  qty: number;
}

interface ReceiptRailProps {
  shopName: string;
  refundAfterSeconds: number;
  lines?: CartLine[];
  order?: OrderData | null;
  onPlaceOrder?: (itemCode: `0x${string}`, qty: number, total: bigint) => void;
  onClaimRefund?: (orderId: bigint) => void;
  isSubmitting?: boolean;
  userAddress?: string;
}

export default function ReceiptRail({
  shopName,
  refundAfterSeconds,
  lines = [],
  order,
  onPlaceOrder,
  onClaimRefund,
  isSubmitting = false,
  userAddress,
}: ReceiptRailProps) {
  // If an existing order is provided, show its receipt
  if (order) {
    const badge = statusBadge(order.status);
    const itemCode = decodeCode(order.item);
    const placedDate = new Date(Number(order.placedAt) * 1000);
    const deadlineDate = new Date((Number(order.placedAt) + refundAfterSeconds) * 1000);
    const refundableNow =
      order.status === OrderStatus.Placed &&
      isRefundReady(order.placedAt, refundAfterSeconds);

    const isCustomer =
      userAddress &&
      userAddress.toLowerCase() === order.customer.toLowerCase();

    return (
      <div className="receipt-paper w-full max-w-[340px] mx-auto p-5 rounded-sm mono text-xs">
        {/* Thermal Receipt Header */}
        <div className="text-center pb-3 border-b-2 border-dashed border-[var(--border-default)]">
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
            Counter Point of Sale
          </div>
          <h2 className="font-heading font-bold text-lg text-[var(--text-primary)] my-0.5 truncate">
            {shopName}
          </h2>
          <div className="text-[11px] text-[var(--text-muted)]">
            {placedDate.toLocaleDateString()} {placedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>

        {/* Order Identifier */}
        <div className="py-4 text-center border-b-2 border-dashed border-[var(--border-default)]">
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
            Order Number
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">
            #{order.id.toString().padStart(4, "0")}
          </div>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
            style={{
              backgroundColor: badge.tone === "fulfilled" ? "#EAF6EC" : badge.tone === "refunded" ? "#F0F4F8" : badge.tone === "declined" ? "#FDF2F2" : "#FFF9E6",
              borderColor: badge.tone === "fulfilled" ? "var(--success)" : badge.tone === "refunded" ? "var(--text-muted)" : badge.tone === "declined" ? "var(--danger)" : "var(--accent)",
              color: badge.tone === "fulfilled" ? "var(--success)" : badge.tone === "refunded" ? "var(--text-muted)" : badge.tone === "declined" ? "var(--danger)" : "var(--accent-ink)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: badge.tone === "fulfilled" ? "var(--success)" : badge.tone === "refunded" ? "var(--text-muted)" : badge.tone === "declined" ? "var(--danger)" : "var(--accent)"
              }}
            />
            {badge.label}
          </div>
        </div>

        {/* Order Details */}
        <div className="py-3 border-b-2 border-dashed border-[var(--border-default)] space-y-2">
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Item:</span>
            <span className="font-bold text-[var(--text-primary)] truncate max-w-[180px]">{itemCode}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Quantity:</span>
            <span className="font-bold text-[var(--text-primary)]">{order.qty}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Customer:</span>
            <span className="font-bold text-[var(--text-primary)] truncate max-w-[180px]">
              {order.customer.slice(0, 6)}…{order.customer.slice(-4)}
            </span>
          </div>
        </div>

        {/* Total Payment */}
        <div className="py-3 border-b-2 border-dashed border-[var(--border-default)] flex justify-between items-baseline">
          <span className="font-bold uppercase text-[11px] text-[var(--text-muted)]">Amount Paid</span>
          <span className="font-heading font-bold text-lg text-[var(--text-primary)]">
            {formatEther(order.amount)} BOT
          </span>
        </div>

        {/* Refund deadline condition */}
        <div className="py-3 text-[11px] text-[var(--text-muted)] leading-relaxed">
          {order.status === OrderStatus.Placed ? (
            refundableNow ? (
              <div className="text-[var(--success)] font-bold">
                Refund window elapsed ({deadlineDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}). You may claim your refund now.
              </div>
            ) : (
              <div>
                Auto-refund opens at:{" "}
                <span className="font-semibold text-[var(--text-primary)]">
                  {deadlineDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <p className="mt-1 text-[10px]">
                  If the shop does not fulfil or decline before this time, you can trigger an instant refund.
                </p>
              </div>
            )
          ) : order.status === OrderStatus.Fulfilled ? (
            <div>Order fulfilled by shopkeeper. Funds credited to shop.</div>
          ) : order.status === OrderStatus.Declined ? (
            <div>Order declined by shopkeeper. Payment credited to your pending balance.</div>
          ) : (
            <div>Order refunded. Payment credited to your pending balance.</div>
          )}
        </div>

        {/* Action Button: Claim Refund if due */}
        {refundableNow && isCustomer && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => onClaimRefund?.(order.id)}
              disabled={isSubmitting}
              className="w-full py-2.5 px-3 rounded-xs font-bold text-center bg-[var(--accent)] text-[var(--accent-ink)] hover:brightness-105 active:scale-[0.99] transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Claiming..." : "Claim Full Refund"}
            </button>
          </div>
        )}

        <div className="pt-4 text-center text-[10px] text-[var(--text-muted)]">
          <Link href={`/o/${order.id}`} className="underline hover:text-[var(--text-primary)]">
            Permalink Receipt
          </Link>
        </div>
      </div>
    );
  }

  // Active Cart Builder
  const activeLines = lines.filter((l) => l.qty > 0);
  const totalAmount = activeLines.reduce(
    (sum, l) => sum + l.item.price * BigInt(l.qty),
    0n
  );

  return (
    <div className="receipt-paper w-full max-w-[340px] mx-auto p-5 rounded-sm mono text-xs flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="text-center pb-3 border-b-2 border-dashed border-[var(--border-default)]">
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
            Counter Order Ticket
          </div>
          <h2 className="font-heading font-bold text-base text-[var(--text-primary)] mt-0.5 truncate">
            {shopName}
          </h2>
          <div className="text-[10px] text-[var(--text-muted)] mt-1">
            Pick an item on the shelf to place an order
          </div>
        </div>

        {/* Lines */}
        <div className="py-4 border-b-2 border-dashed border-[var(--border-default)] min-h-[120px]">
          {activeLines.length === 0 ? (
            <div className="text-center py-6 text-[var(--text-muted)] italic text-[11px]">
              No items selected yet. Tap &apos;+&apos; on a tin on the shelf.
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeLines.map((l) => (
                <div key={l.item.code} className="flex justify-between items-start gap-2">
                  <div className="flex-1 truncate">
                    <span className="font-bold text-[var(--text-primary)]">
                      {l.qty}x
                    </span>{" "}
                    <span className="text-[var(--text-primary)] truncate">
                      {l.item.label}
                    </span>
                    <div className="text-[10px] text-[var(--text-muted)]">
                      @{formatEther(l.item.price)} BOT each
                    </div>
                  </div>
                  <div className="font-bold text-[var(--text-primary)] flex-shrink-0">
                    {formatEther(l.item.price * BigInt(l.qty))} BOT
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Order Policy Note */}
        <div className="py-2.5 text-[10px] text-[var(--text-muted)] border-b-2 border-dashed border-[var(--border-default)] leading-tight">
          Note: One order per transaction. If multiple items are selected, the order is placed for the primary selection.
        </div>

        {/* Subtotal & Total */}
        <div className="py-3 border-b-2 border-dashed border-[var(--border-default)] flex justify-between items-baseline">
          <span className="font-bold uppercase text-[11px] text-[var(--text-muted)]">Total Due:</span>
          <span className="font-heading font-bold text-xl text-[var(--text-primary)]">
            {formatEther(totalAmount)} BOT
          </span>
        </div>
      </div>

      {/* Place Order CTA */}
      <div className="pt-4">
        <button
          type="button"
          onClick={() => {
            if (activeLines.length > 0 && onPlaceOrder) {
              const primary = activeLines[0];
              onPlaceOrder(
                primary.item.code,
                primary.qty,
                primary.item.price * BigInt(primary.qty)
              );
            }
          }}
          disabled={activeLines.length === 0 || isSubmitting}
          className="w-full py-3 px-4 rounded-xs font-bold text-sm text-center bg-[var(--accent)] text-[var(--accent-ink)] hover:brightness-105 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          {isSubmitting ? "Placing Order..." : "Place Order & Pay"}
        </button>

        <p className="text-center text-[10px] text-[var(--text-muted)] mt-2">
          Unfilled orders refund themselves after {Math.round(refundAfterSeconds / 3600)}h.
        </p>
      </div>
    </div>
  );
}
