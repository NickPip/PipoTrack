"use client";

import { useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DriverUnit {
  id: string;
  unitNumber: string;
  type: string;
  dimensions: { length?: number; width?: number; height?: number } | null;
  payload: number | null;
  equipment: string[] | null;
}

export interface BidDriver {
  id: string;
  name: string;
  phone: string | null;
  citizenshipType: string | null;
  cleanBackground: boolean | null;
  vehicleType: string | null;
  outMiles: number | null;
  currentZip: string | null;
  address: string | null;
  unit: DriverUnit | null;
  location: { lat: number; lon: number; updatedAt: string } | null;
}

export interface Bid {
  id: string;
  driverId: string;
  amount: number;
  status: string;
  createdAt: string;
  driver: BidDriver;
}

export interface DispatchLoad {
  id: string;
  loadNumber: number;
  status: "PENDING_DISTRIBUTION" | "HAS_BIDS" | "QUOTED";
  broker: string;
  brokerName: string | null;
  brokerEmail: string | null;
  brokerPhone: string | null;
  brokerReference: string | null;
  pickupAddress: string;
  pickupZip: string | null;
  pickupDate: string;
  deliveryAddress: string;
  deliveryZip: string | null;
  deliveryDate: string;
  miles: number | null;
  weight: number | null;
  vehicleRequired: string | null;
  dimensions: { pieces?: number; L?: number; W?: number; H?: number } | null;
  stackable: boolean | null;
  rate: number | null;
  driverRate: number | null;
  createdAt: string;
  bids: Bid[];
}

interface BidModalProps {
  load: DispatchLoad;
  onClose: () => void;
  onSaved: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}mins ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "2-digit", day: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function bidRateLabel(bid: Bid): string {
  if (bid.status === "skipped") return "Skipped";
  if (bid.amount > 0) return `$${bid.amount}`;
  return "N/A";
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  overlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    zIndex: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  modal: {
    background: "#fff",
    borderRadius: 16,
    width: "100%",
    maxWidth: 1100,
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
  },

  header: {
    padding: "20px 24px 16px",
    borderBottom: "1px solid #f0f0f0",
    flexShrink: 0,
  },

  headerTitle: { fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 2 },
  headerSub: { fontSize: 13, color: "#9ca3af" },

  closeBtn: {
    position: "absolute" as const,
    top: 16,
    right: 20,
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 20,
    color: "#6b7280",
  },

  body: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },

  // Left — driver list
  left: {
    width: 200,
    borderRight: "1px solid #f0f0f0",
    overflowY: "auto" as const,
    flexShrink: 0,
    padding: "8px 0",
  },

  driverCard: (active: boolean): React.CSSProperties => ({
    padding: "10px 14px",
    cursor: "pointer",
    background: active ? "#16a34a" : "#fff",
    borderBottom: "1px solid #f5f5f5",
    transition: "background 0.1s",
  }),

  driverCardName: (active: boolean): React.CSSProperties => ({
    fontSize: 12,
    fontWeight: 600,
    color: active ? "#fff" : "#111",
    marginBottom: 3,
    lineHeight: 1.3,
  }),

  driverCardMeta: (active: boolean): React.CSSProperties => ({
    fontSize: 11,
    color: active ? "rgba(255,255,255,0.8)" : "#6b7280",
    marginBottom: 2,
  }),

  driverCardRate: (active: boolean): React.CSSProperties => ({
    fontSize: 11,
    color: active ? "rgba(255,255,255,0.9)" : "#2563eb",
    fontWeight: 500,
  }),

  // Middle — driver detail + bid form
  middle: {
    flex: 1,
    padding: "20px 22px",
    overflowY: "auto" as const,
    borderRight: "1px solid #f0f0f0",
  },

  row2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 4,
    marginBottom: 12,
  },

  metaLabel: { fontSize: 12, color: "#9ca3af" },
  metaValue: { fontSize: 13, fontWeight: 500, color: "#111" },

  divider: { borderTop: "1px solid #f0f0f0", margin: "14px 0" },

  copyBtn: {
    flex: 1,
    padding: "8px 0",
    border: "none",
    borderRadius: 8,
    background: "#2563eb",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },

  equipTag: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 4,
    background: "#f3f4f6",
    color: "#374151",
    fontSize: 11,
    fontWeight: 500,
    marginRight: 4,
    marginBottom: 4,
  },

  unitBadge: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 6,
    background: "#fef9c3",
    border: "1px solid #fde047",
    color: "#713f12",
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 12,
  },

  rateLabel: { fontSize: 12, color: "#6b7280", marginBottom: 4 },

  rateInput: {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    color: "#2563eb",
    outline: "none",
  },

  bigInput: {
    flex: 1,
    padding: "10px 14px",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 700,
    color: "#111",
    outline: "none",
    textAlign: "center" as const,
  },

  textarea: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    fontSize: 13,
    color: "#374151",
    resize: "vertical" as const,
    outline: "none",
    minHeight: 80,
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
  },

  sendBtn: {
    width: "100%",
    padding: "12px 0",
    border: "none",
    borderRadius: 8,
    background: "#1f2937",
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    marginBottom: 8,
  },

  closeModalBtn: {
    width: "100%",
    padding: "10px 0",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    background: "#fff",
    color: "#374151",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
  },

  // Right — load info
  right: {
    width: 280,
    padding: "20px 20px",
    overflowY: "auto" as const,
    flexShrink: 0,
    background: "#fafafa",
  },

  loadTitle: {
    fontSize: 13,
    fontWeight: 500,
    color: "#111",
    lineHeight: 1.5,
    marginBottom: 8,
  },

  loadEmail: {
    fontSize: 12,
    color: "#2563eb",
    wordBreak: "break-all" as const,
    marginBottom: 14,
    display: "block",
  },

  loadRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    color: "#374151",
    marginBottom: 5,
  },

  loadRowLabel: { color: "#9ca3af" },

  brokerHighlight: {
    background: "#fef9c3",
    padding: "2px 6px",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 500,
    color: "#713f12",
    wordBreak: "break-all" as const,
  },
};

