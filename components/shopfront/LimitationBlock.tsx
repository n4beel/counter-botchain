import React from "react";

export default function LimitationBlock() {
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 my-6 shadow-xs">
      <div className="flex items-center gap-2 mb-3">
        <span
          className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]"
          aria-hidden="true"
        />
        <h2 className="font-heading font-bold text-base text-[var(--text-primary)] tracking-tight">
          What the counter can&apos;t see
        </h2>
      </div>

      <p className="text-xs text-[var(--text-muted)] mb-4">
        A shop counter. Unfilled orders refund themselves.
      </p>

      <ul className="space-y-2.5 text-xs text-[var(--text-secondary)] leading-relaxed">
        <li className="flex items-start gap-2">
          <span className="text-[var(--accent)] font-bold select-none">•</span>
          <span>
            The shop says when an order is filled. The chain can&apos;t check the goods.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-[var(--accent)] font-bold select-none">•</span>
          <span>
            Prices can change. Your order keeps the price you paid.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-[var(--accent)] font-bold select-none">•</span>
          <span>
            One order, one amount. No part-refunds.
          </span>
        </li>
      </ul>
    </div>
  );
}
