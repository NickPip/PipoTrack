"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AvailDriver {
  id: string;
  name: string;
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

// ── Region / state config ─────────────────────────────────────────────────────

const REGIONS: { name: string; states: string[] }[] = [
  { name: "WEST", states: ["WA", "OR", "CA", "NV", "ID", "UT", "CO", "WY", "MT"] },
  { name: "SOUTHWEST", states: ["AZ", "NM", "OK", "TX"] },
  {
    name: "MIDWEST",
    states: ["ND", "SD", "NE", "KS", "MN", "IA", "MO", "WI", "IL", "IN", "MI", "OH"],
  },
  {
    name: "NORTHEAST",
    states: ["PA", "MD", "DE", "NJ", "NY", "CT", "RI", "MA", "NH", "VT", "ME"],
  },
  {
    name: "SOUTHEAST",
    states: ["AR", "LA", "MS", "AL", "TN", "KY", "GA", "FL", "SC", "NC", "VA", "WV", "DC"],
  },
];

const WAY_OPTIONS = ["ANY", "N", "S", "E", "W", "NE", "NW", "SE", "SW"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDimensions(dims: { length?: number; width?: number; height?: number } | null): string {
  if (!dims) return "—";
  const { length: l, width: w, height: h } = dims;
  if (l && w && h) return `${l}x${w}x${h}`;
  return "—";
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AvatarIcon({ name }: { name: string }) {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: 999,
        background: "#e4e4e7",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        fontWeight: 600,
        color: "#71717a",
        flexShrink: 0,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

function OnlineDot({ online }: { online: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: online ? "#22c55e" : "#d4d4d8",
        flexShrink: 0,
      }}
    />
  );
}

function AvailText({ driver }: { driver: AvailDriver }) {
  if (!driver.isAvailable) {
    return <span style={{ fontSize: 12, color: "#71717a" }}>Unavailable</span>;
  }
  if (driver.availableAt) {
    const d = new Date(driver.availableAt);
    return (
      <span style={{ fontSize: 12, color: "#2563eb", fontWeight: 500 }}>
        {d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
      </span>
    );
  }
  return <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>Available Now</span>;
}

// ── Number input cell (inline editable) ──────────────────────────────────────

function NumCell({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [local, setLocal] = useState(String(value));

  useEffect(() => {
    setLocal(String(value));
  }, [value]);

  return (
    <input
      type="number"
      value={local}
      min={0}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const n = parseInt(local, 10);
        if (!isNaN(n) && n >= 0) onChange(n);
        else setLocal(String(value));
      }}
      style={{
        width: 52,
        height: 26,
        border: "1px solid #e4e4e7",
        borderRadius: 6,
        padding: "0 6px",
        fontSize: 12,
        fontFamily: "var(--font-geist-mono, monospace)",
        color: "#18181b",
        background: "#fafafa",
        outline: "none",
        textAlign: "right",
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = "#a1a1aa";
        e.currentTarget.style.background = "#fff";
      }}
      onBlurCapture={(e) => {
        e.currentTarget.style.borderColor = "#e4e4e7";
        e.currentTarget.style.background = "#fafafa";
      }}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AvailabilitiesTable() {
  const [drivers, setDrivers] = useState<AvailDriver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStates, setSelectedStates] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const fetchDrivers = useCallback(() => {
    fetch("/api/drivers/availabilities")
      .then((r) => r.json())
      .then((d) => {
        setDrivers(d.drivers ?? []);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  // ── State counts ─────────────────────────────────────────────────────────────

  const stateCounts = drivers.reduce<Record<string, number>>((acc, d) => {
    if (d.state) acc[d.state] = (acc[d.state] ?? 0) + 1;
    return acc;
  }, {});

  // ── Filtering ────────────────────────────────────────────────────────────────

  const filtered = drivers.filter((d) => {
    if (selectedStates.size > 0 && (!d.state || !selectedStates.has(d.state))) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchesZip = d.currentZip?.includes(q);
      const matchesCity = d.city?.toLowerCase().includes(q);
      const matchesUnit = d.unitNumber?.toLowerCase().includes(q);
      const matchesName = d.name.toLowerCase().includes(q);
      if (!matchesZip && !matchesCity && !matchesUnit && !matchesName) return false;
    }
    return true;
  });

  // ── Patch helper ─────────────────────────────────────────────────────────────

  const patch = useCallback(async (id: string, updates: Partial<AvailDriver>) => {
    setDrivers((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
    );
    await fetch("/api/drivers/availabilities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
  }, []);

  const toggleState = (state: string) => {
    setSelectedStates((prev) => {
      const next = new Set(prev);
      if (next.has(state)) next.delete(state);
      else next.add(state);
      return next;
    });
  };

  const toggleRegion = (states: string[]) => {
    const allSelected = states.every((s) => selectedStates.has(s));
    setSelectedStates((prev) => {
      const next = new Set(prev);
      if (allSelected) states.forEach((s) => next.delete(s));
      else states.forEach((s) => next.add(s));
      return next;
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Page header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: "#09090b", margin: 0 }}>
          Driver Availabilities
        </h1>
        <p style={{ fontSize: 13, color: "#71717a", margin: "4px 0 0" }}>
          View and manage driver availability by region
        </p>
      </div>

      {/* Regional filters card */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e4e4e7",
          borderRadius: 12,
          padding: "20px 24px",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: "#18181b", marginBottom: 16 }}>
          Regional Filters
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {REGIONS.map((region) => {
            const allSelected = region.states.every((s) => selectedStates.has(s));
            return (
              <div key={region.name} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                {/* Region checkbox */}
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    cursor: "pointer",
                    minWidth: 110,
                    paddingTop: 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => toggleRegion(region.states)}
                    style={{ width: 14, height: 14, accentColor: "#18181b", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#3f3f46", letterSpacing: "0.04em" }}>
                    {region.name}
                  </span>
                </label>

                {/* State checkboxes */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
                  {region.states.map((state) => {
                    const count = stateCounts[state] ?? 0;
                    const checked = selectedStates.has(state);
                    return (
                      <label
                        key={state}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleState(state)}
                          style={{ width: 13, height: 13, accentColor: "#18181b", cursor: "pointer" }}
                        />
                        <span style={{ fontSize: 12, color: "#3f3f46" }}>
                          {state}
                          <span style={{ color: "#a1a1aa", marginLeft: 1 }}>({count})</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Search */}
        <div
          style={{
            marginTop: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 38,
            padding: "0 12px",
            border: "1px solid #e4e4e7",
            borderRadius: 8,
            background: "#fafafa",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#a1a1aa" strokeWidth="1.5">
            <circle cx="6" cy="6" r="4.5" />
            <path d="m9.5 9.5 2.5 2.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search by Zip/Address or Unit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 13,
              color: "#18181b",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{
                border: "none",
                background: "none",
                cursor: "pointer",
                padding: 0,
                color: "#a1a1aa",
                display: "flex",
                alignItems: "center",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 2l8 8M10 2l-8 8" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Drivers table card */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e4e4e7",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {/* Table header row */}
        <div style={{ padding: "14px 20px 0", borderBottom: "1px solid #f4f4f5" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#18181b" }}>
            Available Drivers ({filtered.length})
          </span>
        </div>

        {isLoading ? (
          <div style={{ padding: "48px 20px", textAlign: "center", color: "#a1a1aa", fontSize: 13 }}>
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center", color: "#a1a1aa", fontSize: 13 }}>
            No drivers match the current filters.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead>
                <tr style={{ background: "#fafafa" }}>
                  {["Unit", "Driver", "Delivery Location / ZIP", "Truck", "Updated ago", "Info", "Will be available at", ""].map(
                    (col) => (
                      <th
                        key={col}
                        style={{
                          padding: "10px 16px",
                          textAlign: "left",
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: "#71717a",
                          letterSpacing: "0.03em",
                          borderBottom: "1px solid #f4f4f5",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((driver, idx) => (
                  <tr
                    key={driver.id}
                    style={{
                      borderBottom: idx < filtered.length - 1 ? "1px solid #f4f4f5" : "none",
                    }}
                  >
                    {/* Unit */}
                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <OnlineDot online={driver.isOnline} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#18181b" }}>
                          {driver.unitNumber ?? "—"}
                        </span>
                      </div>
                    </td>

                    {/* Driver */}
                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <AvatarIcon name={driver.name} />
                        <span style={{ fontSize: 13, color: "#18181b" }}>{driver.name}</span>
                      </div>
                    </td>

                    {/* Delivery Location / ZIP */}
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ fontSize: 13, color: "#18181b" }}>
                        {driver.city ? `${driver.city}, ${driver.state}` : "—"}
                      </div>
                      {driver.state && driver.currentZip && (
                        <div style={{ fontSize: 11.5, color: "#71717a", fontFamily: "var(--font-geist-mono, monospace)" }}>
                          {driver.state} {driver.currentZip}
                        </div>
                      )}
                    </td>

                    {/* Truck */}
                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      <div style={{ fontSize: 13, color: "#18181b" }}>{driver.vehicleType ?? "—"}</div>
                      <div style={{ fontSize: 11.5, color: "#71717a", fontFamily: "var(--font-geist-mono, monospace)" }}>
                        {formatDimensions(driver.unitDimensions)}
                      </div>
                    </td>

                    {/* Updated ago */}
                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: 13, color: "#52525b" }}>
                        {timeAgo(driver.locationUpdatedAt)}
                      </span>
                    </td>

                    {/* Info — Out / Min / Way / Max */}
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11.5, color: "#71717a", width: 26 }}>Out:</span>
                          <NumCell
                            value={driver.outMiles}
                            onChange={(v) => patch(driver.id, { outMiles: v })}
                          />
                          <span style={{ fontSize: 11.5, color: "#71717a", marginLeft: 4, width: 26 }}>Min:</span>
                          <NumCell
                            value={driver.minMiles}
                            onChange={(v) => patch(driver.id, { minMiles: v })}
                          />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11.5, color: "#71717a", width: 26 }}>Way:</span>
                          <select
                            value={driver.wayDirection}
                            onChange={(e) => patch(driver.id, { wayDirection: e.target.value })}
                            style={{
                              height: 26,
                              border: "1px solid #e4e4e7",
                              borderRadius: 6,
                              padding: "0 4px",
                              fontSize: 12,
                              color: "#18181b",
                              background: "#fafafa",
                              outline: "none",
                              cursor: "pointer",
                            }}
                          >
                            {WAY_OPTIONS.map((o) => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </select>
                          <span style={{ fontSize: 11.5, color: "#71717a", marginLeft: 4, width: 26 }}>Max:</span>
                          <NumCell
                            value={driver.maxMiles}
                            onChange={(v) => patch(driver.id, { maxMiles: v })}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Will be available at */}
                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      <AvailText driver={driver} />
                    </td>

                    {/* Actions: bell + toggle */}
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {/* Bell (visual only) */}
                        <button
                          aria-label="Notify driver"
                          style={{
                            border: "none",
                            background: "none",
                            cursor: "pointer",
                            padding: 4,
                            color: "#a1a1aa",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                          </svg>
                        </button>

                        {/* Available toggle */}
                        <button
                          role="switch"
                          aria-checked={driver.isAvailable}
                          onClick={() => patch(driver.id, { isAvailable: !driver.isAvailable })}
                          style={{
                            position: "relative",
                            width: 40,
                            height: 22,
                            borderRadius: 999,
                            background: driver.isAvailable ? "#18181b" : "#e4e4e7",
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
                              left: driver.isAvailable ? 21 : 3,
                              width: 16,
                              height: 16,
                              borderRadius: "50%",
                              background: "#fff",
                              transition: "left 180ms ease",
                              boxShadow: "0 1px 3px rgba(0,0,0,.2)",
                            }}
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
