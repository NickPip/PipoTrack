"use client";

import React, { useRef, useState } from "react";
import ConfirmModal from "@/components/shared/ConfirmModal";

// ── Design tokens ────────────────────────────────────────────────────────────

const PAD_Y = 14;
const PAD_X = 14;
const EDGE  = 24; // viewport inset for first/last cell + chrome

export const TD: React.CSSProperties = {
  padding: `${PAD_Y}px ${PAD_X}px`,
  borderBottom: "1px solid var(--line)",
  verticalAlign: "middle",
  color: "var(--ink-1)",
  fontSize: 13,
};

export const TD_MONO: React.CSSProperties = {
  ...TD,
  fontFamily: "var(--font-geist-mono, monospace)",
  fontSize: 12.5,
  letterSpacing: "-0.005em",
};

export const TD_DIM: React.CSSProperties = {
  ...TD,
  color: "var(--ink-3)",
};

export const Dim = ({ children }: { children?: React.ReactNode }) => (
  <span style={{ color: "var(--ink-4)" }}>{children ?? "—"}</span>
);

// ── Shared atoms ─────────────────────────────────────────────────────────────

export function KebabBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Row actions"
      style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "transparent", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", transition: "background 0.14s ease, color 0.14s ease" }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-soft)"; e.currentTarget.style.color = "var(--ink-1)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ink-3)"; }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
        <circle cx="7" cy="2.5" r="1.2" /><circle cx="7" cy="7" r="1.2" /><circle cx="7" cy="11.5" r="1.2" />
      </svg>
    </button>
  );
}

export function RowActions({ onEdit, onDelete, label }: { onEdit: () => void; onDelete: () => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const itemBase: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 8,
    width: "100%", padding: "7px 12px",
    background: "none", border: "none", cursor: "pointer",
    fontSize: 13, color: "var(--ink-1)", textAlign: "left",
    fontFamily: "inherit", transition: "background 0.1s",
  };

  return (
    <>
      <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
        <button
          onClick={() => setOpen(v => !v)}
          aria-label="Row actions"
          style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "transparent", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", transition: "background 0.14s, color 0.14s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-soft)"; e.currentTarget.style.color = "var(--ink-1)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ink-3)"; }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <circle cx="7" cy="2.5" r="1.2" /><circle cx="7" cy="7" r="1.2" /><circle cx="7" cy="11.5" r="1.2" />
          </svg>
        </button>
        {open && (
          <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 50, minWidth: 130, background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", padding: "4px 0", overflow: "hidden" }}>
            <button
              style={itemBase}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-soft)")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
              onClick={() => { setOpen(false); onEdit(); }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.5 1.5l2 2L4 11H2v-2L9.5 1.5z" />
              </svg>
              Edit
            </button>
            <button
              style={{ ...itemBase, color: "var(--danger)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--danger-bg)")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
              onClick={() => { setOpen(false); setConfirming(true); }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2,3.5 11,3.5" /><path d="M4.5 3.5V2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1" /><path d="M4 3.5l.5 7h4l.5-7" />
              </svg>
              Delete
            </button>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirming}
        label={label}
        onConfirm={() => { setConfirming(false); onDelete(); }}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

export function Avatar({ name }: { name: string }) {
  const ini = name.split(" ").slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
  return (
    <span style={{ display: "inline-grid", placeItems: "center", width: 22, height: 22, borderRadius: 999, background: "var(--ink-1)", color: "var(--bg)", fontSize: 9.5, fontWeight: 600, letterSpacing: "0.02em", flexShrink: 0, userSelect: "none" }}>
      {ini}
    </span>
  );
}

export function StackCell({ top, topSub, sub }: { top: string; topSub?: string; sub?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, lineHeight: 1.3 }}>
      <span>
        {top}
        {topSub && <span style={{ fontFamily: "var(--font-geist-mono, monospace)", color: "var(--ink-3)", fontSize: 11.5, marginLeft: 4 }}>{topSub}</span>}
      </span>
      {sub && <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{sub}</span>}
    </div>
  );
}

type StatusVariant = "inTransit" | "atPickup" | "dispatched" | "delivered" | "delayed" | "green" | "red" | "amber" | "gray";
const PILL_COLORS: Record<StatusVariant, { bg: string; fg: string; border: string }> = {
  inTransit:  { bg: "#eaf1fb", fg: "#1e4a8a", border: "#cfdcf2" },
  atPickup:   { bg: "#fdf2e9", fg: "#9a4f12", border: "#f4d6b5" },
  delivered:  { bg: "#ecf6f0", fg: "#1e6a44", border: "#cce6d7" },
  delayed:    { bg: "#fdecec", fg: "#a01a1a", border: "#f1c8c8" },
  dispatched: { bg: "#f3f3f1", fg: "#3f3f46", border: "#e3e3e0" },
  green:      { bg: "#ecf6f0", fg: "#1e6a44", border: "#cce6d7" },
  red:        { bg: "#fdecec", fg: "#a01a1a", border: "#f1c8c8" },
  amber:      { bg: "#fdf2e9", fg: "#9a4f12", border: "#f4d6b5" },
  gray:       { bg: "#f3f3f1", fg: "#3f3f46", border: "#e3e3e0" },
};

export function Pill({ label, variant = "gray" }: { label: string; variant?: StatusVariant }) {
  const c = PILL_COLORS[variant] ?? PILL_COLORS.gray;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 22, padding: "0 8px", borderRadius: 999, background: c.bg, color: c.fg, border: `1px solid ${c.border}`, fontSize: 11.5, fontWeight: 500, letterSpacing: "-0.003em", whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", opacity: 0.85, flexShrink: 0 }} />
      {label}
    </span>
  );
}

