"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AvailDriver {
  id: string;
  name: string;
  dlNumber: string | null;
  vehicleType: string | null;
  currentZip: string | null;
  city: string | null;
  state: string | null;
  gpsCity: string | null;
  gpsState: string | null;
  gpsZip: string | null;
  streetAddress: string | null;
  unitNumber: string | null;
  unitDimensions: { length?: number; width?: number; height?: number } | null;
  locationUpdatedAt: string | null;
  isOnline: boolean;
  outMiles: number;
  minMiles: number;
  maxMiles: number;
  wayDirection: string;
  isAvailable: boolean;
  availableAt: string | null;
}

// ── Design tokens (handoff) ───────────────────────────────────────────────────

const T = {
  bg:          "#FBFAF7",
  bgSunk:      "#F4F2EC",
  bgCard:      "#FFFFFF",
  line:        "#E8E4DA",
  lineStrong:  "#D6D0C2",
  lineSoft:    "#EFECE3",
  ink:         "#1B1A17",
  ink2:        "#4A4842",
  ink3:        "#7A776E",
  ink4:        "#A5A299",
  accent:      "#1F5E3B",
  accentSoft:  "#E4EFE6",
  accentInk:   "#0E3A24",
  warn:        "#B97309",
  warnSoft:    "#FBEDD5",
  bad:         "#A6321D",
  badSoft:     "#F6DDD4",
  info:        "#1F4A8C",
  infoSoft:    "#DFE7F2",
  selFill:     "#13110D",
  selInk:      "#F5EFD9",
};

const MONO = "var(--font-geist-mono, ui-monospace, SFMono-Regular, monospace)";

// ── Config ────────────────────────────────────────────────────────────────────

const REGIONS = [
  { name: "WEST",      states: ["WA","OR","CA","NV","ID","UT","CO","WY","MT"] },
  { name: "SOUTHWEST", states: ["AZ","NM","OK","TX"] },
  { name: "MIDWEST",   states: ["ND","SD","NE","KS","MN","IA","MO","WI","IL","IN","MI","OH"] },
  { name: "NORTHEAST", states: ["PA","MD","DE","NJ","NY","CT","RI","MA","NH","VT","ME"] },
  { name: "SOUTHEAST", states: ["AR","LA","MS","AL","TN","KY","GA","FL","SC","NC","VA","WV","DC"] },
];

const ALL_STATES = REGIONS.flatMap((r) => r.states);

const WAY_OPTIONS = ["ANY","N","S","E","W","NE","NW","SE","SW"];
const OUT_OPTIONS  = [25,50,75,100,150,200,250,300,400,500];
const MIN_OPTIONS  = [0,25,50,100,150,200,300,500];
const MAX_OPTIONS  = [500,1000,2000,3000,5000,7500,10000];

const PAGE_SIZE = 25;

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string | null) {
  if (!dateStr) return { label: "—", exact: "", mins: -1 };
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const exact = new Date(dateStr).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const label =
    mins < 1   ? "just now"
    : mins < 60 ? `${mins}m ago`
    : `${Math.floor(mins / 60)}h ago`;
  return { label, exact, mins };
}

function fmtDims(d: { length?: number; width?: number; height?: number } | null) {
  if (!d?.length) return "—";
  return [d.length, d.width, d.height].filter(Boolean).join(" × ");
}

function fmtN(n: number) { return n.toLocaleString("en-US"); }

function sinceLabel(mins: number) {
  if (mins < 1) return "just now";
  if (mins < 60) return `since ${mins}m`;
  return `since ${Math.floor(mins / 60)}h`;
}

// ── InfoSelect ────────────────────────────────────────────────────────────────

function InfoSelect({
  value, options, onChange,
}: {
  value: string | number;
  options: (string | number)[];
  onChange: (v: string) => void;
}) {
  const allOpts = options.map(String);
  const strVal = String(value);
  const merged = allOpts.includes(strVal) ? allOpts : [strVal, ...allOpts].sort((a, b) => +a - +b);

  return (
    <select
      value={strVal}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      style={{
        height: 24,
        width: 72,
        border: `1px solid ${T.line}`,
        borderRadius: 6,
        padding: "0 20px 0 8px",
        fontSize: 11.5,
        color: T.ink,
        background:
          `${T.bgSunk} url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='5' viewBox='0 0 9 5'%3E%3Cpath d='M1 1l3.5 3L8 1' stroke='%237A776E' stroke-width='1.4' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 6px center`,
        WebkitAppearance: "none",
        appearance: "none",
        cursor: "pointer",
        outline: "none",
        fontFamily: MONO,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.01em",
      }}
    >
      {merged.map((o) => (
        <option key={o} value={o}>
          {isNaN(Number(o)) ? o : fmtN(Number(o))}
        </option>
      ))}
    </select>
  );
}

