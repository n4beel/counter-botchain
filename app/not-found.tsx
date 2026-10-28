import React from "react";
import Link from "next/link";
import PageShell from "@/components/layout/PageShell";

export default function NotFound() {
  return (
    <PageShell title="404 · Counter Not Found">
      <div className="max-w-md mx-auto my-12 p-8 text-center bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] shadow-xs">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center font-heading text-2xl text-[var(--text-muted)]">
          🥫
        </div>
        <h2 className="font-heading font-bold text-xl text-[var(--text-primary)]">
          Empty Shelf
        </h2>
        <p className="text-xs text-[var(--text-muted)] mt-2 leading-relaxed">
          The counter, ticket, or shelf item you are looking for does not exist on this street.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex py-2.5 px-5 rounded-md font-heading font-bold text-xs bg-[var(--accent)] text-[var(--accent-ink)] hover:brightness-105 active:scale-[0.99] transition-all shadow-xs"
          >
            ← Return to High Street
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
