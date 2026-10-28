"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectButton from "@/components/ui/ConnectButton";
import NetworkBadge from "@/components/botchain/NetworkBadge";
import { footerLinks } from "@/lib/botchain/chain";
import BuiltOnBotChain from "@/components/botchain/BuiltOnBotChain";
import { app } from "@/lib/app-config";

export interface ShopfrontNavItem {
  href: string;
  label: string;
  badge?: string;
}

const DEFAULT_SHOP_NAV: ShopfrontNavItem[] = [
  { href: "/", label: "The Street (Shops)" },
  { href: "/new", label: "Open Counter" },
  { href: "/me", label: "My Orders & Till" },
];

interface PageShellProps {
  children: React.ReactNode;
  nav?: ShopfrontNavItem[];
  title?: string;
  description?: string;
}

export default function PageShell({
  children,
  nav = DEFAULT_SHOP_NAV,
  title,
  description,
}: PageShellProps) {
  const links = footerLinks();
  const currentPath = usePathname();

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* Shopfront Top Striped Awning Ribbon */}
      <div className="h-2.5 w-full awning-stripes" aria-hidden="true" />

      {/* Main Shop Header */}
      <header className="sticky top-0 z-30 flex-shrink-0 bg-[var(--bg-surface)] border-b border-[var(--border-default)] shadow-xs">
        <div className="mx-auto w-full max-w-[1020px] px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 py-3">
            <Link
              href="/"
              className="flex items-center gap-2.5 no-underline group"
              aria-label="Counter Point of Sale Home"
            >
              <div className="w-8 h-8 rounded-sm bg-[#12351F] border border-[#F2A900] flex items-center justify-center text-[#F2A900] font-heading font-black text-lg group-hover:scale-105 transition-transform">
                C
              </div>
              <div>
                <span className="font-heading font-black text-xl tracking-tight text-[var(--text-primary)] block leading-none">
                  {app.name}
                </span>
                <span className="mono text-[10px] uppercase tracking-wider text-[var(--text-muted)] block mt-0.5">
                  Point-of-Sale
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <NetworkBadge />
              <div className="w-[155px] sm:w-[185px] flex-shrink-0">
                <ConnectButton />
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          {nav.length > 0 && (
            <nav className="flex items-center gap-1.5 -mb-px overflow-x-auto pt-1" aria-label="Shopfront Menu">
              {nav.map((item) => {
                const isActive = currentPath === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`nav-link flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold font-heading tracking-wide uppercase no-underline whitespace-nowrap border-b-2 transition-all ${
                      isActive
                        ? "text-[var(--accent-ink)] border-[var(--accent)] bg-[var(--bg-elevated)]/60"
                        : "text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)] hover:border-[var(--border-default)]"
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="mono text-[10px] px-1.5 py-0.2 bg-[var(--accent)] text-[var(--accent-ink)] rounded-xs">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
      </header>

      {/* Main Page Content */}
      <main className="flex-1 mx-auto w-full max-w-[1020px] px-4 py-6 sm:px-6 sm:py-8">
        {(title || description) && (
          <div className="mb-6 pb-4 border-b border-[var(--border-subtle)]">
            {title && (
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[var(--text-primary)] tracking-tight">
                {title}
              </h1>
            )}
            {description && (
              <p className="mt-1.5 text-sm text-[var(--text-secondary)] max-w-2xl leading-relaxed">
                {description}
              </p>
            )}
          </div>
        )}
        {children}
      </main>

      {/* Required Ecosystem Footer */}
      <footer className="mt-auto border-t-2 border-[var(--border-default)] bg-[var(--bg-surface)] py-6 text-xs">
        <div className="mx-auto w-full max-w-[1020px] px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                <span className="font-heading font-bold text-sm text-[var(--text-primary)]">
                  {app.name}
                </span>
                <span className="text-[var(--border-default)]">•</span>
                <span className="text-[var(--text-muted)]">{app.tagline}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px]">
              <span className="inline-flex items-center gap-1.5">
                <BuiltOnBotChain
                  className="uppercase tracking-wider font-semibold text-[11px] text-[var(--text-secondary)]"
                />
              </span>

              <a
                href={links.site}
                target="_blank"
                rel="noreferrer"
                className="underline text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                botchain.ai
              </a>

              <a
                href={links.explorer}
                target="_blank"
                rel="noreferrer"
                className="underline text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                BOT Chain Explorer
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