// ── Region checkbox (empty / partial / on) ───────────────────────────────────

function RegionCheckbox({
  state, onClick,
}: {
  state: "empty" | "partial" | "on";
  onClick: () => void;
}) {
  const filled = state === "on";
  const partial = state === "partial";
  return (
    <button
      role="checkbox"
      aria-checked={filled ? true : partial ? "mixed" : false}
      onClick={onClick}
      style={{
        width: 14, height: 14, borderRadius: 3,
        border: `1.5px solid ${filled ? T.accent : T.lineStrong}`,
        background: filled ? T.accent : partial ? T.bgSunk : T.bgCard,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", padding: 0, flexShrink: 0,
        transition: "background 120ms, border-color 120ms",
      }}
    >
      {filled && (
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
          <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {partial && (
        <span style={{ width: 6, height: 2, background: T.ink2, borderRadius: 1 }} />
      )}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AvailabilitiesTable() {
  const [drivers, setDrivers] = useState<AvailDriver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStates, setSelectedStates] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const fetchDrivers = useCallback(() => {
    setIsLoading(true);
    fetch("/api/drivers/availabilities")
      .then((r) => r.json())
      .then((d) => { setDrivers(d.drivers ?? []); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/drivers/availabilities")
      .then((r) => r.json())
      .then((d) => { setDrivers(d.drivers ?? []); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, []);

  // ── Derived state ─────────────────────────────────────────────────────────

  const stateCounts = useMemo(() =>
    drivers.reduce<Record<string, number>>((acc, d) => {
      if (d.state) acc[d.state] = (acc[d.state] ?? 0) + 1;
      return acc;
    }, {}),
  [drivers]);

  const vehicleCounts = useMemo(() =>
    drivers.reduce<Record<string, number>>((acc, d) => {
      const t = d.vehicleType ?? "Other";
      acc[t] = (acc[t] ?? 0) + 1;
      return acc;
    }, {}),
  [drivers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return drivers
      .filter((d) => {
        if (selectedStates.size > 0 && (!d.state || !selectedStates.has(d.state))) return false;
        if (q) {
          return (
            d.name.toLowerCase().includes(q) ||
            (d.currentZip ?? "").includes(q) ||
            (d.city ?? "").toLowerCase().includes(q) ||
            (d.unitNumber ?? "").toLowerCase().includes(q) ||
            (d.dlNumber ?? "").toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (!a.locationUpdatedAt) return 1;
        if (!b.locationUpdatedAt) return -1;
        return new Date(b.locationUpdatedAt).getTime() - new Date(a.locationUpdatedAt).getTime();
      });
  }, [drivers, selectedStates, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalDrivers = drivers.length;
  const stateCount = Object.keys(stateCounts).length;
  const staleCount = drivers.filter((d) => {
    if (!d.locationUpdatedAt) return false;
    return Date.now() - new Date(d.locationUpdatedAt).getTime() > 2 * 60 * 60 * 1000;
  }).length;

  // ── Actions ───────────────────────────────────────────────────────────────

  const patch = useCallback(async (id: string, updates: Record<string, unknown>) => {
    setDrivers((prev) => prev.map((d) => d.id === id ? { ...d, ...updates } : d));
    await fetch("/api/drivers/availabilities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
  }, []);

  const toggleState = useCallback((state: string) => {
    setPage(1);
    setSelectedStates((prev) => {
      const next = new Set(prev);
      if (next.has(state)) next.delete(state); else next.add(state);
      return next;
    });
  }, []);

  const toggleRegion = useCallback((states: string[]) => {
    setPage(1);
    setSelectedStates((prev) => {
      const next = new Set(prev);
      const allOn = states.every((s) => next.has(s));
      if (allOn) states.forEach((s) => next.delete(s));
      else states.forEach((s) => next.add(s));
      return next;
    });
  }, []);

  const removeState = useCallback((state: string) => {
    setPage(1);
    setSelectedStates((prev) => { const n = new Set(prev); n.delete(state); return n; });
  }, []);

  const clearAll = useCallback(() => {
    setPage(1);
    setSelectedStates(new Set());
  }, []);

  const invertSelection = useCallback(() => {
    setPage(1);
    setSelectedStates((prev) => {
      const next = new Set<string>();
      ALL_STATES.forEach((s) => { if (!prev.has(s)) next.add(s); });
      return next;
    });
  }, []);

  const toggleCollapse = useCallback((name: string) => {
    setCollapsed((prev) => { const n = new Set(prev); if (n.has(name)) n.delete(name); else n.add(name); return n; });
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  const headerCell: React.CSSProperties = {
    padding: "10px 14px",
    textAlign: "left",
    fontSize: 10.5,
    fontWeight: 600,
    color: T.ink4,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    borderBottom: `1px solid ${T.lineSoft}`,
    background: T.bg,
  };

  const filteredDriversTotal = filtered.length;
  const selectedDriversCount = selectedStates.size > 0
    ? Array.from(selectedStates).reduce((s, c) => s + (stateCounts[c] ?? 0), 0)
    : totalDrivers;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, color: T.ink, fontVariantNumeric: "tabular-nums" }}>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <p style={{ flex: 1, fontSize: 13, color: T.ink3, margin: 0, maxWidth: 820, lineHeight: 1.5 }}>
          View and manage driver availability by region.{" "}
          <strong style={{ color: T.ink }}>{totalDrivers} drivers</strong> across{" "}
          <strong style={{ color: T.ink }}>{stateCount} states</strong>
          {selectedStates.size > 0 && (
            <>
              {" · "}
              <strong style={{ color: T.accent }}>{filteredDriversTotal} match</strong>{" "}
              your current filter ({Array.from(selectedStates).join(", ")})
            </>
          )}
          {staleCount > 0 && (
            <>
              {". "}
              <span style={{ color: T.warn }}>{staleCount} drivers haven&apos;t checked in for &gt; 2h.</span>
            </>
          )}
        </p>
        <button
          onClick={fetchDrivers}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px",
            borderRadius: 6, border: `1px solid ${T.line}`, background: T.bgCard,
            fontSize: 12.5, fontWeight: 500, color: T.ink2, cursor: "pointer", whiteSpace: "nowrap",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 6.5a5.5 5.5 0 1 0 5.5-5.5A5.5 5.5 0 0 0 2.5 3L1 1.5" />
            <path d="M1 4V1.5h2.5" />
          </svg>
          Refresh feed
        </button>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0% { box-shadow: 0 0 0 0 rgba(31, 94, 59, 0.45); }
          70% { box-shadow: 0 0 0 6px rgba(31, 94, 59, 0); }
          100% { box-shadow: 0 0 0 0 rgba(31, 94, 59, 0); }
        }
        @keyframes ping-ring {
          0% { transform: scale(1); opacity: 0.7; }
          80%, 100% { transform: scale(2); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pulse-dot, .ping-ring { animation: none !important; }
        }
      `}</style>

      {/* ── Filters card ─────────────────────────────────────────────────── */}
      <div style={{ background: T.bgCard, border: `1px solid ${T.line}`, borderRadius: 12, overflow: "hidden" }}>

        {/* Filter header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", borderBottom: `1px solid ${T.lineSoft}`,
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Regional filters</span>
            <span style={{ fontSize: 11.5, color: T.ink3 }}>
              <strong style={{ color: T.accent, fontWeight: 700 }}>{selectedStates.size}</strong> states selected ·{" "}
              <strong style={{ color: T.accent, fontWeight: 700 }}>{selectedDriversCount}</strong> drivers
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              onClick={invertSelection}
              style={{ background: "none", border: "none", padding: 0, fontSize: 12, color: T.ink3, cursor: "pointer" }}
            >
              Invert
            </button>
            <button
              onClick={clearAll}
              disabled={selectedStates.size === 0}
              style={{
                background: "none", border: "none", padding: 0, fontSize: 12,
                color: selectedStates.size === 0 ? T.ink4 : T.ink3,
                cursor: selectedStates.size === 0 ? "default" : "pointer",
              }}
            >
              Clear all
            </button>
          </div>
        </div>

        {/* Regions */}
        <div style={{ padding: "6px 12px 14px" }}>
          {REGIONS.map((region, ri) => {
            const isCollapsed = collapsed.has(region.name);
            const selectedInRegion = region.states.filter((s) => selectedStates.has(s)).length;
            const checkboxState: "empty" | "partial" | "on" =
              selectedInRegion === 0 ? "empty"
              : selectedInRegion === region.states.length ? "on"
              : "partial";
            const regionCount = region.states.reduce((sum, s) => sum + (stateCounts[s] ?? 0), 0);

            return (
              <div
                key={region.name}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "12px 6px",
                  borderBottom: ri < REGIONS.length - 1 ? `1px solid ${T.lineSoft}` : "none",
                }}
              >
                {/* Left rail (124 px) */}
                <div style={{ width: 124, flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <RegionCheckbox state={checkboxState} onClick={() => toggleRegion(region.states)} />
                    <button
                      onClick={() => toggleCollapse(region.name)}
                      style={{
                        background: "none", border: "none", padding: 0, cursor: "pointer",
                        fontSize: 11, fontWeight: 700, color: T.ink, letterSpacing: "0.06em",
                      }}
                    >
                      {region.name}
                    </button>
                  </div>
                  <div style={{ fontSize: 10.5, color: T.ink3, marginTop: 4, marginLeft: 22, fontFamily: MONO }}>
                    {region.states.length} states · {regionCount} drivers
                  </div>
                </div>

                {/* State chips */}
                {!isCollapsed && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, flex: 1, paddingTop: 1 }}>
                    {region.states.map((state) => {
                      const count = stateCounts[state] ?? 0;
                      const selected = selectedStates.has(state);
                      const isZero = count === 0 && !selected;
                      const isHot = count >= 5 && !selected;

                      return (
                        <button
                          key={state}
                          onClick={() => toggleState(state)}
                          aria-pressed={selected}
                          style={{
                            position: "relative",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            height: 26,
                            padding: "0 8px 0 10px",
                            borderRadius: 7,
                            border: `1px solid ${
                              selected ? T.selFill
                              : isHot   ? T.accent
                              : T.line
                            }`,
                            background: selected ? T.selFill : T.bgCard,
                            cursor: "pointer",
                            transition: "background 120ms, border-color 120ms, color 120ms",
                          }}
                        >
                          <span
                            style={{
                              fontFamily: MONO,
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: selected ? T.selInk : isZero ? T.ink4 : T.ink,
                              letterSpacing: "0.01em",
                            }}
                          >
                            {state}
                          </span>
                          <span
                            style={{
                              minWidth: 18,
                              height: 16,
                              padding: "0 5px",
                              borderRadius: 999,
                              background: selected
                                ? "rgba(245,239,217,0.18)"
                                : isHot
                                  ? T.accentSoft
                                  : T.bgSunk,
                              color: selected
                                ? T.selInk
                                : isHot
                                  ? T.accentInk
                                  : isZero
                                    ? T.ink4
                                    : T.ink2,
                              fontFamily: MONO,
                              fontSize: 10.5,
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Collapse toggle (kept tiny on right) */}
                <button
                  onClick={() => toggleCollapse(region.name)}
                  aria-label={isCollapsed ? "Expand region" : "Collapse region"}
                  style={{
                    width: 22, height: 22, borderRadius: 5,
                    border: `1px solid ${T.line}`, background: T.bgCard,
                    cursor: "pointer", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: T.ink3, fontSize: 11, fontWeight: 500, lineHeight: 1, padding: 0,
                    marginTop: 0,
                  }}
                >
                  {isCollapsed ? "+" : "−"}
                </button>
              </div>
            );
          })}
        </div>

        {/* Search row */}
        <div style={{ padding: "0 18px 18px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 0,
              height: 40,
              border: `1px solid ${T.line}`,
              borderRadius: 8,
              background: T.bgSunk,
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, padding: "0 14px" }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={T.ink3} strokeWidth="1.6">
                <circle cx="6" cy="6" r="4.5" />
                <path d="m9.5 9.5 2.5 2.5" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Search by Zip, address, unit number, driver name, or DOT..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: 13,
                  color: T.ink,
                }}
              />
            </div>

            {Object.keys(vehicleCounts).length > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "0 16px",
                  borderLeft: `1px solid ${T.line}`,
                  height: "100%",
                }}
              >
                {Object.entries(vehicleCounts).map(([type, count]) => (
                  <span key={type} style={{ fontSize: 11.5, color: T.ink3, whiteSpace: "nowrap" }}>
                    {type.split(" ")[0]}{" "}
                    <span style={{ fontWeight: 700, color: T.ink, fontFamily: MONO }}>{count}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Selected pill strip */}
          {selectedStates.size > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: T.ink4,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                SELECTED
              </span>
              {Array.from(selectedStates).map((state) => (
                <span
                  key={state}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    height: 22,
                    padding: "0 4px 0 10px",
                    borderRadius: 999,
                    background: T.accentSoft,
                    color: T.accentInk,
                    fontSize: 11.5,
                    fontWeight: 600,
                    fontFamily: MONO,
                  }}
                >
                  {state}
                  <button
                    onClick={() => removeState(state)}
                    aria-label={`Remove ${state}`}
                    style={{
                      width: 16, height: 16, borderRadius: 999,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      border: "none", background: "transparent", color: T.accentInk,
                      cursor: "pointer", padding: 0,
                    }}
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                      <path d="M1 1l6 6M7 1l-6 6" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Driver table card ─────────────────────────────────────────────── */}
      <div style={{ background: T.bgCard, border: `1px solid ${T.line}`, borderRadius: 12, overflow: "hidden" }}>

        {/* Table toolbar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "13px 18px",
            borderBottom: `1px solid ${T.lineSoft}`,
            gap: 10,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Available drivers</span>
          <span style={{ fontSize: 12, color: T.ink3 }}>
            Showing <strong style={{ color: T.ink2, fontWeight: 600 }}>{paginated.length}</strong> of{" "}
            <strong style={{ color: T.ink2, fontWeight: 600 }}>{filtered.length}</strong> · sorted by check-in time
          </span>
          <div style={{ flex: 1 }} />

          <button
            onClick={fetchDrivers}
            aria-label="Refresh"
            style={{
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid ${T.line}`,
              borderRadius: 6,
              background: T.bgCard,
              color: T.ink3,
              cursor: "pointer",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 6.5a5.5 5.5 0 1 0 5.5-5.5A5.5 5.5 0 0 0 2.5 3L1 1.5" />
              <path d="M1 4V1.5h2.5" />
            </svg>
          </button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div style={{ padding: "52px 20px", textAlign: "center", color: T.ink4, fontSize: 13 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "52px 20px", textAlign: "center", color: T.ink4, fontSize: 13 }}>
            {selectedStates.size > 0 ? (
              <>
                No drivers in <strong style={{ color: T.ink }}>{Array.from(selectedStates).join(", ")}</strong>.{" "}
                <button
                  onClick={clearAll}
                  style={{ background: "none", border: "none", padding: 0, color: T.accent, fontWeight: 600, cursor: "pointer" }}
                >
                  Clear filter
                </button>
              </>
            ) : (
              "No drivers match the current filters."
            )}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980, fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th style={{ ...headerCell, width: 80 }}>Unit</th>
                  <th style={{ ...headerCell }}>Driver</th>
                  <th style={{ ...headerCell }}>Current Location</th>
                  <th style={{ ...headerCell }}>Delivery Location / ZIP</th>
                  <th style={{ ...headerCell }}>Truck</th>
                  <th style={{ ...headerCell }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      Updated
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M5 2v6M2.5 5.5L5 8l2.5-2.5" />
                      </svg>
                    </span>
                  </th>
                  <th style={{ ...headerCell, minWidth: 220 }}>Info</th>
                  <th style={{ ...headerCell }}>Availability</th>
                  <th style={{ ...headerCell, textAlign: "right" }}>Notify</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((driver, idx) => {
                  const { label: updLabel, exact: updExact, mins: updMins } = timeAgo(driver.locationUpdatedAt);
                  const isStale = updMins >= 120 && updMins !== -1;
                  const isOldUpdate = updMins >= 30 && updMins !== -1;

                  return (
                    <tr
                      key={driver.id}
                      style={{
                        borderBottom: idx < paginated.length - 1 ? `1px solid ${T.lineSoft}` : "none",
                      }}
                    >
                      {/* Unit */}
                      <td style={{ padding: "13px 14px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ position: "relative", width: 8, height: 8, flexShrink: 0 }}>
                            <span
                              style={{
                                position: "absolute", inset: 0, borderRadius: "50%",
                                background: driver.isOnline ? T.accent : T.ink4,
                              }}
                            />
                            {driver.isOnline && (
                              <span
                                aria-hidden
                                className="ping-ring"
                                style={{
                                  position: "absolute", inset: 0, borderRadius: "50%",
                                  background: T.accent, opacity: 0.4,
                                  animation: "ping-ring 1.8s ease-out infinite",
                                }}
                              />
                            )}
                          </span>
                          <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: T.ink }}>
                            {driver.unitNumber ?? "—"}
                          </span>
                        </div>
                      </td>

                      {/* Driver */}
                      <td style={{ padding: "13px 14px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{driver.name}</div>
                        {driver.dlNumber && (
                          <div style={{ fontSize: 10.5, color: T.ink4, fontFamily: MONO, marginTop: 1 }}>
                            DOT-{driver.dlNumber}
                          </div>
                        )}
                      </td>

                      {/* Current Location */}
                      <td style={{ padding: "13px 14px", verticalAlign: "middle" }}>
                        {driver.streetAddress ? (
                          <>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, maxWidth: 220 }}>{driver.streetAddress}</div>
                            {driver.gpsZip && (
                              <div style={{ fontSize: 11, color: T.ink4, fontFamily: MONO, marginTop: 1 }}>
                                {driver.gpsState} {driver.gpsZip}
                              </div>
                            )}
                          </>
                        ) : driver.gpsCity ? (
                          <>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>
                              {driver.gpsCity}, {driver.gpsState}
                            </div>
                            <div style={{ fontSize: 11, color: T.ink4, fontFamily: MONO, marginTop: 1 }}>
                              {driver.gpsState} {driver.gpsZip}
                            </div>
                          </>
                        ) : (
                          <span style={{ fontSize: 12.5, color: T.ink4 }}>—</span>
                        )}
                      </td>

                      {/* Delivery Location / ZIP */}
                      <td style={{ padding: "13px 14px", verticalAlign: "middle" }}>
                        {driver.city ? (
                          <>
                            <div style={{ fontSize: 12.5, color: T.ink, fontWeight: 700 }}>
                              {driver.city}, {driver.state}
                            </div>
                            <div style={{ fontSize: 11, color: T.ink4, fontFamily: MONO, marginTop: 1 }}>
                              {driver.state} {driver.currentZip}
                            </div>
                          </>
                        ) : (
                          <span style={{ fontSize: 12.5, color: T.ink4 }}>—</span>
                        )}
                      </td>

                      {/* Truck */}
                      <td style={{ padding: "13px 14px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{driver.vehicleType ?? "—"}</div>
                        <div style={{ fontSize: 11, color: T.ink4, fontFamily: MONO, marginTop: 1 }}>
                          {fmtDims(driver.unitDimensions)}
                        </div>
                      </td>

                      {/* Updated */}
                      <td style={{ padding: "13px 14px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                        <div
                          style={{
                            fontSize: 12.5,
                            fontWeight: 500,
                            color: isStale ? T.warn : isOldUpdate ? T.warn : T.ink,
                          }}
                        >
                          {updLabel}
                        </div>
                        {updExact && (
                          <div style={{ fontSize: 11, color: T.ink4, marginTop: 1, fontFamily: MONO }}>
                            {updExact}
                          </div>
                        )}
                      </td>

                      {/* Info */}
                      <td style={{ padding: "13px 14px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 10, color: T.ink4, width: 26, letterSpacing: "0.04em", fontWeight: 600 }}>OUT</span>
                            <InfoSelect
                              value={driver.outMiles}
                              options={OUT_OPTIONS}
                              onChange={(v) => patch(driver.id, { outMiles: parseInt(v, 10) })}
                            />
                            <span style={{ fontSize: 10, color: T.ink4, width: 26, marginLeft: 4, letterSpacing: "0.04em", fontWeight: 600 }}>MIN</span>
                            <InfoSelect
                              value={driver.minMiles}
                              options={MIN_OPTIONS}
                              onChange={(v) => patch(driver.id, { minMiles: parseInt(v, 10) })}
                            />
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 10, color: T.ink4, width: 26, letterSpacing: "0.04em", fontWeight: 600 }}>WAY</span>
                            <InfoSelect
                              value={driver.wayDirection}
                              options={WAY_OPTIONS}
                              onChange={(v) => patch(driver.id, { wayDirection: v })}
                            />
                            <span style={{ fontSize: 10, color: T.ink4, width: 26, marginLeft: 4, letterSpacing: "0.04em", fontWeight: 600 }}>MAX</span>
                            <InfoSelect
                              value={driver.maxMiles}
                              options={MAX_OPTIONS}
                              onChange={(v) => patch(driver.id, { maxMiles: parseInt(v, 10) })}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Availability */}
                      <td style={{ padding: "13px 14px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                        {!driver.isAvailable ? (
                          <span style={{ fontSize: 12, color: T.ink4 }}>Unavailable</span>
                        ) : driver.availableAt ? (
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: T.warn }}>
                              Free in{" "}
                              <span style={{ fontFamily: MONO }}>
                                {new Date(driver.availableAt).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: T.accent }}>
                              Available <span style={{ fontWeight: 700 }}>now</span>
                            </div>
                            {updMins >= 0 && (
                              <div style={{ fontSize: 10.5, color: T.ink4, marginTop: 1, fontFamily: MONO }}>
                                {sinceLabel(updMins)}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Notify + toggle */}
                      <td style={{ padding: "13px 14px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
                          <button
                            aria-label="Notify driver"
                            style={{
                              border: "none",
                              background: "none",
                              cursor: "pointer",
                              padding: 4,
                              color: T.ink4,
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                            </svg>
                          </button>

                          <button
                            role="switch"
                            aria-checked={driver.isAvailable}
                            onClick={() => patch(driver.id, { isAvailable: !driver.isAvailable })}
                            style={{
                              position: "relative",
                              width: 38,
                              height: 22,
                              borderRadius: 999,
                              background: driver.isAvailable ? T.accent : T.lineStrong,
                              border: "none",
                              cursor: "pointer",
                              transition: "background 180ms ease",
                              flexShrink: 0,
                              padding: 0,
                            }}
                          >
                            <span
                              style={{
                                position: "absolute",
                                top: 3,
                                left: driver.isAvailable ? 19 : 3,
                                width: 16,
                                height: 16,
                                borderRadius: "50%",
                                background: "#fff",
                                transition: "left 180ms cubic-bezier(.4,.6,.3,1)",
                                boxShadow: "0 1px 3px rgba(0,0,0,.18)",
                              }}
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        {!isLoading && filtered.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "11px 18px",
              borderTop: `1px solid ${T.lineSoft}`,
              gap: 12,
            }}
          >
            <span style={{ fontSize: 11.5, color: T.ink3, flex: 1 }}>
              Showing <strong style={{ color: T.ink2, fontWeight: 600 }}>{filtered.length}</strong> of{" "}
              <strong style={{ color: T.ink2, fontWeight: 600 }}>{totalDrivers}</strong> active drivers
              {selectedStates.size > 0 && (
                <> · matches your filter ({Array.from(selectedStates).join(", ")})</>
              )}
            </span>

            {totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    width: 28, height: 28,
                    border: `1px solid ${T.line}`, borderRadius: 6,
                    background: T.bgCard,
                    cursor: page === 1 ? "default" : "pointer",
                    color: page === 1 ? T.ink4 : T.ink2,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: 0,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M7.5 2L4 6l3.5 4" />
                  </svg>
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    style={{
                      minWidth: 28, height: 28, padding: "0 8px",
                      border: `1px solid ${page === p ? T.selFill : T.line}`,
                      borderRadius: 6,
                      background: page === p ? T.selFill : T.bgCard,
                      color: page === p ? T.selInk : T.ink2,
                      fontSize: 12,
                      fontWeight: page === p ? 600 : 500,
                      cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: MONO,
                    }}
                  >
                    {p}
                  </button>
                ))}

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{
                    width: 28, height: 28,
                    border: `1px solid ${T.line}`, borderRadius: 6,
                    background: T.bgCard,
                    cursor: page === totalPages ? "default" : "pointer",
                    color: page === totalPages ? T.ink4 : T.ink2,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: 0,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M4.5 2L8 6l-3.5 4" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