// ── Column config ─────────────────────────────────────────────────────────────

export interface ColDef {
  label: string;
  align?: "left" | "right" | "center";
  width?: number;
}

// ── Filter chip config ────────────────────────────────────────────────────────

export interface FilterChip {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}

// ── PageTable props ───────────────────────────────────────────────────────────

interface PageTableProps<T> {
  // Header
  breadcrumb: string | string[];
  title: string;
  subtitle?: string;
  count?: number;
  isLoading: boolean;
  actions?: React.ReactNode;

  // Filter bar
  search: string;
  onSearchChange: (v: string) => void;
  filterChips?: FilterChip[];

  // Table
  columns: ColDef[];
  rows: T[];
  rowKey: (row: T) => string;
  renderCells: (row: T, isLast: boolean) => React.ReactNode;
  emptyMessage?: string;
  emptyBody?: string;

  // Pagination (default 20)
  perPage?: number;
}

// ── Component ────────────────────────────────────────────────────────────────

const PER_PAGE_DEFAULT = 20;

export default function PageTable<T>({
  breadcrumb,
  title,
  subtitle,
  count,
  isLoading,
  actions,
  search,
  onSearchChange,
  filterChips = [],
  columns,
  rows,
  rowKey,
  renderCells,
  emptyMessage = "No results found",
  emptyBody = "Try adjusting your search or filters.",
  perPage = PER_PAGE_DEFAULT,
}: PageTableProps<T>) {
  const [page, setPage] = useState(1);
  const crumbs = Array.isArray(breadcrumb) ? breadcrumb : [breadcrumb];

  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
  const safePage   = Math.min(page, totalPages);
  const paginated  = rows.slice((safePage - 1) * perPage, safePage * perPage);

  const FONT: React.CSSProperties = {
    fontFamily: "var(--font-geist-sans, ui-sans-serif, system-ui, -apple-system, sans-serif)",
    WebkitFontSmoothing: "antialiased",
  };

  const TH_STYLE: React.CSSProperties = {
    padding: `10px ${PAD_X}px`,
    fontSize: 11,
    fontWeight: 600,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: "0.075em",
    whiteSpace: "nowrap",
    background: "var(--paper)",
    borderTop: "1px solid var(--line)",
    borderBottom: "1px solid var(--line)",
    textAlign: "left",
  };

  const btnGhost: React.CSSProperties = { height: 34, padding: "0 12px", borderRadius: 9, border: "none", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 500, letterSpacing: "-0.005em", color: "var(--ink-2)", display: "flex", alignItems: "center", gap: 6, transition: "background 0.14s ease, color 0.14s ease" };
  const btnPrimary: React.CSSProperties = { height: 34, padding: "0 14px", borderRadius: 9, border: "1px solid var(--ink-1)", background: "var(--ink-1)", cursor: "pointer", fontSize: 13, fontWeight: 600, letterSpacing: "-0.005em", color: "var(--bg)", display: "flex", alignItems: "center", gap: 6, transition: "background 0.14s ease" };

  return (
    <div style={{ marginLeft: -24, marginRight: -24, marginTop: "-2rem", background: "var(--bg)", ...FONT }}>

      {/* ── Page header ── */}
      <div style={{ padding: "24px 24px 8px" }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-3)", marginBottom: 12 }}>
          {crumbs.map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={{ color: "var(--ink-4)" }}>/</span>}
              <span>{c}</span>
            </React.Fragment>
          ))}
        </div>

        {/* Title row */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: "-0.022em", color: "var(--ink-1)" }}>
              {title}
              {count !== undefined && (
                <span style={{ fontSize: 18, fontWeight: 500, letterSpacing: "-0.005em", color: "var(--ink-3)", marginLeft: 6 }}>
                  · {isLoading ? "—" : count}
                </span>
              )}
            </h1>
            {subtitle && (
              <p style={{ margin: "4px 0 0", fontSize: 13.5, fontWeight: 400, color: "var(--ink-3)" }}>
                {subtitle}
              </p>
            )}
          </div>

          {actions && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {actions}
            </div>
          )}
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div style={{ padding: "12px 24px", borderBottom: "1px solid var(--line)", background: "var(--bg)", display: "flex", alignItems: "center", gap: 8, minHeight: 60, boxSizing: "border-box" }}>
        {/* Search */}
        <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--ink-4)" strokeWidth="1.5" strokeLinecap="round" style={{ position: "absolute", left: 10, pointerEvents: "none" }}>
            <circle cx="6" cy="6" r="4" /><line x1="9.5" y1="9.5" x2="12.5" y2="12.5" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => { onSearchChange(e.target.value); setPage(1); }}
            placeholder="Search…"
            style={{ width: "100%", height: 36, paddingLeft: 32, paddingRight: 68, borderRadius: 10, border: "1px solid var(--line)", background: "var(--paper)", fontSize: 13.5, color: "var(--ink-1)", outline: "none", fontFamily: "inherit", transition: "border-color 0.15s ease, background 0.15s ease", boxSizing: "border-box" }}
            onFocus={e => { e.currentTarget.style.borderColor = "var(--ink-3)"; e.currentTarget.style.background = "var(--bg)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "var(--line)"; e.currentTarget.style.background = "var(--paper)"; }}
          />
          <div style={{ position: "absolute", right: 10, display: "flex", alignItems: "center", gap: 2, pointerEvents: "none" }}>
            {["⌘", "K"].map(k => (
              <kbd key={k} style={{ padding: "1px 6px", border: "1px solid var(--line-strong)", borderBottomWidth: 2, borderRadius: 5, fontSize: 10.5, fontWeight: 500, fontFamily: "var(--font-geist-mono, monospace)", color: "var(--ink-3)", background: "var(--bg)" }}>{k}</kbd>
            ))}
          </div>
        </div>

        {/* Filter chips */}
        {filterChips.map(chip => {
          const active = chip.value !== "all";
          const label  = chip.options.find(o => o.value === chip.value)?.label ?? "All";
          function cycle() {
            const opts = [{ value: "all", label: "All" }, ...chip.options];
            const idx  = opts.findIndex(o => o.value === chip.value);
            chip.onChange(opts[(idx + 1) % opts.length].value);
            setPage(1);
          }
          return (
            <button
              key={chip.label}
              onClick={cycle}
              style={{ height: 32, padding: "0 10px", borderRadius: 999, border: `1px solid ${active ? "var(--ink-1)" : "var(--line-strong)"}`, background: active ? "var(--ink-1)" : "var(--bg)", color: active ? "var(--bg)" : "var(--ink-1)", fontSize: 12.5, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", transition: "background 0.14s ease, border-color 0.14s ease" }}
            >
              <span style={{ color: active ? "rgba(255,255,255,0.65)" : "var(--ink-3)" }}>{chip.label}</span>
              <span style={{ marginLeft: 2 }}>{active ? label : "All"}</span>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ opacity: 0.6 }}><polyline points="2,4 5.5,7 9,4" /></svg>
            </button>
          );
        })}
      </div>

      {/* ── Table ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "var(--ink-1)" }}>
        <thead>
          <tr>
            {columns.map((col, ci) => (
              <th
                key={ci}
                style={{
                  ...TH_STYLE,
                  textAlign: col.align ?? "left",
                  width: col.width,
                  paddingLeft:  ci === 0                    ? EDGE : PAD_X,
                  paddingRight: ci === columns.length - 1   ? EDGE : PAD_X,
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {/* Loading skeleton */}
          {isLoading && Array.from({ length: 7 }).map((_, ri) => (
            <tr key={ri}>
              {columns.map((col, ci) => (
                <td key={ci} style={{ ...TD, paddingLeft: ci === 0 ? EDGE : PAD_X, paddingRight: ci === columns.length - 1 ? EDGE : PAD_X }}>
                  <div style={{ height: 12, borderRadius: 4, background: "var(--bg-soft)", width: col.width ?? "70%" }} />
                </td>
              ))}
            </tr>
          ))}

          {/* Empty state */}
          {!isLoading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} style={{ padding: 0, border: "none" }}>
                <div style={{ height: 260, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 999, background: "var(--bg-soft)", boxShadow: "inset 0 0 0 1px var(--line)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)" }}>
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <circle cx="9.5" cy="9.5" r="7" /><line x1="15" y1="15" x2="19" y2="19" /><line x1="7" y1="9.5" x2="12" y2="9.5" />
                    </svg>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--ink-1)" }}>{emptyMessage}</p>
                    <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-3)" }}>{emptyBody}</p>
                  </div>
                  {search && (
                    <button onClick={() => onSearchChange("")} style={{ height: 32, padding: "0 14px", borderRadius: 8, border: "1px solid var(--line-strong)", background: "var(--bg)", fontSize: 13, fontWeight: 500, color: "var(--ink-1)", cursor: "pointer" }}>
                      Clear search
                    </button>
                  )}
                </div>
              </td>
            </tr>
          )}

          {/* Data rows */}
          {!isLoading && paginated.map((row, ri) => {
            const isLast = ri === paginated.length - 1;
            return (
              <tr
                key={rowKey(row)}
                style={{ transition: "background 0.12s ease" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-soft)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = ""; }}
              >
                {renderCells(row, isLast)}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ── Footer ── */}
      {!isLoading && rows.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", borderTop: "1px solid var(--line)", background: "var(--bg)" }}>
          <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
            Showing{" "}
            <span style={{ color: "var(--ink-1)", fontWeight: 500 }}>
              {Math.min((safePage - 1) * perPage + 1, rows.length)}–{Math.min(safePage * perPage, rows.length)}
            </span>
            {" "}of{" "}
            <span style={{ color: "var(--ink-1)", fontWeight: 500 }}>{rows.length}</span>
          </span>
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} style={{ height: 28, padding: "0 10px", borderRadius: 7, border: "1px solid var(--line-strong)", background: "transparent", fontSize: 12.5, fontWeight: 500, color: safePage === 1 ? "var(--ink-4)" : "var(--ink-2)", cursor: safePage === 1 ? "default" : "pointer" }}>← Prev</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)} style={{ height: 28, minWidth: 28, padding: "0 8px", borderRadius: 7, border: "none", fontSize: 12.5, fontWeight: 500, background: p === safePage ? "var(--ink-1)" : "transparent", color: p === safePage ? "var(--bg)" : "var(--ink-2)", cursor: "pointer" }}>{p}</button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} style={{ height: 28, padding: "0 10px", borderRadius: 7, border: "1px solid var(--line-strong)", background: "transparent", fontSize: 12.5, fontWeight: 500, color: safePage === totalPages ? "var(--ink-4)" : "var(--ink-2)", cursor: safePage === totalPages ? "default" : "pointer" }}>Next →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Action button helpers (for use in `actions` prop) ────────────────────────

export function PrimaryBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{ height: 34, padding: "0 14px", borderRadius: 9, border: "1px solid var(--ink-1)", background: "var(--ink-1)", cursor: "pointer", fontSize: 13, fontWeight: 600, letterSpacing: "-0.005em", color: "var(--bg)", display: "flex", alignItems: "center", gap: 6, transition: "background 0.14s ease", whiteSpace: "nowrap" }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--ink-0)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "var(--ink-1)"; }}
    >
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="6.5" y1="1.5" x2="6.5" y2="11.5" /><line x1="1.5" y1="6.5" x2="11.5" y2="6.5" />
      </svg>
      {children}
    </button>
  );
}

// ── Cell edge padding helpers ─────────────────────────────────────────────────
// Use these on the first and last <td> of each row so content lines up with chrome

export const FIRST_TD: React.CSSProperties = { paddingLeft: EDGE };
export const LAST_TD:  React.CSSProperties  = { paddingRight: EDGE };
