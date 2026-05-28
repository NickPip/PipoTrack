"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import styles from "./tendered.module.css";

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
  if (diff < 3600) return `${Math.floor(diff / 60)}min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function unitLabel(d: BidDriver): string {
  return d.unit ? `UNIT-${d.unit.unitNumber}` : "NO-UNIT";
}

function rateText(bid: Bid): string {
  if (bid.status === "skipped") return "Skipped";
  if (bid.status === "sent" && bid.amount <= 0) return "Waiting";
  if (bid.amount > 0) return `$${bid.amount}`;
  return "N/A";
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

const SPEC_CHECKS = ["Straps", "Blankets", "Dolly", "Portable Printer", "TWIC"];
function hasEquip(equipment: string[] | null, name: string): boolean {
  if (!equipment) return false;
  const n = name.toLowerCase();
  return equipment.some((e) => e.toLowerCase().includes(n));
}

// ── Map preview (stylized SVG stand-in — wire to Mapbox/Google later) ──
function MapPreview() {
  return (
    <svg
      className={styles.mapPreview}
      viewBox="0 0 340 90"
      preserveAspectRatio="none"
      aria-hidden
    >
      <rect width="340" height="90" fill="#F4F2EC" />
      <path
        d="M30 64 C 110 14, 220 80, 310 28"
        fill="none"
        stroke="#1F5E3B"
        strokeWidth="2"
        strokeDasharray="5 5"
        opacity="0.7"
      />
      <circle cx="30" cy="64" r="9" fill="#1F5E3B" opacity="0.18" />
      <circle cx="30" cy="64" r="4" fill="#1F5E3B" />
      <circle cx="310" cy="28" r="4" fill="#A6321D" />
    </svg>
  );
}

// ── BidModal ──────────────────────────────────────────────────────────────────

export default function BidModal({ load, onClose, onSaved }: BidModalProps) {
  const [selectedBidId, setSelectedBidId] = useState<string>(
    load.bids.find((b) => b.status === "accepted")?.id ?? load.bids[0]?.id ?? ""
  );

  const firstBid = load.bids.find((b) => b.id === selectedBidId) ?? load.bids[0];
  const [driverRate, setDriverRate] = useState<string>(
    firstBid && firstBid.amount > 0 && firstBid.status !== "skipped"
      ? String(firstBid.amount)
      : (load.driverRate?.toString() ?? "")
  );
  const [ourRate, setOurRate] = useState<string>(load.rate?.toString() ?? "");
  const [appxMiles, setAppxMiles] = useState<string>(
    firstBid?.driver.outMiles != null ? String(firstBid.driver.outMiles) : ""
  );
  const [padPct, setPadPct] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<Element | null>(null);

  // Focus management + Esc to close.
  useEffect(() => {
    restoreRef.current = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      (restoreRef.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  const selectedBid =
    load.bids.find((b) => b.id === selectedBidId) ?? load.bids[0];
  const driver = selectedBid?.driver;
  const unit = driver?.unit;
  const dims = unit?.dimensions ?? null;
  const equipment = unit?.equipment ?? null;
  const loadDims = load.dimensions;

  const selectDriver = (bid: Bid) => {
    setSelectedBidId(bid.id);
    if (bid.amount > 0 && bid.status !== "skipped")
      setDriverRate(String(bid.amount));
    if (bid.driver.outMiles != null) setAppxMiles(String(bid.driver.outMiles));
  };

  const handlePadChange = (v: string) => {
    setPadPct(v);
    const base = parseFloat(driverRate);
    const pad = parseFloat(v);
    if (!Number.isNaN(base) && !Number.isNaN(pad)) {
      setOurRate(String(Math.round(base * (1 + pad / 100))));
    }
  };

  const handleCopyDriverInfo = useCallback(() => {
    if (!driver) return;
    const lines = [
      `Driver: ${driver.name}`,
      driver.phone ? `Phone: ${driver.phone}` : null,
      driver.vehicleType ? `Vehicle: ${driver.vehicleType}` : null,
      unit ? `Unit: ${unit.unitNumber} (${unit.type})` : null,
      dims
        ? `Dimensions: ${dims.length ?? 0}L x ${dims.width ?? 0}W x ${dims.height ?? 0}H`
        : null,
      unit?.payload ? `Payload: ${unit.payload} lbs` : null,
      equipment?.length ? `Equipment: ${equipment.join(", ")}` : null,
      driver.citizenshipType ? `Citizenship: ${driver.citizenshipType}` : null,
      driver.currentZip ? `Current ZIP: ${driver.currentZip}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    copyToClipboard(lines);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [driver, unit, dims, equipment]);

  const handleCopyLocation = useCallback(() => {
    if (driver?.location)
      copyToClipboard(`${driver.location.lat}, ${driver.location.lon}`);
    else if (driver?.currentZip) copyToClipboard(driver.currentZip);
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
    if (res.ok) onSaved();
  };

  const totalLabel = ourRate ? ` · $${Number(ourRate).toLocaleString()}` : "";
  const ttHours = load.miles != null ? Math.max(1, Math.round(load.miles / 50)) : null;
  const recRate = load.driverRate ?? load.rate ?? null;

  return (
    <div
      className={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Book your truck"
      >
        <div className={styles.modalHead}>
          <div className={styles.modalTitle}>Book Your Truck</div>
          <div className={styles.modalSub}>
            Select a driver and place your bid for this load
          </div>
          <button ref={closeRef} className={styles.modalClose} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* Left — driver list */}
          <div className={styles.mDrivers}>
            {load.bids.length === 0 && (
              <div style={{ fontSize: 12.5, color: "var(--ink-4)", padding: 8 }}>
                No drivers have responded yet.
              </div>
            )}
            {load.bids.map((bid) => {
              const active = bid.id === selectedBid?.id;
              const fav = load.status === "QUOTED" && bid.status === "accepted";
              return (
                <button
                  key={bid.id}
                  className={`${styles.mDriverCard} ${active ? styles.mDriverActive : ""}`}
                  onClick={() => selectDriver(bid)}
                >
                  {fav && (
                    <span className={styles.cellStar} aria-hidden>
                      ★
                    </span>
                  )}
                  <div className={styles.driverTop}>
                    <span className={styles.avatar} aria-hidden>
                      {initials(bid.driver.name)}
                    </span>
                    <span className={styles.unitId}>{unitLabel(bid.driver)}</span>
                  </div>
                  <div className={styles.driverName}>{bid.driver.name}</div>
                  <div className={styles.driverBottom}>
                    <span className={styles.milesOut}>
                      <b>{bid.driver.outMiles ?? "—"}</b> mi out
                    </span>
                    <span className={styles.rate}>{rateText(bid)}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Middle — booking form */}
          <div className={styles.mForm}>
            {driver ? (
              <>
                <div className={styles.infoCard}>
                  <div>
                    <div className={styles.fieldLabel}>Last updated</div>
                    <div className={styles.fieldValue}>
                      {driver.location ? timeAgo(driver.location.updatedAt) : "—"}
                    </div>
                  </div>
                  <div>
                    <div className={styles.fieldLabel}>Phone</div>
                    <div className={styles.fieldValue}>{driver.phone ?? "—"}</div>
                  </div>
                  <div>
                    <div className={styles.fieldLabel}>Truck</div>
                    <div className={styles.fieldValue}>
                      {driver.vehicleType ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className={styles.fieldLabel}>Dims</div>
                    <div className={styles.fieldValue}>
                      {dims
                        ? `${dims.length ?? 0}×${dims.width ?? 0}×${dims.height ?? 0}`
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className={styles.fieldLabel}>Payload</div>
                    <div className={styles.fieldValue}>
                      {unit?.payload ? `${unit.payload} lbs` : "—"}
                    </div>
                  </div>
                  <div>
                    <div className={styles.fieldLabel}>Citizenship</div>
                    <div className={styles.fieldValue}>
                      {driver.citizenshipType ?? "—"}
                    </div>
                  </div>
                </div>

                <div className={styles.pillRow}>
                  <button className={styles.pillBtn} onClick={handleCopyLocation}>
                    Copy Location
                  </button>
                  <button className={styles.pillBtn} onClick={handleCopyDriverInfo}>
                    {copied ? "Copied!" : "Copy Driver Info"}
                  </button>
                </div>

                <div className={styles.specs2}>
                  <div className={styles.specRow}>
                    <span>Clean Background</span>
                    {driver.cleanBackground ? (
                      <span className={styles.specYes}>✓ Yes</span>
                    ) : (
                      <span className={styles.specNo}>—</span>
                    )}
                  </div>
                  {SPEC_CHECKS.map((s) => (
                    <div key={s} className={styles.specRow}>
                      <span>{s}</span>
                      {hasEquip(equipment, s) ? (
                        <span className={styles.specYes}>✓ Yes</span>
                      ) : (
                        <span className={styles.specNo}>—</span>
                      )}
                    </div>
                  ))}
                </div>

                <div className={styles.bidLine3}>
                  <div>
                    <div className={styles.fieldLabel}>Unit</div>
                    <span className={styles.unitPill}>{unitLabel(driver)}</span>
                  </div>
                  <div>
                    <div className={styles.fieldLabel}>TT</div>
                    <div className={styles.staticVal}>
                      {ttHours ? `${ttHours}h` : "—"}
                    </div>
                  </div>
                  <div>
                    <div className={styles.fieldLabel}>Exact miles out</div>
                    <div className={styles.staticVal}>
                      {driver.outMiles ?? "—"}
                    </div>
                  </div>
                </div>

                <div className={styles.bidLine2}>
                  <div>
                    <div className={styles.fieldLabel}>Driver rate</div>
                    <div className={styles.inputBox}>
                      <span className={styles.inputPrefix}>$</span>
                      <input
                        type="number"
                        value={driverRate}
                        onChange={(e) => setDriverRate(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div>
                    <div className={styles.fieldLabel}>Bid to broker</div>
                    <div className={styles.inputBox}>
                      <span className={styles.inputPrefix}>$</span>
                      <input
                        type="number"
                        value={ourRate}
                        onChange={(e) => setOurRate(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.bidLine2}>
                  <div>
                    <div className={styles.fieldLabel}>Appx miles out</div>
                    <div className={styles.inputBox}>
                      <input
                        type="number"
                        value={appxMiles}
                        onChange={(e) => setAppxMiles(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div>
                    <div className={styles.fieldLabel}>Pad %</div>
                    <div className={styles.inputBox}>
                      <input
                        type="number"
                        value={padPct}
                        onChange={(e) => handlePadChange(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                <textarea
                  className={styles.textarea}
                  placeholder="Add notes for broker if needed…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />

                <button
                  className={styles.sendBtn}
                  onClick={handleSend}
                  disabled={sending}
                >
                  {sending ? "Sending…" : `Send Bid${totalLabel}`}
                </button>
              </>
            ) : (
              <div style={{ color: "var(--ink-4)", fontSize: 14 }}>
                Select a driver on the left.
              </div>
            )}
          </div>

          {/* Right — load detail */}
          <div className={styles.mDetail}>
            <div className={styles.heroCard}>
              <div className={styles.heroSub}>{load.broker} Posted Load</div>
              <div className={styles.heroText}>
                <strong>{load.vehicleRequired}</strong> from {load.pickupAddress}{" "}
                to {load.deliveryAddress}, posted by{" "}
                <strong>{load.broker}</strong>
                {load.brokerEmail && (
                  <>
                    {" "}
                    <span className={styles.hl}>{load.brokerEmail}</span>
                  </>
                )}
              </div>
            </div>

            <MapPreview />

            <div className={styles.detailSection}>
              <div className={styles.sectionLabel}>Pickup</div>
              <div className={styles.pair2}>
                <div>
                  <div className={styles.fieldLabel}>At</div>
                  <div style={{ fontSize: 12.5 }}>{load.pickupAddress}</div>
                </div>
                <div>
                  <div className={styles.fieldLabel}>Date</div>
                  <div className={styles.staticVal} style={{ fontSize: 12.5 }}>
                    {fmtDate(load.pickupDate)}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.detailSection}>
              <div className={styles.sectionLabel}>Delivery</div>
              <div className={styles.pair2}>
                <div>
                  <div className={styles.fieldLabel}>At</div>
                  <div style={{ fontSize: 12.5 }}>{load.deliveryAddress}</div>
                </div>
                <div>
                  <div className={styles.fieldLabel}>Date</div>
                  <div className={styles.staticVal} style={{ fontSize: 12.5 }}>
                    {fmtDate(load.deliveryDate)}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.divider} />

            <div className={styles.sectionLabel}>Shipment</div>
            {(
              [
                ["Miles", load.miles ?? "—"],
                ["Pieces", loadDims?.pieces ?? "—"],
                [
                  "Weight",
                  load.weight ? `${load.weight.toLocaleString()} lbs` : "—",
                ],
                [
                  "Dims",
                  loadDims?.L
                    ? `${loadDims.L}×${loadDims.W}×${loadDims.H}`
                    : "—",
                ],
                ["Suggested truck", load.vehicleRequired ?? "—"],
              ] as Array<[string, string | number]>
            ).map(([lbl, val]) => (
              <div key={lbl} className={styles.detailRow}>
                <span className={styles.lbl}>{lbl}</span>
                <span className={styles.valMono}>{val}</span>
              </div>
            ))}
            <div className={styles.detailRow}>
              <span className={styles.lbl}>Recommended rate</span>
              <span className={styles.recRate}>
                {recRate != null ? `$${recRate.toLocaleString()}` : "—"}
              </span>
            </div>

            <div className={styles.divider} />

            <div className={styles.sectionLabel}>Reference</div>
            <div className={styles.detailRow}>
              <span className={styles.lbl}>Load ID</span>
              <span className={styles.valMono}>
                {load.brokerReference ?? `#${load.loadNumber}`}
              </span>
            </div>
            {load.brokerEmail && (
              <div className={styles.detailRow}>
                <span className={styles.lbl}>Broker email</span>
                <a
                  className={styles.brokerEmail}
                  href={`mailto:${load.brokerEmail}`}
                >
                  {load.brokerEmail}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
