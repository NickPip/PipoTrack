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

// ── Config ────────────────────────────────────────────────────────────────────

const REGIONS = [
  { name: "WEST",      states: ["WA","OR","CA","NV","ID","UT","CO","WY","MT"] },
  { name: "SOUTHWEST", states: ["AZ","NM","OK","TX"] },
  { name: "MIDWEST",   states: ["ND","SD","NE","KS","MN","IA","MO","WI","IL","IN","MI","OH"] },
  { name: "NORTHEAST", states: ["PA","MD","DE","NJ","NY","CT","RI","MA","NH","VT","ME"] },
  { name: "SOUTHEAST", states: ["AR","LA","MS","AL","TN","KY","GA","FL","SC","NC","VA","WV","DC"] },
];

const WAY_OPTIONS = ["ANY","N","S","E","W","NE","NW","SE","SW"];
const OUT_OPTIONS  = [25,50,75,100,150,200,250,300,400,500];
const MIN_OPTIONS  = [0,25,50,100,150,200,300,500];
const MAX_OPTIONS  = [500,1000,2000,3000,5000,7500,10000];

const EMOJIS = ["🐯","🦊","🐻","🐼","🐨","🦁","🐸","🦝","🐺","🦅","🦋","🐢","🦘","🦦","🦔"];
const PAGE_SIZE = 25;

// ── Helpers ───────────────────────────────────────────────────────────────────

