"use client";

import { useState, useRef, useCallback, useEffect, KeyboardEvent } from "react";
import Map, { Marker, NavigationControl, type MapRef } from "react-map-gl/mapbox";
import { getDistance } from "geolib";
import "mapbox-gl/dist/mapbox-gl.css";

// ── Types ─────────────────────────────────────────────────────────────────────

type DriverStatus = "available" | "dispatched" | "off";

interface MapDriver {
  id: string;
  name: string;
  vehicleType: string | null;
  currentZip: string | null;
  unitNumber: string | null;
  lat: number | null;
  lon: number | null;
  status: DriverStatus;
}

interface SearchCoords {
  lat: number;
  lng: number;
  city: string;
  zip: string;
}

type StatusFilter = "all" | DriverStatus;

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<DriverStatus, string> = {
  available: "#1e6a44",
  dispatched: "#1e4a8a",
  off: "#3f3f46",
};

const STATUS_LABEL: Record<DriverStatus, string> = {
  available: "Available",
  dispatched: "Dispatched",
  off: "Off duty",
};

const SEARCH_BLUE = "#1e6ad2";
const SEARCH_BLUE_SOFT = "#dbe7fb";

// ── Sub-components ────────────────────────────────────────────────────────────

function TruckIcon({ color = "#fff" }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M1 4h9a1 1 0 0 1 1 1v6H1V4ZM11 7h2.5L15 9.5V11h-4V7Z"
        fill={color}
        opacity={0.9}
      />
      <circle cx="3.5" cy="11.5" r="1.5" fill={color} />
      <circle cx="11.5" cy="11.5" r="1.5" fill={color} />
    </svg>
  );
}

function StatusPill({ status }: { status: DriverStatus }) {
  const color = STATUS_COLOR[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: 20,
        padding: "0 7px",
        borderRadius: 999,
        background: color + "18",
        border: `1px solid ${color}30`,
        fontSize: 11,
        fontWeight: 500,
        color,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {STATUS_LABEL[status]}
    </span>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        gap: 12,
        color: "var(--ink-3)",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 999,
          border: "2px solid var(--line-strong)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="10" cy="8" r="4" />
          <path d="M4 17c0-3.314 2.686-6 6-6s6 2.686 6 6" />
        </svg>
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-2)", margin: 0 }}>No drivers match</p>
        <p style={{ fontSize: 12, color: "var(--ink-4)", margin: "4px 0 0" }}>Try clearing a filter</p>
      </div>
    </div>
  );
}

function DriverMarker({
  driver,
  focused,
  dimmed,
  onClick,
}: {
  driver: MapDriver;
  focused: boolean;
  dimmed: boolean;
  onClick: () => void;
}) {
  const color = STATUS_COLOR[driver.status];
  const opacity = driver.status === "off" ? 0.85 : 1;

  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        width: 36,
        height: 36,
        borderRadius: 999,
        background: color,
        opacity: dimmed ? 0.34 : opacity,
        border: "3px solid #fff",
        boxShadow: focused
          ? "0 8px 18px rgba(11,11,12,.30), 0 0 0 1px rgba(11,11,12,.12), 0 0 0 5px rgba(30,106,210,.20)"
          : "0 4px 12px rgba(11,11,12,.22), 0 0 0 1px rgba(11,11,12,.10)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transform: focused ? "scale(1.15)" : "scale(1)",
        transition: "transform 180ms cubic-bezier(.2,.7,.2,1), box-shadow 180ms cubic-bezier(.2,.7,.2,1), opacity 120ms ease",
      }}
    >
      <TruckIcon />
      <div
        style={{
          position: "absolute",
          top: -2,
          right: -2,
          width: 10,
          height: 10,
          borderRadius: 999,
          background: color,
          border: "2px solid #fff",
          outline: `1px solid ${color}`,
        }}
      />
    </div>
  );
}

