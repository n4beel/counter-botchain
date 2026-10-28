import React, { HTMLAttributes } from "react";

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  noPadding?: boolean;
  dashed?: boolean;
  awningStrip?: boolean;
}

export default function Panel({
  elevated = false,
  noPadding = false,
  dashed = false,
  awningStrip = false,
  children,
  className = "",
  ...props
}: PanelProps) {
  return (
    <div
      className={[
        "relative rounded-lg overflow-hidden transition-all duration-150",
        elevated ? "bg-[var(--bg-elevated)] shadow-xs" : "bg-[var(--bg-surface)]",
        dashed
          ? "border-2 border-dashed border-[var(--border-default)]"
          : "border border-[var(--border-default)]",
        noPadding ? "" : "p-5 sm:p-6",
        className,
      ].join(" ")}
      {...props}
    >
      {awningStrip && (
        <div className="h-1.5 w-full awning-stripes-mini absolute top-0 left-0 right-0" />
      )}
      {children}
    </div>
  );
}