function emoji(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % EMOJIS.length;
  return EMOJIS[h];
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return { label: "—", exact: "", mins: -1 };
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const exact = new Date(dateStr).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const label =
    mins < 1   ? "just now"
    : mins < 60 ? `${mins} min ago`
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
        height: 26,
        minWidth: 62,
        border: "1px solid #e4e4e7",
        borderRadius: 6,
        padding: "0 22px 0 7px",
        fontSize: 12,
        color: "#18181b",
        background:
          "#fff url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='5' viewBox='0 0 9 5'%3E%3Cpath d='M1 1l3.5 3L8 1' stroke='%23a1a1aa' stroke-width='1.4' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\") no-repeat right 6px center",
        WebkitAppearance: "none",
        appearance: "none",
        cursor: "pointer",
        outline: "none",
        fontFamily: "var(--font-geist-mono, monospace)",
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

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

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
      next.has(state) ? next.delete(state) : next.add(state);
      return next;
    });
  }, []);

  const toggleRegion = useCallback((states: string[]) => {
    setPage(1);
    setSelectedStates((prev) => {
      const next = new Set(prev);
      const allOn = states.every((s) => next.has(s));
      allOn ? states.forEach((s) => next.delete(s)) : states.forEach((s) => next.add(s));
      return next;
    });
  }, []);

  const removeState = useCallback((state: string) => {
    setPage(1);
    setSelectedStates((prev) => { const n = new Set(prev); n.delete(state); return n; });
  }, []);

  const toggleCollapse = useCallback((name: string) => {
    setCollapsed((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  const headerCell: React.CSSProperties = {
    padding: "9px 14px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 700,
    color: "#a1a1aa",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    borderBottom: "1px solid #f4f4f5",
    background: "#fafafa",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.022em", color: "#09090b", margin: 0 }}>
          Driver Availabilities
        </h1>
        <p style={{ fontSize: 13, color: "#71717a", margin: "3px 0 0" }}>
          View and manage driver availability by region
        </p>
      </div>

      {/* ── Filters card ─────────────────────────────────────────────────── */}
      <div style={{ background: "#fff", border: "1px solid #e4e4e7", borderRadius: 12, padding: "20px 24px" }}>

        {/* Regions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {REGIONS.map((region, ri) => {
            const isCollapsed = collapsed.has(region.name);
            const allSelected = region.states.every((s) => selectedStates.has(s));
            const regionCount = region.states.reduce((sum, s) => sum + (stateCounts[s] ?? 0), 0);

            return (
              <div
                key={region.name}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 16,
                  paddingTop: ri === 0 ? 0 : 14,
                  paddingBottom: 14,
                  borderBottom: ri < REGIONS.length - 1 ? "1px solid #f4f4f5" : "none",
                }}
              >
                {/* Collapse button */}
                <button
                  onClick={() => toggleCollapse(region.name)}
                  aria-label={isCollapsed ? "Expand" : "Collapse"}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    border: "1.5px solid #d4d4d8",
                    background: "#fff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 2,
                    color: "#71717a",
                    fontSize: 13,
                    fontWeight: 400,
                    lineHeight: 1,
                    padding: 0,
                  }}
                >
                  {isCollapsed ? "+" : "−"}
                </button>

                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => toggleRegion(region.states)}
                  style={{ width: 14, height: 14, accentColor: "#18181b", cursor: "pointer", marginTop: 3, flexShrink: 0 }}
                />

                {/* Region label */}
                <div style={{ minWidth: 120, flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#18181b", letterSpacing: "0.04em" }}>
                    {region.name}
                  </div>
                  <div style={{ fontSize: 11, color: "#a1a1aa", marginTop: 2 }}>
                    {regionCount} drivers · {region.states.length} states
                  </div>
                </div>

                {/* State pills */}
                {!isCollapsed && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 6px", flex: 1 }}>
                    {region.states.map((state) => {
                      const count = stateCounts[state] ?? 0;
                      const selected = selectedStates.has(state);
                      return (
                        <button
                          key={state}
                          onClick={() => toggleState(state)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            height: 30,
                            padding: "0 10px",
                            borderRadius: 7,
                            border: selected ? "1.5px solid #18181b" : "1px solid #e4e4e7",
                            background: selected ? "#18181b" : "#fff",
                            cursor: "pointer",
                            minWidth: 56,
                            transition: "background 120ms, border-color 120ms",
                          }}
                        >
                          <span style={{ fontSize: 12, fontWeight: 600, color: selected ? "#fff" : "#3f3f46" }}>
                            {state}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: selected ? "rgba(255,255,255,.75)" : count === 0 ? "#d4d4d8" : "#18181b",
                            }}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Search row */}
        <div
          style={{
            marginTop: 16,
            display: "flex",
            alignItems: "center",
            gap: 0,
            height: 40,
            border: "1px solid #e4e4e7",
            borderRadius: 8,
            background: "#fafafa",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, padding: "0 12px" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#a1a1aa" strokeWidth="1.5">
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
                color: "#18181b",
              }}
            />
          </div>

          {/* Vehicle type counts */}
          {Object.keys(vehicleCounts).length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "0 14px",
                borderLeft: "1px solid #f4f4f5",
                height: "100%",
              }}
            >
              {Object.entries(vehicleCounts).map(([type, count]) => (
                <span key={type} style={{ fontSize: 12, color: "#71717a", whiteSpace: "nowrap" }}>
                  {type.split(" ")[0]}{" "}
                  <span style={{ fontWeight: 700, color: "#18181b" }}>{count}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Selected chips */}
        {selectedStates.size > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: "#a1a1aa",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              SELECTED
            </span>
            {Array.from(selectedStates).map((state) => (
              <button
                key={state}
                onClick={() => removeState(state)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  height: 22,
                  padding: "0 8px",
                  borderRadius: 999,
                  border: "1px solid #bbf7d0",
                  background: "#f0fdf4",
                  color: "#166534",
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {state}
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M1 1l6 6M7 1l-6 6" />
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Driver table card ─────────────────────────────────────────────── */}
      <div style={{ background: "#fff", border: "1px solid #e4e4e7", borderRadius: 12, overflow: "hidden" }}>

        {/* Table toolbar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "13px 20px",
            borderBottom: "1px solid #f4f4f5",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "#18181b" }}>Available drivers</span>
          <span style={{ fontSize: 12.5, color: "#a1a1aa" }}>
            Showing <strong style={{ color: "#52525b" }}>{paginated.length}</strong> of{" "}
            <strong style={{ color: "#52525b" }}>{filtered.length}</strong> · sorted by check-in time
          </span>
          <div style={{ flex: 1 }} />

          {/* View toggles */}
          <div style={{ display: "flex", gap: 1, border: "1px solid #e4e4e7", borderRadius: 7, overflow: "hidden" }}>
            {[
              { icon: (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 3.5h10M2 7h10M2 10.5h10" strokeLinecap="round" />
                  </svg>
                ), mode: "list" as const },
              { icon: (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="2" width="4" height="4" rx="1" />
                    <rect x="8" y="2" width="4" height="4" rx="1" />
                    <rect x="2" y="8" width="4" height="4" rx="1" />
                    <rect x="8" y="8" width="4" height="4" rx="1" />
                  </svg>
                ), mode: "grid" as const },
            ].map(({ icon, mode }) => (
              <button
                key={mode}
                aria-pressed={true}
                style={{
                  width: 30,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                  background: "#fafafa",
                  color: "#71717a",
                  cursor: "default",
                }}
              >
                {icon}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={fetchDrivers}
            style={{
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #e4e4e7",
              borderRadius: 7,
              background: "#fff",
              color: "#71717a",
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
          <div style={{ padding: "52px 20px", textAlign: "center", color: "#a1a1aa", fontSize: 13 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "52px 20px", textAlign: "center", color: "#a1a1aa", fontSize: 13 }}>
            No drivers match the current filters.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
              <thead>
                <tr>
                  <th style={{ ...headerCell, width: 80 }}>Unit</th>
                  <th style={{ ...headerCell }}>Driver</th>
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
                  <th style={{ ...headerCell, minWidth: 200 }}>Info</th>
                  <th style={{ ...headerCell }}>Will be available at</th>
                  <th style={{ ...headerCell, textAlign: "right" }}>Notify</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((driver, idx) => {
                  const { label: updLabel, exact: updExact, mins: updMins } = timeAgo(driver.locationUpdatedAt);
                  const isOldUpdate = updMins >= 30 && updMins !== -1;

                  return (
                    <tr
                      key={driver.id}
                      style={{
                        borderBottom: idx < paginated.length - 1 ? "1px solid #f9f9f9" : "none",
                      }}
                    >
                      {/* Unit */}
                      <td style={{ padding: "13px 14px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              background: driver.isOnline ? "#22c55e" : "#d4d4d8",
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#18181b" }}>
                            {driver.unitNumber ?? "—"}
                          </span>
                        </div>
                      </td>

                      {/* Driver */}
                      <td style={{ padding: "13px 14px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 999,
                              background: "#f4f4f5",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 16,
                              flexShrink: 0,
                            }}
                          >
                            {emoji(driver.id)}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#18181b" }}>{driver.name}</div>
                            {driver.dlNumber && (
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "#a1a1aa",
                                  fontFamily: "var(--font-geist-mono, monospace)",
                                }}
                              >
                                DOT-{driver.dlNumber}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Location */}
                      <td style={{ padding: "13px 14px", verticalAlign: "middle" }}>
                        {driver.city ? (
                          <>
                            <div style={{ fontSize: 13, color: "#18181b" }}>
                              {driver.city}, {driver.state === "DC" ? "DC" : driver.state}
                            </div>
                            <div
                              style={{
                                fontSize: 11.5,
                                color: "#a1a1aa",
                                fontFamily: "var(--font-geist-mono, monospace)",
                                marginTop: 1,
                              }}
                            >
                              {driver.state} {driver.currentZip}
                            </div>
                          </>
                        ) : (
                          <span style={{ fontSize: 13, color: "#d4d4d8" }}>—</span>
                        )}
                      </td>

                      {/* Truck */}
                      <td style={{ padding: "13px 14px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                        <div style={{ fontSize: 13, color: "#18181b" }}>{driver.vehicleType ?? "—"}</div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: "#a1a1aa",
                            fontFamily: "var(--font-geist-mono, monospace)",
                            marginTop: 1,
                          }}
                        >
                          {fmtDims(driver.unitDimensions)}
                        </div>
                      </td>

                      {/* Updated */}
                      <td style={{ padding: "13px 14px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: isOldUpdate ? "#d97706" : "#18181b",
                          }}
                        >
                          {updLabel}
                        </div>
                        {updExact && (
                          <div style={{ fontSize: 11.5, color: "#a1a1aa", marginTop: 1 }}>{updExact}</div>
                        )}
                      </td>

                      {/* Info */}
                      <td style={{ padding: "13px 14px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 11, color: "#a1a1aa", width: 28 }}>OUT</span>
                            <InfoSelect
                              value={driver.outMiles}
                              options={OUT_OPTIONS}
                              onChange={(v) => patch(driver.id, { outMiles: parseInt(v, 10) })}
                            />
                            <span style={{ fontSize: 11, color: "#a1a1aa", width: 28, marginLeft: 4 }}>MIN</span>
                            <InfoSelect
                              value={driver.minMiles}
                              options={MIN_OPTIONS}
                              onChange={(v) => patch(driver.id, { minMiles: parseInt(v, 10) })}
                            />
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 11, color: "#a1a1aa", width: 28 }}>WAY</span>
                            <InfoSelect
                              value={driver.wayDirection}
                              options={WAY_OPTIONS}
                              onChange={(v) => patch(driver.id, { wayDirection: v })}
                            />
                            <span style={{ fontSize: 11, color: "#a1a1aa", width: 28, marginLeft: 4 }}>MAX</span>
                            <InfoSelect
                              value={driver.maxMiles}
                              options={MAX_OPTIONS}
                              onChange={(v) => patch(driver.id, { maxMiles: parseInt(v, 10) })}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Will be available at */}
                      <td style={{ padding: "13px 14px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                        {!driver.isAvailable ? (
                          <span style={{ fontSize: 12.5, color: "#a1a1aa" }}>Unavailable</span>
                        ) : driver.availableAt ? (
                          <div>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#2563eb" }}>
                              {new Date(driver.availableAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#16a34a" }}>
                              Available Now
                            </div>
                            {updMins >= 0 && (
                              <div style={{ fontSize: 11, color: "#86efac", marginTop: 1 }}>
                                {sinceLabel(updMins)}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Notify + toggle */}
                      <td style={{ padding: "13px 14px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
                          {/* Bell */}
                          <button
                            aria-label="Notify driver"
                            style={{
                              border: "none",
                              background: "none",
                              cursor: "pointer",
                              padding: 4,
                              color: "#d4d4d8",
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                            </svg>
                          </button>

                          {/* Toggle */}
                          <button
                            role="switch"
                            aria-checked={driver.isAvailable}
                            onClick={() => patch(driver.id, { isAvailable: !driver.isAvailable })}
                            style={{
                              position: "relative",
                              width: 38,
                              height: 22,
                              borderRadius: 999,
                              background: driver.isAvailable ? "#16a34a" : "#e4e4e7",
                              border: "none",
                              cursor: "pointer",
                              transition: "background 180ms ease",
                              flexShrink: 0,
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
                                transition: "left 180ms ease",
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
              padding: "11px 20px",
              borderTop: "1px solid #f4f4f5",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 12, color: "#a1a1aa", flex: 1 }}>
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
              {selectedStates.size > 0 && (
                <> · matches your filter ({Array.from(selectedStates).join(", ")})</>
              )}
            </span>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    width: 28,
                    height: 28,
                    border: "1px solid #e4e4e7",
                    borderRadius: 7,
                    background: "#fff",
                    cursor: page === 1 ? "default" : "pointer",
                    color: page === 1 ? "#d4d4d8" : "#52525b",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
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
                      width: 28,
                      height: 28,
                      border: "1px solid",
                      borderColor: page === p ? "#18181b" : "#e4e4e7",
                      borderRadius: 7,
                      background: page === p ? "#18181b" : "#fff",
                      color: page === p ? "#fff" : "#52525b",
                      fontSize: 12.5,
                      fontWeight: page === p ? 600 : 400,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {p}
                  </button>
                ))}

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{
                    width: 28,
                    height: 28,
                    border: "1px solid #e4e4e7",
                    borderRadius: 7,
                    background: "#fff",
                    cursor: page === totalPages ? "default" : "pointer",
                    color: page === totalPages ? "#d4d4d8" : "#52525b",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
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
