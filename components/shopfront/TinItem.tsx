"use client";

import React from "react";
import { formatEther } from "viem";
import { decodeCode, type ItemData } from "@/lib/counter";

interface TinItemProps {
  item: ItemData;
  qty: number;
  onQtyChange?: (newQty: number) => void;
  readOnly?: boolean;
}

export default function TinItem({
  item,
  qty,
  onQtyChange,
  readOnly = false,
}: TinItemProps) {
  const codeStr = decodeCode(item.code);
  const formattedPrice = formatEther(item.price);

  return (
    <div
      className={`tin-container relative rounded-lg p-4 flex flex-col justify-between transition-all duration-150 ${
        qty > 0 ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : ""
      } ${!item.active ? "opacity-60 grayscale-[40%]" : ""}`}
    >
      {/* Price tag hanging off the top-right corner */}
      <div className="absolute -top-3 right-3 bg-[var(--accent)] text-[var(--accent-ink)] px-2.5 py-0.5 rounded-sm shadow-xs border border-[#D19200] flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[#FFFFFF]/80" aria-hidden="true" />
        <span className="font-heading font-bold text-xs tracking-tight">
          {formattedPrice} BOT
        </span>
      </div>

      {/* Tin top rim decoration */}
      <div className="w-full h-1.5 rounded-full bg-[var(--border-subtle)] mb-3 opacity-60" />

      {/* Tin Label Area */}
      <div className="mb-4">
        <div className="mono text-[11px] text-[var(--text-muted)] tracking-wider uppercase mb-1">
          {codeStr}
        </div>
        <h3 className="font-bold text-base text-[var(--text-primary)] leading-snug">
          {item.label}
        </h3>
        {!item.active && (
          <span className="inline-block mt-1 text-[11px] font-semibold text-[var(--danger)] bg-[#FDF2F2] px-2 py-0.5 rounded-xs">
            Off shelf
          </span>
        )}
      </div>

      {/* Stepper on the tin */}
      {readOnly || !item.active ? (
        <div className="mt-auto pt-2 border-t border-[var(--border-subtle)] text-xs text-[var(--text-muted)] text-center">
          {item.active ? `Price: ${formattedPrice} BOT` : "Currently unavailable"}
        </div>
      ) : (
        <div className="mt-auto pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-[var(--text-muted)]">Qty:</span>
          <div className="flex items-center gap-1.5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md p-0.5">
            <button
              type="button"
              onClick={() => onQtyChange?.(Math.max(0, qty - 1))}
              disabled={qty <= 0}
              aria-label={`Decrease ${item.label} quantity`}
              className="w-7 h-7 flex items-center justify-center rounded-xs text-base font-bold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              −
            </button>
            <span
              className="mono w-8 text-center text-sm font-bold text-[var(--text-primary)]"
              aria-live="polite"
            >
              {qty}
            </span>
            <button
              type="button"
              onClick={() => onQtyChange?.(Math.min(99, qty + 1))}
              disabled={qty >= 99}
              aria-label={`Increase ${item.label} quantity`}
              className="w-7 h-7 flex items-center justify-center rounded-xs text-base font-bold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
