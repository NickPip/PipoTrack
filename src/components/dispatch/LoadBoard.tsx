"use client";

import { useState, useEffect, useCallback } from "react";
import BidModal, { type DispatchLoad, type Bid } from "./BidModal";

type Tab = "all" | "new" | "quoted";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function bidRateLabel(bid: Bid): { text: string; color: string } {
  if (bid.status === "skipped") return { text: "Skipped", color: "#6b7280" };
  if (bid.amount > 0) return { text: `$${bid.amount}`, color: "#2563eb" };
  return { text: "N/A", color: "#9ca3af" };
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  page: {
    padding: "0 32px 40px",
    fontFamily: "inherit",
  } as React.CSSProperties,

  tabBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
  } as React.CSSProperties,

  tabActive: {
    padding: "6px 14px",
    borderRadius: 20,
    background: "#111",
    color: "#fff",
    fontSize: 13.5,
    fontWeight: 600,
    border: "none",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  } as React.CSSProperties,

  tabInactive: {
    padding: "6px 14px",
    borderRadius: 20,
    background: "transparent",
    color: "#374151",
    fontSize: 13.5,
    fontWeight: 500,
    border: "1px solid #e5e7eb",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  } as React.CSSProperties,

  badge: {
    background: "#ef4444",
    color: "#fff",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 700,
    padding: "1px 6px",
    lineHeight: "16px",
  } as React.CSSProperties,

  searchWrap: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 10,
  } as React.CSSProperties,

  searchInput: {
    height: 34,
    padding: "0 12px 0 32px",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    fontSize: 13,
    outline: "none",
    width: 220,
    color: "#374151",
    background: "#fff",
  } as React.CSSProperties,

  archiveBtn: {
    height: 34,
    padding: "0 16px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  } as React.CSSProperties,

  card: {
    display: "flex",
    gap: 0,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "#fff",
    marginBottom: 14,
    overflow: "hidden",
  } as React.CSSProperties,

  cardLeft: {
    minWidth: 260,
    maxWidth: 280,
    padding: "18px 20px",
    borderRight: "1px solid #f0f0f0",
    flexShrink: 0,
  } as React.CSSProperties,

  cardTitle: {
    fontSize: 13,
    fontWeight: 500,
    color: "#111",
    lineHeight: 1.45,
    marginBottom: 6,
  } as React.CSSProperties,

  brokerEmail: {
    fontSize: 12,
    color: "#2563eb",
    textDecoration: "none",
    display: "block",
    marginBottom: 10,
    wordBreak: "break-all" as const,
  } as React.CSSProperties,

  cardMeta: {
    fontSize: 11.5,
    color: "#9ca3af",
    display: "flex",
    justifyContent: "space-between",
    marginTop: "auto",
  } as React.CSSProperties,

  driverGrid: {
    flex: 1,
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 1,
    background: "#f0f0f0",
    alignContent: "start",
  } as React.CSSProperties,

  driverCell: {
    background: "#fff",
    padding: "12px 14px",
    fontSize: 12,
  } as React.CSSProperties,

  driverName: {
    fontWeight: 600,
    color: "#111",
    marginBottom: 4,
    fontSize: 12,
    lineHeight: 1.3,
  } as React.CSSProperties,

  driverMeta: {
    color: "#6b7280",
    fontSize: 11.5,
    marginBottom: 3,
  } as React.CSSProperties,

  hideBtn: {
    flexShrink: 0,
    padding: "0 20px",
    background: "#dc2626",
    color: "#fff",
    border: "none",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 90,
  } as React.CSSProperties,

  quotedPanel: {
    flexShrink: 0,
    width: 140,
    borderLeft: "1px solid #f0f0f0",
    display: "flex",
    flexDirection: "column",
    padding: "16px 14px",
    gap: 8,
    justifyContent: "center",
  } as React.CSSProperties,

  quotedPanelUnit: {
    fontSize: 12,
    fontWeight: 700,
    color: "#111",
    marginBottom: 2,
    lineHeight: 1.3,
  } as React.CSSProperties,

  quotedPanelSub: {
    fontSize: 11,
    color: "#9ca3af",
    marginBottom: 8,
  } as React.CSSProperties,

  btnBook: {
    padding: "8px 0",
    borderRadius: 8,
    border: "none",
    background: "#16a34a",
    color: "#fff",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  } as React.CSSProperties,

  btnHold: {
    padding: "8px 0",
    borderRadius: 8,
    border: "none",
    background: "#f97316",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  } as React.CSSProperties,

  btnArchive: {
    padding: "8px 0",
    borderRadius: 8,
    border: "none",
    background: "#374151",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  } as React.CSSProperties,

  // Book confirm modal
  overlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    zIndex: 60,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  confirmBox: {
    background: "#fff",
    borderRadius: 14,
    padding: "28px 28px 24px",
    width: 400,
    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
  } as React.CSSProperties,

  empty: {
    textAlign: "center" as const,
    padding: "60px 0",
    color: "#9ca3af",
    fontSize: 14,
  } as React.CSSProperties,

  quotedRate: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 6,
    padding: "3px 8px",
    fontSize: 12,
    fontWeight: 600,
    color: "#16a34a",
  } as React.CSSProperties,
};