function SearchMarker() {
  return (
    <div style={{ position: "relative", width: 14, height: 14 }}>
      <div className="map-search-ring" />
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: 999,
          background: SEARCH_BLUE,
          border: "3px solid #fff",
          boxShadow: `0 0 0 3px ${SEARCH_BLUE}4d`,
        }}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DriverMap() {
  const mapRef = useRef<MapRef>(null);
  const railRef = useRef<HTMLDivElement>(null);

  const [drivers, setDrivers] = useState<MapDriver[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchZip, setSearchZip] = useState("");
  const [searchCoords, setSearchCoords] = useState<SearchCoords | null>(null);
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Fetch drivers on mount
  useEffect(() => {
    fetch("/api/drivers/map")
      .then((r) => r.json())
      .then((d) => { setDrivers(d.drivers ?? []); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, []);

  // Derived: drivers with distance, sorted
  const driversWithDistance = drivers
    .filter((d) => statusFilter === "all" || d.status === statusFilter)
    .map((d) => {
      const distance =
        searchCoords && d.lat !== null && d.lon !== null
          ? getDistance({ lat: d.lat, lon: d.lon }, { lat: searchCoords.lat, lon: searchCoords.lng }) / 1609.34
          : null;
      return { ...d, distance };
    })
    .sort((a, b) => {
      if (searchCoords && a.distance !== null && b.distance !== null) return a.distance - b.distance;
      const order = { available: 0, dispatched: 1, off: 2 } as const;
      if (a.status !== b.status) return order[a.status] - order[b.status];
      return a.name.localeCompare(b.name);
    });

  // Top 5 closest available drivers (dimming logic)
  const top5Ids = searchCoords
    ? new Set(driversWithDistance.filter((d) => d.status === "available").slice(0, 5).map((d) => d.id))
    : null;

  const driversInRange = searchCoords
    ? driversWithDistance.filter((d) => d.status === "available" && d.lat !== null).length
    : 0;

  // Status chip counts
  const counts: Record<StatusFilter, number> = {
    all: drivers.length,
    available: drivers.filter((d) => d.status === "available").length,
    dispatched: drivers.filter((d) => d.status === "dispatched").length,
    off: drivers.filter((d) => d.status === "off").length,
  };

  // Search handler
  const handleSearch = useCallback(async () => {
    const zip = searchZip.trim();
    if (!/^\d{5}$/.test(zip)) {
      setSearchError("Please enter a valid 5-digit ZIP code");
      return;
    }
    setIsSearching(true);
    setSearchError("");
    try {
      const res = await fetch(`/api/geocode?zip=${zip}`);
      if (!res.ok) {
        setSearchError("ZIP code not found — try another");
        return;
      }
      const { lat, lng, city } = await res.json();
      setSearchCoords({ lat, lng, city, zip });
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 8, duration: 900 });
    } catch {
      setSearchError("Failed to search ZIP — please try again");
    } finally {
      setIsSearching(false);
    }
  }, [searchZip]);

  const handleClear = useCallback(() => {
    setSearchCoords(null);
    setSearchZip("");
    setSearchError("");
  }, []);

  // Focus a driver: fly map + scroll rail
  const focusDriver = useCallback((id: string, lat: number, lon: number) => {
    setFocusedId(id);
    mapRef.current?.flyTo({ center: [lon, lat], zoom: 13, duration: 700 });
    setTimeout(() => {
      document.getElementById(`dr-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 100);
  }, []);

  const getInitials = (name: string) => {
    const p = name.trim().split(" ");
    return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase();
  };

  // ── Styles ──────────────────────────────────────────────────────────────────

  const chipBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 32,
    padding: "0 12px",
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "var(--line-strong)",
    background: "var(--bg)",
    fontSize: 12.5,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background 140ms ease, border-color 140ms ease, color 140ms ease",
    color: "var(--ink-2)",
    fontFamily: "inherit",
  };

  const chipActive: React.CSSProperties = {
    ...chipBase,
    background: "var(--ink-1)",
    borderColor: "var(--ink-1)",
    color: "#fff",
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  return (
    <>
      {/* Search ring animation */}
      <style>{`
        .map-search-ring {
          position: absolute;
          inset: -10px;
          border-radius: 999px;
          border: 2px solid ${SEARCH_BLUE};
          animation: mapSearchRing 1.8s ease-out infinite;
        }
        @keyframes mapSearchRing {
          0%   { transform: scale(0.6); opacity: 0.6; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .map-search-ring { animation: none; }
        }
        .mapboxgl-ctrl-bottom-right { bottom: 14px !important; right: 14px !important; }
        .mapboxgl-ctrl-group { border-radius: 9px !important; box-shadow: 0 2px 8px rgba(11,11,12,.12), 0 0 0 1px var(--line) !important; }
        .mapboxgl-ctrl-group button { width: 32px !important; height: 32px !important; }
        .mapboxgl-ctrl-attrib { display: none !important; }
      `}</style>

      <div
        style={{
          margin: "-2rem -24px -2rem",
          height: "calc(100dvh - 56px)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-soft)",
        }}
      >
        {/* ── Page header ───────────────────────────────────────────────── */}
        <div style={{ padding: "24px 24px 0", background: "var(--bg)", flexShrink: 0 }}>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "-0.022em",
              color: "var(--ink-0)",
              margin: 0,
            }}
          >
            Driver map
          </h1>
          <p style={{ fontSize: 13.5, color: "var(--ink-3)", margin: "4px 0 0" }}>
            Real-time driver positions and availability
          </p>
        </div>

        {/* ── Toolbar ───────────────────────────────────────────────────── */}
        <div
          style={{
            padding: "16px 24px",
            background: "var(--bg)",
            borderBottom: "1px solid var(--line)",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {/* ZIP search row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                width: searchCoords ? 380 : 360,
                height: 40,
                padding: "0 4px 0 12px",
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: searchError ? "var(--danger)" : searchCoords ? SEARCH_BLUE : "var(--line-strong)",
                borderRadius: 11,
                background: searchError ? "var(--danger-bg)" : "var(--paper)",
                boxShadow: searchCoords && !searchError
                  ? `0 0 0 3px ${SEARCH_BLUE}1f`
                  : searchError
                  ? "0 0 0 3px rgba(196,50,26,.10)"
                  : "none",
                gap: 8,
                transition: "width 200ms ease, border-color 140ms ease, box-shadow 140ms ease",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--ink-3)" strokeWidth="1.5" style={{ flexShrink: 0 }}>
                <circle cx="6" cy="6" r="4.5" />
                <path d="m9.5 9.5 2.5 2.5" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                placeholder="Search by ZIP code"
                value={searchZip}
                onChange={(e) => {
                  setSearchZip(e.target.value.replace(/\D/g, ""));
                  if (searchError) setSearchError("");
                }}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Enter") handleSearch();
                  if (e.key === "Escape") handleClear();
                }}
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: 14,
                  fontFamily: "var(--font-geist-mono, monospace)",
                  letterSpacing: "-0.003em",
                  color: "var(--ink-1)",
                }}
              />
              {searchCoords && (
                <button
                  onClick={handleClear}
                  aria-label="Clear search"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    border: "none",
                    background: "var(--bg-soft)",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--ink-3)",
                    flexShrink: 0,
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M2 2l6 6M8 2l-6 6" />
                  </svg>
                </button>
              )}
              <button
                onClick={handleSearch}
                disabled={isSearching}
                style={{
                  height: 32,
                  padding: "0 12px",
                  borderRadius: 8,
                  border: "none",
                  background: searchCoords ? SEARCH_BLUE : "var(--ink-1)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: "-0.005em",
                  cursor: isSearching ? "default" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  flexShrink: 0,
                  fontFamily: "inherit",
                  opacity: isSearching ? 0.7 : 1,
                  transition: "background 140ms ease, opacity 140ms ease",
                }}
              >
                {isSearching ? "Searching…" : "Find drivers"}
                {!isSearching && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 6h8M7 3l3 3-3 3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Filter chips */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {(["all", "available", "dispatched", "off"] as StatusFilter[]).map((s, i) => {
              const active = statusFilter === s;
              const color = s !== "all" ? STATUS_COLOR[s as DriverStatus] : undefined;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={active ? chipActive : chipBase}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--bg-soft)"; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "var(--bg)"; }}
                >
                  {color && (
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: active ? "#fff" : color,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  {s === "all" ? "All drivers" : STATUS_LABEL[s as DriverStatus]}
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 18,
                      minWidth: 18,
                      padding: "0 5px",
                      borderRadius: 999,
                      background: active ? "rgba(255,255,255,.22)" : "var(--bg-soft)",
                      fontSize: 10.5,
                      fontWeight: 600,
                      fontFamily: "var(--font-geist-mono, monospace)",
                      color: active ? "#fff" : "var(--ink-3)",
                    }}
                  >
                    {counts[s]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Error bar */}
          {searchError && (
            <div
              style={{
                padding: "6px 12px",
                background: "var(--danger-bg)",
                border: "1px solid var(--danger-bd)",
                borderRadius: 8,
                color: "var(--danger)",
                fontSize: 12.5,
              }}
            >
              {searchError}
            </div>
          )}
        </div>

        {/* ── Split body ────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            gap: 16,
            padding: 16,
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* Map card */}
          <div
            style={{
              flex: 1,
              position: "relative",
              border: "1px solid var(--line)",
              borderRadius: 14,
              overflow: "hidden",
              minHeight: 400,
              background: "var(--bg)",
            }}
          >
            {!token ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  flexDirection: "column",
                  gap: 8,
                  color: "var(--ink-3)",
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                </svg>
                <p style={{ fontSize: 13, margin: 0 }}>
                  Add <code style={{ fontFamily: "monospace" }}>NEXT_PUBLIC_MAPBOX_TOKEN</code> to <code style={{ fontFamily: "monospace" }}>.env.local</code>
                </p>
              </div>
            ) : (
              <Map
                ref={mapRef}
                mapboxAccessToken={token}
                initialViewState={{ longitude: -98.35, latitude: 39.5, zoom: 4 }}
                style={{ width: "100%", height: "100%" }}
                mapStyle="mapbox://styles/mapbox/light-v11"
              >
                {/* Driver markers */}
                {driversWithDistance.map((d) => {
                  if (d.lat === null || d.lon === null) return null;
                  const focused = focusedId === d.id;
                  const dimmed = top5Ids !== null && d.status === "available" && !top5Ids.has(d.id);
                  return (
                    <Marker
                      key={d.id}
                      longitude={d.lon}
                      latitude={d.lat}
                      anchor="center"
                      onClick={(e) => {
                        e.originalEvent.stopPropagation();
                        focusDriver(d.id, d.lat!, d.lon!);
                      }}
                    >
                      <DriverMarker driver={d} focused={focused} dimmed={dimmed} onClick={() => focusDriver(d.id, d.lat!, d.lon!)} />
                    </Marker>
                  );
                })}

                {/* Search marker */}
                {searchCoords && (
                  <Marker longitude={searchCoords.lng} latitude={searchCoords.lat} anchor="center">
                    <SearchMarker />
                  </Marker>
                )}

                <NavigationControl position="bottom-right" showCompass={false} />
              </Map>
            )}

            {/* Legend overlay */}
            <div
              style={{
                position: "absolute",
                top: 14,
                left: 14,
                background: "var(--bg)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "10px 12px",
                boxShadow: "0 4px 14px -4px rgba(11,11,12,.10), 0 0 0 0.5px rgba(11,11,12,.03)",
                minWidth: 130,
                zIndex: 10,
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--ink-3)",
                  marginBottom: 8,
                }}
              >
                Legend
              </div>
              {(["available", "dispatched", "off"] as DriverStatus[]).map((s) => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 500, color: "var(--ink-2)", marginBottom: 5 }}>
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      background: STATUS_COLOR[s],
                      outline: "2px solid #fff",
                      flexShrink: 0,
                    }}
                  />
                  {STATUS_LABEL[s]}
                </div>
              ))}
              {searchCoords && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 500, color: "var(--ink-2)", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--line)" }}>
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      background: SEARCH_BLUE,
                      outline: "2px solid #fff",
                      boxShadow: `0 0 0 4px ${SEARCH_BLUE}29`,
                      flexShrink: 0,
                    }}
                  />
                  Pickup ZIP
                </div>
              )}
            </div>

            {/* Search context overlay */}
            {searchCoords && (
              <div
                style={{
                  position: "absolute",
                  top: 14,
                  left: "50%",
                  transform: "translateX(-50%)",
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  padding: "8px 14px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,.98)",
                  border: "1px solid var(--line)",
                  boxShadow: "0 8px 24px -8px rgba(11,11,12,.14), 0 0 0 0.5px rgba(11,11,12,.04)",
                  zIndex: 10,
                  pointerEvents: "none",
                  whiteSpace: "nowrap",
                }}
              >
                <div>
                  <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: SEARCH_BLUE, marginBottom: 2 }}>
                    Searching near
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-1)" }}>{searchCoords.city}</span>
                    <span style={{ fontSize: 11, fontFamily: "var(--font-geist-mono, monospace)", color: "var(--ink-3)" }}>{searchCoords.zip}</span>
                  </div>
                </div>
                <div style={{ width: 1, alignSelf: "stretch", background: "var(--line)" }} />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.015em", color: "var(--ink-1)" }}>{driversInRange}</div>
                  <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-3)" }}>
                    in range
                  </div>
                </div>
              </div>
            )}

            {/* Counts pill */}
            <div
              style={{
                position: "absolute",
                bottom: 14,
                left: 14,
                padding: "5px 10px",
                borderRadius: 7,
                background: "rgba(255,255,255,.92)",
                border: "1px solid var(--line)",
                backdropFilter: "blur(6px)",
                fontSize: 11,
                fontWeight: 500,
                color: "var(--ink-2)",
                zIndex: 10,
                pointerEvents: "none",
                fontFamily: "var(--font-geist-mono, monospace)",
              }}
            >
              {driversWithDistance.filter((d) => d.lat !== null).length} / {driversWithDistance.length} drivers shown
            </div>
          </div>

          {/* ── Right rail ──────────────────────────────────────────────── */}
          <div
            style={{
              width: 360,
              border: "1px solid var(--line)",
              borderRadius: 14,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              background: "var(--bg)",
              flexShrink: 0,
            }}
          >
            {/* Rail header */}
            <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.012em", color: "var(--ink-1)" }}>
                  {searchCoords ? "Nearest drivers" : "All drivers"}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--font-geist-mono, monospace)",
                    background: "var(--bg-soft)",
                    border: "1px solid var(--line)",
                    borderRadius: 6,
                    padding: "1px 6px",
                    color: "var(--ink-3)",
                  }}
                >
                  {driversWithDistance.length}
                </span>
              </div>
              <p style={{ fontSize: 11.5, color: "var(--ink-3)", margin: "4px 0 0" }}>
                {searchCoords ? `Sorted by distance from ${searchCoords.zip}` : "Sorted by status, then name"}
              </p>
            </div>

            {/* Driver list */}
            <div ref={railRef} style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
              {isLoading ? (
                <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>
                  Loading drivers…
                </div>
              ) : driversWithDistance.length === 0 ? (
                <EmptyState />
              ) : (
                driversWithDistance.map((d) => {
                  const focused = focusedId === d.id;
                  const dimmed = top5Ids !== null && d.status === "available" && !top5Ids.has(d.id);
                  const color = STATUS_COLOR[d.status];
                  const initials = getInitials(d.name);
                  const hasLocation = d.lat !== null && d.lon !== null;

                  return (
                    <button
                      id={`dr-${d.id}`}
                      key={d.id}
                      onClick={() => hasLocation ? focusDriver(d.id, d.lat!, d.lon!) : undefined}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        width: "100%",
                        padding: focused ? "10px 10px 10px 7px" : "10px",
                        textAlign: "left",
                        background: focused ? "#f4f8fe" : "transparent",
                        borderWidth: 1,
                        borderStyle: "solid",
                        borderColor: focused ? "#cfdcf2" : "transparent",
                        boxShadow: focused ? `inset 3px 0 0 ${SEARCH_BLUE}` : "none",
                        borderRadius: 10,
                        cursor: hasLocation ? "pointer" : "default",
                        opacity: dimmed ? 0.45 : 1,
                        transition: "background 120ms ease, opacity 120ms ease",
                        fontFamily: "inherit",
                        marginBottom: 2,
                      }}
                      onMouseEnter={(e) => { if (!focused) e.currentTarget.style.background = "var(--bg-soft)"; }}
                      onMouseLeave={(e) => { if (!focused) e.currentTarget.style.background = "transparent"; }}
                    >
                      {/* Avatar */}
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 999,
                          background: color,
                          color: "#fff",
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11.5,
                          fontWeight: 600,
                          letterSpacing: "-0.01em",
                          boxShadow: "inset 0 0 0 2px rgba(255,255,255,.18)",
                        }}
                      >
                        {initials}
                      </div>

                      {/* Body */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              letterSpacing: "-0.005em",
                              color: "var(--ink-1)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {d.name}
                          </span>
                          <StatusPill status={d.status} />
                        </div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: "var(--ink-3)",
                            marginTop: 2,
                            fontFamily: "var(--font-geist-mono, monospace)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {d.currentZip ?? "—"} · {d.vehicleType ?? "—"}
                        </div>
                        {d.unitNumber && (
                          <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>
                            {d.unitNumber}
                          </div>
                        )}
                        {!hasLocation && (
                          <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>
                            No location data
                          </div>
                        )}
                      </div>

                      {/* Distance */}
                      {d.distance !== null && (
                        <>
                          <div style={{ width: 1, alignSelf: "stretch", background: "var(--line)", marginLeft: 8 }} />
                          <div style={{ paddingLeft: 8, textAlign: "right", flexShrink: 0 }}>
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 600,
                                fontFamily: "var(--font-geist-mono, monospace)",
                                color: "var(--ink-1)",
                                letterSpacing: "-0.01em",
                              }}
                            >
                              {Math.round(d.distance)}
                            </div>
                            <div
                              style={{
                                fontSize: 9.5,
                                fontWeight: 600,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                color: "var(--ink-3)",
                              }}
                            >
                              mi
                            </div>
                          </div>
                        </>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
