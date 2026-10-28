import React from "react";

interface AwningProps {
  name: string;
  subtitle?: string;
  mini?: boolean;
}

export default function Awning({ name, subtitle, mini = false }: AwningProps) {
  if (mini) {
    return (
      <div className="relative overflow-hidden rounded-t-lg shadow-sm border border-[var(--border-default)]">
        {/* Striped Canopy */}
        <div className="h-16 w-full awning-stripes-mini flex items-center justify-center p-2 relative shadow-inner">
          <div className="bg-[#FFFFFF]/90 backdrop-blur-xs px-3 py-1 rounded-sm border border-[var(--border-subtle)] text-center max-w-[90%] shadow-xs">
            <h3 className="font-heading font-bold text-[15px] text-[var(--text-primary)] truncate">
              {name}
            </h3>
          </div>
        </div>

        {/* Scalloped Valance Edge */}
        <div className="h-2 w-full flex overflow-hidden bg-[#12351F]">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-3 rounded-b-full ${
                i % 2 === 0 ? "bg-[#F2A900]" : "bg-[#12351F]"
              }`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative mb-6 rounded-t-xl overflow-hidden shadow-md border border-[var(--border-default)] bg-[var(--bg-surface)]">
      {/* 24px Striped Canopy */}
      <div className="h-28 sm:h-32 w-full awning-stripes flex items-center justify-center p-4 relative shadow-inner">
        {/* Name plaque hanging from awning */}
        <div className="bg-[#FFFFFF] px-6 py-2.5 rounded-sm border-2 border-[var(--border-default)] text-center shadow-md max-w-[90%]">
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-[var(--text-primary)] tracking-tight">
            {name}
          </h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5 font-medium">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Scalloped edge valance */}
      <div className="h-3 w-full flex overflow-hidden bg-[#12351F]">
        {Array.from({ length: 32 }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-4 rounded-b-full ${
              i % 2 === 0 ? "bg-[#F2A900]" : "bg-[#12351F]"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