// ── BidModal ──────────────────────────────────────────────────────────────────

export default function BidModal({ load, onClose, onSaved }: BidModalProps) {
  const [selectedBidId, setSelectedBidId] = useState<string>(load.bids[0]?.id ?? "");

  const firstBid = load.bids[0];
  const [driverRate, setDriverRate] = useState<string>(
    firstBid?.amount > 0 && firstBid?.status !== "skipped"
      ? firstBid.amount.toString()
      : (load.driverRate?.toString() ?? "")
  );
  const [ourRate, setOurRate] = useState<string>(load.rate?.toString() ?? "");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedBid = load.bids.find((b) => b.id === selectedBidId) ?? load.bids[0];
  const driver = selectedBid?.driver;
  const unit = driver?.unit;
  const dims = unit?.dimensions as { length?: number; width?: number; height?: number } | null;
  const equipment = unit?.equipment as string[] | null;

  const handleCopyDriverInfo = useCallback(() => {
    if (!driver) return;
    const lines = [
      `Driver: ${driver.name}`,
      driver.phone ? `Phone: ${driver.phone}` : null,
      driver.vehicleType ? `Vehicle: ${driver.vehicleType}` : null,
      unit ? `Unit: ${unit.unitNumber} (${unit.type})` : null,
      dims ? `Dimensions: ${dims.length ?? 0}L x ${dims.width ?? 0}W x ${dims.height ?? 0}H` : null,
      unit?.payload ? `Payload: ${unit.payload} lbs` : null,
      equipment?.length ? `Equipment: ${equipment.join(", ")}` : null,
      driver.citizenshipType ? `Citizenship: ${driver.citizenshipType}` : null,
      driver.cleanBackground != null ? `Clean Background: ${driver.cleanBackground ? "Yes" : "No"}` : null,
      driver.currentZip ? `Current ZIP: ${driver.currentZip}` : null,
      driver.address ? `Address: ${driver.address}` : null,
    ].filter(Boolean).join("\n");
    copyToClipboard(lines);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [driver, unit, dims, equipment]);

  const handleCopyLocation = useCallback(() => {
    if (!driver?.location) return;
    copyToClipboard(`${driver.location.lat}, ${driver.location.lon}`);
  }, [driver]);

  const handleSend = async () => {
    if (!selectedBid || !driver) return;
    setSending(true);
    const res = await fetch(`/api/dispatch/loads/${load.id}/bid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bidId: selectedBid.id,
        driverId: driver.id,
        driverRate: parseFloat(driverRate) || 0,
        rate: parseFloat(ourRate) || 0,
        notes,
      }),
    });
    setSending(false);
    if (res.ok) {
      onSaved();
    }
  };

  const loadDims = load.dimensions as { pieces?: number; L?: number; W?: number; H?: number } | null;

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        {/* Header */}
        <div style={{ ...S.header, position: "relative" }}>
          <div style={S.headerTitle}>Place Your Bid</div>
          <div style={S.headerSub}>Select a driver and place your bid for this load</div>
          <button style={S.closeBtn} onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div style={S.body}>
          {/* Left — driver list */}
          <div style={S.left}>
            {load.bids.map((bid) => {
              const active = bid.id === selectedBid?.id;
              const unitLabel = bid.driver.unit ? `UNIT - ${bid.driver.unit.unitNumber}` : "No Unit";
              return (
                <div key={bid.id} style={S.driverCard(active)} onClick={() => {
                  setSelectedBidId(bid.id);
                  if (bid.amount > 0 && bid.status !== "skipped") setDriverRate(bid.amount.toString());
                }}>
                  <div style={S.driverCardName(active)}>{unitLabel} /</div>
                  <div style={S.driverCardName(active)}>{bid.driver.name}</div>
                  <div style={S.driverCardMeta(active)}>
                    Miles out: {bid.driver.outMiles ?? "—"}
                  </div>
                  <div style={S.driverCardRate(active)}>
                    Rate: {bidRateLabel(bid)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Middle — driver detail + bid form */}
          <div style={S.middle}>
            {driver ? (
              <>
                {/* Meta row */}
                <div style={S.row2}>
                  <div>
                    <div style={S.metaLabel}>Last Updated</div>
                    <div style={S.metaValue}>
                      {driver.location ? timeAgo(driver.location.updatedAt) : "No data"}
                    </div>
                  </div>
                  <div>
                    <div style={S.metaLabel}>Phone</div>
                    <div style={S.metaValue}>{driver.phone ?? "—"}</div>
                  </div>
                </div>

                {/* Vehicle row */}
                <div style={S.row2}>
                  <div>
                    <div style={S.metaLabel}>Truck</div>
                    <div style={S.metaValue}>{driver.vehicleType ?? "—"}</div>
                  </div>
                  <div>
                    <div style={S.metaLabel}>Payload</div>
                    <div style={S.metaValue}>{unit?.payload ? `${unit.payload} lbs` : "—"}</div>
                  </div>
                </div>

                {dims && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={S.metaLabel}>Dims</div>
                    <div style={S.metaValue}>
                      {dims.length ?? 0} × {dims.width ?? 0} × {dims.height ?? 0}
                    </div>
                  </div>
                )}

                {/* Copy buttons */}
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <button style={S.copyBtn} onClick={handleCopyLocation}>
                    Copy Location
                  </button>
                  <button style={S.copyBtn} onClick={handleCopyDriverInfo}>
                    {copied ? "Copied!" : "Copy Driver's Info"}
                  </button>
                </div>

                <div style={S.divider} />

                {/* Driver attributes */}
                {driver.citizenshipType && (
                  <div style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}>
                    Citizenship: {driver.citizenshipType}
                  </div>
                )}
                {driver.cleanBackground != null && (
                  <div style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}>
                    Clean Background: {driver.cleanBackground ? "Yes" : "No"}
                  </div>
                )}

                {/* Equipment tags */}
                {equipment && equipment.length > 0 && (
                  <div style={{ marginTop: 8, marginBottom: 14 }}>
                    {equipment.map((eq) => (
                      <span key={eq} style={S.equipTag}>{eq}</span>
                    ))}
                  </div>
                )}

                <div style={S.divider} />

                {/* Unit badge + miles */}
                {unit && (
                  <span style={S.unitBadge}>
                    UNIT — {unit.unitNumber} {driver.name.split(" ")[0]} {driver.name.split(" ").slice(-1)[0]?.[0]}.
                  </span>
                )}

                <div style={{ display: "flex", gap: 20, marginBottom: 14, fontSize: 13, color: "#6b7280" }}>
                  {driver.outMiles != null && (
                    <span>Miles out: <strong style={{ color: "#111" }}>{driver.outMiles}</strong></span>
                  )}
                </div>

                <div style={S.divider} />

                {/* Driver Rate */}
                <div style={{ marginBottom: 12 }}>
                  <div style={S.rateLabel}>Driver Rate</div>
                  <input
                    style={S.rateInput}
                    type="number"
                    value={driverRate}
                    onChange={(e) => setDriverRate(e.target.value)}
                    placeholder="0"
                  />
                </div>

                {/* Our Rate (bid to broker) */}
                <div style={{ marginBottom: 12 }}>
                  <div style={S.rateLabel}>Our Rate (quoted to broker)</div>
                  <input
                    style={{ ...S.bigInput, width: "100%", textAlign: "left" }}
                    type="number"
                    value={ourRate}
                    onChange={(e) => setOurRate(e.target.value)}
                    placeholder="0"
                  />
                </div>

                {/* Notes */}
                <div style={{ marginBottom: 14 }}>
                  <div style={S.rateLabel}>Add notes for broker if needed</div>
                  <textarea
                    style={S.textarea}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder=""
                  />
                </div>

                <button style={S.sendBtn} onClick={handleSend} disabled={sending}>
                  {sending ? "Sending…" : "Send Bid!"}
                </button>
                <button style={S.closeModalBtn} onClick={onClose}>Close</button>
              </>
            ) : (
              <div style={{ color: "#9ca3af", fontSize: 14 }}>Select a driver on the left</div>
            )}
          </div>

          {/* Right — load info */}
          <div style={S.right}>
            <div style={S.loadTitle}>
              <strong>{load.vehicleRequired}</strong>
              {" from "}
              <strong>{load.pickupAddress}</strong>
              {" to "}
              <strong>{load.deliveryAddress}</strong>
              {" — Posted by "}
              <strong>{load.broker}</strong>
            </div>

            {load.brokerEmail && (
              <a href={`mailto:${load.brokerEmail}`} style={S.loadEmail}>
                ({load.brokerEmail})
              </a>
            )}

            <div style={S.divider} />

            <div style={{ marginBottom: 10, fontSize: 13, color: "#374151" }}>
              <div>*Pick-up at: {load.pickupAddress}{load.pickupZip ? ` ${load.pickupZip}` : ""}*</div>
              <div style={{ marginTop: 2 }}>*Pick-up date: {fmtDate(load.pickupDate)} EST*</div>
            </div>
            <div style={{ marginBottom: 14, fontSize: 13, color: "#374151" }}>
              <div>*Deliver to: {load.deliveryAddress}{load.deliveryZip ? ` ${load.deliveryZip}` : ""}*</div>
              <div style={{ marginTop: 2 }}>*Delivery date: {fmtDate(load.deliveryDate)} EST*</div>
            </div>

            <div style={S.divider} />

            {[
              ["Miles", load.miles],
              ["Pieces", loadDims?.pieces ?? 0],
              ["Weight", load.weight ? `${load.weight.toLocaleString()} lbs` : "—"],
              ["Dims", loadDims?.L ? `${loadDims.L} × ${loadDims.W} × ${loadDims.H}` : "—"],
              ["Stackable", load.stackable != null ? (load.stackable ? "Yes" : "No") : "—"],
              ["Vehicle Required", load.vehicleRequired],
            ].map(([label, val]) => (
              <div key={String(label)} style={S.loadRow}>
                <span style={S.loadRowLabel}>{label}:</span>
                <span>{String(val ?? "—")}</span>
              </div>
            ))}

            <div style={S.divider} />

            <div style={{ marginBottom: 6 }}>
              <div style={{ ...S.metaLabel, marginBottom: 4 }}>Load ID</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>
                {load.brokerReference ?? `#${load.loadNumber}`}
              </div>
            </div>

            <div>
              <div style={{ ...S.metaLabel, marginBottom: 4 }}>Broker</div>
              <span style={S.brokerHighlight}>{load.brokerEmail ?? load.broker}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
