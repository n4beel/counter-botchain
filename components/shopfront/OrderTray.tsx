"use client";

import React from "react";
import Link from "next/link";
import { formatEther } from "viem";
import {
  decodeCode,
  statusBadge,
  OrderStatus,
  type OrderData,
} from "@/lib/counter";

interface OrderTrayProps {
  orders: OrderData[];
  onFulfil?: (orderId: bigint) => void;
  onDecline?: (orderId: bigint) => void;
  actionLoadingId?: bigint | null;
  refundAfterSeconds?: number;
}

export default function OrderTray({
  orders,
  onFulfil,
  onDecline,
  actionLoadingId,
  refundAfterSeconds = 3600,
}: OrderTrayProps) {
  if (orders.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-[var(--border-default)] p-12 text-center bg-[var(--bg-surface)]">
        <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-muted)] font-mono text-lg font-bold">
          0
        </div>
        <h3 className="font-heading font-bold text-lg text-[var(--text-primary)]">
          The Order Tray is Empty
        </h3>
        <p className="text-sm text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
          No orders have been placed at this counter yet. When customers order from your shelf, their tickets appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="font-heading font-bold text-lg text-[var(--text-primary)]">
          Incoming Order Tickets ({orders.length})
        </h3>
        <span className="text-xs text-[var(--text-muted)]">
          Orders are settled or refunded directly on-chain
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {orders.map((o) => {
          const badge = statusBadge(o.status);
          const itemCode = decodeCode(o.item);
          const placedDate = new Date(Number(o.placedAt) * 1000);
          const deadlineDate = new Date(
            (Number(o.placedAt) + refundAfterSeconds) * 1000
          );
          const isPending = o.status === OrderStatus.Placed;
          const isLoading = actionLoadingId === o.id;

          return (
            <div
              key={o.id.toString()}
              className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-5 shadow-xs flex flex-col justify-between relative overflow-hidden"
            >
              {/* Top ticket strip */}
              <div className="flex items-start justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
                <div>
                  <div className="mono text-xs font-bold text-[var(--text-muted)]">
                    TICKET #{o.id.toString().padStart(4, "0")}
                  </div>
                  <div className="mono text-[11px] text-[var(--text-muted)]">
                    {placedDate.toLocaleDateString()} {placedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>

                <div
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold border flex items-center gap-1.5"
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
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor:
                        badge.tone === "fulfilled"
                          ? "var(--success)"
                          : badge.tone === "refunded"
                          ? "var(--text-muted)"
                          : badge.tone === "declined"
                          ? "var(--danger)"
                          : "var(--accent)",
                    }}
                  />
                  {badge.label}
                </div>
              </div>

              {/* Order items info */}
              <div className="py-3 space-y-1.5 flex-1">
                <div className="flex justify-between items-baseline">
                  <span className="font-bold text-base text-[var(--text-primary)]">
                    {o.qty}x {itemCode}
                  </span>
                  <span className="font-heading font-bold text-base text-[var(--text-primary)]">
                    {formatEther(o.amount)} BOT
                  </span>
                </div>
                <div className="mono text-xs text-[var(--text-muted)] flex items-center justify-between">
                  <span>Customer:</span>
                  <span>{o.customer.slice(0, 6)}…{o.customer.slice(-4)}</span>
                </div>
                {isPending && (
                  <div className="text-[11px] text-[var(--text-muted)] pt-1">
                    Refund deadline:{" "}
                    <span className="font-semibold text-[var(--text-primary)]">
                      {deadlineDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons for Placed Orders */}
              {isPending ? (
                <div className="pt-3 border-t border-[var(--border-subtle)] grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onFulfil?.(o.id)}
                    disabled={isLoading}
                    className="w-full py-2 px-3 rounded-xs font-bold text-xs bg-[var(--text-primary)] text-[#FFFFFF] hover:bg-[#1E4D30] transition-colors disabled:opacity-50"
                  >
                    {isLoading ? "Processing..." : "Fulfil Order"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDecline?.(o.id)}
                    disabled={isLoading}
                    className="w-full py-2 px-3 rounded-xs font-bold text-xs border border-[var(--border-default)] text-[var(--danger)] hover:bg-[#FDF2F2] transition-colors disabled:opacity-50"
                  >
                    {isLoading ? "Processing..." : "Decline"}
                  </button>
                </div>
              ) : (
                <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span>Resolved</span>
                  <Link
                    href={`/o/${o.id}`}
                    className="underline hover:text-[var(--text-primary)] font-medium"
                  >
                    View Receipt →
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