// ── BookConfirmModal ──────────────────────────────────────────────────────────

function BookConfirmModal({
  load,
  onConfirm,
  onCancel,
  booking,
}: {
  load: DispatchLoad;
  onConfirm: () => void;
  onCancel: () => void;
  booking: boolean;
}) {
  const accepted = load.bids.find((b) => b.status === "accepted");
  const driver = accepted?.driver;
  const unitLabel = driver?.unit ? `UNIT-${driver.unit.unitNumber}` : "No Unit";

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div style={S.confirmBox}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#111", marginBottom: 6 }}>
          Book this load?
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 18, lineHeight: 1.6 }}>
          Load <strong>{load.brokerReference ?? `#${load.loadNumber}`}</strong> will be sent to
          Operations with status <strong>Pending</strong>.
        </div>

        <div
          style={{
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: "14px 16px",
            marginBottom: 20,
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 600, color: "#111", marginBottom: 4 }}>
            {load.vehicleRequired} · {load.pickupZip ?? load.pickupAddress} → {load.deliveryZip ?? load.deliveryAddress}
          </div>
          {driver && (
            <div style={{ color: "#6b7280" }}>
              {unitLabel} / {driver.name}
            </div>
          )}
          {load.rate != null && (
            <div style={{ color: "#16a34a", fontWeight: 600, marginTop: 4 }}>
              Rate: ${load.rate.toLocaleString()}
            </div>
          )}
          {load.driverRate != null && (
            <div style={{ color: "#6b7280" }}>
              Driver rate: ${load.driverRate.toLocaleString()}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            style={{
              flex: 1,
              padding: "11px 0",
              borderRadius: 8,
              border: "none",
              background: "#16a34a",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: booking ? "not-allowed" : "pointer",
              opacity: booking ? 0.7 : 1,
            }}
            onClick={onConfirm}
            disabled={booking}
          >
            {booking ? "Booking…" : "Confirm Book"}
          </button>
          <button
            style={{
              flex: 1,
              padding: "11px 0",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#fff",
              color: "#374151",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
            onClick={onCancel}
            disabled={booking}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── QuotedPanel ───────────────────────────────────────────────────────────────

function QuotedPanel({
  load,
  onBook,
  onArchive,
}: {
  load: DispatchLoad;
  onBook: () => void;
  onArchive: () => void;
}) {
  const accepted = load.bids.find((b) => b.status === "accepted");
  const driver = accepted?.driver;
  const unitLabel = driver?.unit ? `UNIT-${driver.unit.unitNumber}` : "—";

  return (
    <div style={S.quotedPanel}>
      <div style={S.quotedPanelUnit}>{unitLabel}</div>
      {driver && <div style={{ ...S.quotedPanelUnit, fontWeight: 400, fontSize: 11 }}>{driver.name}</div>}
      {accepted && (
        <div style={S.quotedPanelSub}>Bidded {timeAgo(accepted.createdAt)}</div>
      )}
      <button style={S.btnBook} onClick={onBook}>Book</button>
      <button style={S.btnHold} onClick={() => {}}>Hold</button>
      <button style={S.btnArchive} onClick={onArchive}>Archive</button>
    </div>
  );
}

// ── LoadCard ──────────────────────────────────────────────────────────────────

function LoadCard({
  load,
  onHide,
  onOpen,
  onBook,
}: {
  load: DispatchLoad;
  onHide: (id: string) => void;
  onOpen: (load: DispatchLoad) => void;
  onBook: (load: DispatchLoad) => void;
}) {
  const dims = load.dimensions as { pieces?: number; L?: number; W?: number; H?: number } | null;

  const subtitle = [
    load.miles ? `${load.miles} miles` : null,
    load.weight ? `${load.weight.toLocaleString()} lbs.` : null,
    dims?.pieces ? `${dims.pieces} pcs` : null,
    dims?.L && dims?.W && dims?.H ? `${dims.L}L×${dims.W}W×${dims.H}H` : null,
    `Posted by ${load.broker}`,
  ]
    .filter(Boolean)
    .join(" - ");

  const isQuoted = load.status === "QUOTED";

  return (
    <div style={S.card}>
      {/* Left — load info (clickable) */}
      <div
        style={{ ...S.cardLeft, display: "flex", flexDirection: "column", cursor: "pointer" }}
        onClick={() => onOpen(load)}
      >
        <div style={S.cardTitle}>
          <strong>{load.vehicleRequired ?? "UNKNOWN"}</strong>
          {" from "}
          <strong>{load.pickupZip ?? load.pickupAddress}</strong>
          {" to "}
          <strong>{load.deliveryZip ?? load.deliveryAddress}</strong>
          {" — "}
          {subtitle}
        </div>

        {load.brokerEmail && (
          <a href={`mailto:${load.brokerEmail}`} style={S.brokerEmail}>
            {load.brokerEmail}
          </a>
        )}

        {isQuoted && load.rate && (
          <span style={S.quotedRate}>✓ Quoted: ${load.rate.toLocaleString()}</span>
        )}

        <div style={{ ...S.cardMeta, marginTop: 12 }}>
          <span>{timeAgo(load.createdAt)}</span>
          <span>ID: {load.brokerReference ?? load.loadNumber}</span>
        </div>
      </div>

      {/* Driver grid */}
      <div style={S.driverGrid}>
        {load.bids.length === 0 ? (
          <div style={{ ...S.driverCell, gridColumn: "1 / -1", color: "#9ca3af", fontSize: 13 }}>
            No drivers sent yet
          </div>
        ) : (
          load.bids.map((bid) => {
            const rate = bidRateLabel(bid);
            const unitLabel = bid.driver.unit
              ? `UNIT-${bid.driver.unit.unitNumber}`
              : "No Unit";
            return (
              <div key={bid.id} style={S.driverCell}>
                <div style={S.driverName}>
                  {unitLabel} / {bid.driver.name}
                </div>
                {bid.driver.outMiles != null && (
                  <div style={S.driverMeta}>Miles out: {bid.driver.outMiles}</div>
                )}
                <div style={{ ...S.driverMeta, color: rate.color, fontWeight: 500 }}>
                  Rate: {rate.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Right action: Quoted panel or Hide button */}
      {isQuoted ? (
        <QuotedPanel
          load={load}
          onBook={() => onBook(load)}
          onArchive={() => onHide(load.id)}
        />
      ) : (
        <button style={S.hideBtn} onClick={() => onHide(load.id)}>
          Hide
        </button>
      )}
    </div>
  );
}

// ── LoadBoard ─────────────────────────────────────────────────────────────────

export default function LoadBoard() {
  const [loads, setLoads] = useState<DispatchLoad[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalLoad, setModalLoad] = useState<DispatchLoad | null>(null);
  const [bookingLoad, setBookingLoad] = useState<DispatchLoad | null>(null);
  const [booking, setBooking] = useState(false);

  const fetchLoads = useCallback(() => {
    setLoading(true);
    fetch("/api/dispatch/loads")
      .then((r) => r.json())
      .then((d) => { setLoads(d.loads ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/dispatch/loads")
      .then((r) => r.json())
      .then((d) => { setLoads(d.loads ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleHide = (id: string) => setHidden((prev) => new Set([...prev, id]));

  const handleConfirmBook = async () => {
    if (!bookingLoad) return;
    setBooking(true);
    const res = await fetch(`/api/dispatch/loads/${bookingLoad.id}/book`, { method: "POST" });
    setBooking(false);
    if (res.ok) {
      setBookingLoad(null);
      fetchLoads();
    }
  };

  const visible = loads.filter((l) => {
    if (hidden.has(l.id)) return false;
    if (tab === "all"    && l.status !== "PENDING_DISTRIBUTION") return false;
    if (tab === "new"    && l.status !== "HAS_BIDS") return false;
    if (tab === "quoted" && l.status !== "QUOTED") return false;
    if (search) {
      const q = search.toLowerCase();
      const ref = (l.brokerReference ?? "").toLowerCase();
      const broker = l.broker.toLowerCase();
      if (!ref.includes(q) && !broker.includes(q)) return false;
    }
    return true;
  });

  const newCount    = loads.filter((l) => !hidden.has(l.id) && l.status === "HAS_BIDS").length;
  const quotedCount = loads.filter((l) => !hidden.has(l.id) && l.status === "QUOTED").length;

  const tabStyle = (t: Tab) => (tab === t ? S.tabActive : S.tabInactive);

  return (
    <div style={S.page}>
      {modalLoad && (
        <BidModal
          load={modalLoad}
          onClose={() => setModalLoad(null)}
          onSaved={() => { setModalLoad(null); fetchLoads(); }}
        />
      )}
      {bookingLoad && (
        <BookConfirmModal
          load={bookingLoad}
          onConfirm={handleConfirmBook}
          onCancel={() => setBookingLoad(null)}
          booking={booking}
        />
      )}

      {/* Tab bar */}
      <div style={S.tabBar}>
        <button style={tabStyle("all")} onClick={() => setTab("all")}>All</button>

        <button style={tabStyle("new")} onClick={() => setTab("new")}>
          New
          {newCount > 0 && <span style={S.badge}>{newCount}</span>}
        </button>

        <button style={tabStyle("quoted")} onClick={() => setTab("quoted")}>
          Quoted
          {quotedCount > 0 && <span style={S.badge}>{quotedCount}</span>}
        </button>

        <div style={S.searchWrap}>
          <div style={{ position: "relative" }}>
            <svg
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.4 }}
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              style={S.searchInput}
              placeholder="Search ID/SUBJECT"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button style={S.archiveBtn} onClick={fetchLoads}>Refresh</button>
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div style={S.empty}>Loading loads…</div>
      ) : visible.length === 0 ? (
        <div style={S.empty}>No loads in this view</div>
      ) : (
        visible.map((load) => (
          <LoadCard key={load.id} load={load} onHide={handleHide} onOpen={setModalLoad} onBook={setBookingLoad} />
        ))
      )}
    </div>
  );
}
