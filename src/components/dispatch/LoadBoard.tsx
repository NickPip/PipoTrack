"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import BidModal, { type DispatchLoad, type Bid } from "./BidModal";
import styles from "./tendered.module.css";

type Tab = "all" | "new" | "quoted" | "archived";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtMins(mins: number): string {
  if (mins < 60) return `${Math.round(mins)}m`;
  return `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
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

function unitLabel(driver: Bid["driver"]): string {
  return driver.unit ? `UNIT-${driver.unit.unitNumber}` : "NO-UNIT";
}

// US 2-letter state code if present in the address string.
function stateOf(address: string | null): string | null {
  if (!address) return null;
  const m = address.match(/\b([A-Z]{2})\b(?:\s+\d{5})?/);
  return m ? m[1] : null;
}

type RateKind = "priced" | "wait" | "skipped" | "na";
function rateKind(bid: Bid): RateKind {
  if (bid.status === "skipped") return "skipped";
  if (bid.status === "sent" && bid.amount <= 0) return "wait";
  if (bid.amount > 0) return "priced";
  return "na";
}

function isDriverBid(bid: Bid): boolean {
  return bid.amount > 0 && bid.status !== "skipped";
}

// ── Driver cell ────────────────────────────────────────────────────────────────

function DriverCell({
  bid,
  loadStatus,
}: {
  bid: Bid;
  loadStatus: DispatchLoad["status"];
}) {
  // green fill = the driver the dispatcher quoted (only once the load is QUOTED);
  // green border = any driver who submitted a real bid amount.
  const assigned = loadStatus === "QUOTED" && bid.status === "accepted";
  const bidded = isDriverBid(bid) && !assigned;
  const kind = rateKind(bid);

  const cls = [
    styles.driverCell,
    assigned ? styles.driverAssigned : "",
    bidded ? styles.driverBid : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls}>
      {bidded && <span className={styles.cellTag}>BID</span>}
      {assigned && <span className={styles.cellStar} aria-hidden>★</span>}

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
        {kind === "priced" && <span className={styles.rate}>${bid.amount}</span>}
        {kind === "wait" && (
          <span className={`${styles.rate} ${styles.rateWait}`}>Waiting</span>
        )}
        {kind === "na" && (
          <span className={`${styles.rate} ${styles.rateNa}`}>N/A</span>
        )}
        {kind === "skipped" && (
          <span className={styles.rateSkip}>Rate: skipped</span>
        )}
      </div>
    </div>
  );
}

// ── Action column ──────────────────────────────────────────────────────────────

function ActionColumn({
  load,
  archived,
  onBid,
  onBook,
  onHide,
  onUnhide,
}: {
  load: DispatchLoad;
  archived: boolean;
  onBid: (l: DispatchLoad) => void;
  onBook: (l: DispatchLoad) => void;
  onHide: (id: string) => void;
  onUnhide: (id: string) => void;
}) {
  const [held, setHeld] = useState(false);
  const [holding, setHolding] = useState(false);

  if (archived) {
    return (
      <div className={styles.actionCol}>
        <button
          className={`${styles.bigBtn} ${styles.btnGhost}`}
          onClick={() => onUnhide(load.id)}
        >
          Unhide
        </button>
        <span style={{ textAlign: "center", fontSize: 11, color: "var(--ink-4)" }}>
          Archived
        </span>
      </div>
    );
  }

  if (load.status === "QUOTED") {
    const accepted = load.bids.find((b) => b.status === "accepted");
    const handleHold = async () => {
      setHolding(true);
      await fetch(`/api/dispatch/loads/${load.id}/hold`, { method: "POST" }).catch(
        () => {}
      );
      setHolding(false);
      setHeld(true);
    };
    return (
      <div className={styles.actionCol}>
        <div className={styles.bidSummary}>
          <div className={styles.bidSummaryAmt}>
            Your bid · <b>${load.rate?.toLocaleString() ?? "—"}</b>
          </div>
          <div className={styles.bidSummaryUnit}>
            {accepted ? unitLabel(accepted.driver) : "—"}
          </div>
          {accepted && (
            <div className={styles.bidSummaryTime}>
              <span className={styles.liveDot} aria-hidden />
              bidded {timeAgo(accepted.createdAt)}
            </div>
          )}
        </div>
        <button
          className={`${styles.bigBtn} ${styles.btnBook}`}
          onClick={() => onBook(load)}
        >
          Book
        </button>
        <div className={styles.twoUp}>
          <button
            className={styles.smBtn}
            onClick={handleHold}
            disabled={holding}
          >
            {holding ? "…" : held ? "Held ✓" : "Hold"}
          </button>
          <button className={styles.smBtn} onClick={() => onHide(load.id)}>
            Archive
          </button>
        </div>
      </div>
    );
  }

  // new / pending-distribution
  const hasCandidates = load.bids.length > 0;
  return (
    <div className={styles.actionCol}>
      <button
        className={`${styles.bigBtn} ${styles.btnBid}`}
        onClick={() => onBid(load)}
        disabled={!hasCandidates}
        title={hasCandidates ? "" : "No drivers have responded yet"}
        style={!hasCandidates ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
      >
        Place bid
      </button>
      <button
        className={`${styles.bigBtn} ${styles.btnDanger}`}
        onClick={() => onHide(load.id)}
      >
        Hide
      </button>
    </div>
  );
}

// ── Load card ──────────────────────────────────────────────────────────────────

function LoadCard({
  load,
  archived,
  onBid,
  onBook,
  onHide,
  onUnhide,
}: {
  load: DispatchLoad;
  archived: boolean;
  onBid: (l: DispatchLoad) => void;
  onBook: (l: DispatchLoad) => void;
  onHide: (id: string) => void;
  onUnhide: (id: string) => void;
}) {
  const dims = load.dimensions;
  const fromState = stateOf(load.pickupAddress);
  const toState = stateOf(load.deliveryAddress);

  const tags: Array<{ label: string; cls: string }> = [];
  if (load.miles != null && load.miles <= 150)
    tags.push({ label: "Local", cls: "" });
  if (load.miles != null && load.miles >= 500)
    tags.push({ label: "Long haul", cls: "" });
  if (load.stackable) tags.push({ label: "Stackable", cls: styles.tagExp });

  const idLabel = load.brokerReference ?? `#${load.loadNumber}`;
  const ariaLabel = `Tender ${idLabel} from ${fromState ?? ""} ${
    load.pickupZip ?? ""
  } to ${toState ?? ""} ${load.deliveryZip ?? ""}, posted ${timeAgo(
    load.createdAt
  )}`;

  return (
    <article className={styles.card} aria-label={ariaLabel}>
      {/* Left — meta */}
      <div className={styles.meta}>
        <div className={styles.routeLine}>
          <span className={styles.routeDot} aria-hidden />
          <span>
            {fromState && <span className={styles.st}>{fromState}</span>}
            <span className={styles.zip}>{load.pickupZip ?? "—"}</span>
          </span>
          <span className={styles.arrow} aria-hidden>
            →
          </span>
          <span>
            {toState && <span className={styles.st}>{toState}</span>}
            <span className={styles.zip}>{load.deliveryZip ?? "—"}</span>
          </span>
        </div>

        <div className={styles.desc}>
          <strong>{load.vehicleRequired ?? "Unknown"}</strong>
          {load.miles != null && (
            <>
              {" · "}
              <strong>{load.miles} mi</strong>
            </>
          )}
          {load.weight != null && (
            <>
              {" · "}
              <strong>{load.weight.toLocaleString()} lbs</strong>
            </>
          )}
          {dims?.pieces ? ` · ${dims.pieces} pcs` : ""}
        </div>

        {tags.length > 0 && (
          <div className={styles.tags}>
            {tags.map((t) => (
              <span key={t.label} className={`${styles.tag} ${t.cls}`}>
                {t.label}
              </span>
            ))}
          </div>
        )}

        <div className={styles.brokerBlock}>
          <div className={styles.brokerLabel}>Posted by {load.broker}</div>
          {load.brokerEmail && (
            <a className={styles.brokerEmail} href={`mailto:${load.brokerEmail}`}>
              {load.brokerEmail}
            </a>
          )}
        </div>

        <div className={styles.footerStamp}>
          <span>
            <span className={styles.liveDot} aria-hidden />
            Posted {timeAgo(load.createdAt)}
          </span>
          <span className={styles.idStamp}>ID {idLabel}</span>
        </div>
      </div>

      {/* Middle — driver grid */}
      <div className={styles.driverArea}>
        <div className={styles.driverGrid}>
          {load.bids.length === 0 ? (
            <div className={styles.driverEmpty}>No drivers sent yet</div>
          ) : (
            load.bids.map((bid) => (
              <DriverCell
                key={`${load.id}-${bid.id}`}
                bid={bid}
                loadStatus={load.status}
              />
            ))
          )}
        </div>
      </div>

      {/* Right — actions */}
      <ActionColumn
        load={load}
        archived={archived}
        onBid={onBid}
        onBook={onBook}
        onHide={onHide}
        onUnhide={onUnhide}
      />
    </article>
  );
}

// ── Book confirm modal ──────────────────────────────────────────────────────────

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

  return (
    <div
      className={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className={styles.modal} style={{ maxWidth: 420 }}>
        <div className={styles.modalHead}>
          <div className={styles.modalTitle}>Book this load?</div>
          <div className={styles.modalSub}>
            Load {load.brokerReference ?? `#${load.loadNumber}`} moves to
            Operations with status Pending.
          </div>
          <button className={styles.modalClose} onClick={onCancel}>
            ×
          </button>
        </div>
        <div style={{ padding: "18px 22px 22px" }}>
          <div className={styles.heroCard}>
            <div className={styles.heroText}>
              <strong>{load.vehicleRequired}</strong> ·{" "}
              {load.pickupZip ?? load.pickupAddress} →{" "}
              {load.deliveryZip ?? load.deliveryAddress}
            </div>
            {driver && (
              <div className={styles.bidSummaryUnit}>
                {unitLabel(driver)} / {driver.name}
              </div>
            )}
            {load.rate != null && (
              <div style={{ marginTop: 6 }}>
                <span className={styles.recRate}>
                  ${load.rate.toLocaleString()}
                </span>
              </div>
            )}
          </div>
          <button
            className={styles.sendBtn}
            onClick={onConfirm}
            disabled={booking}
            style={{ marginBottom: 8 }}
          >
            {booking ? "Booking…" : "Confirm booking"}
          </button>
          <button
            className={`${styles.bigBtn} ${styles.btnGhost}`}
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

// ── Board ──────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000;
const isDev = process.env.NODE_ENV === "development";

export default function LoadBoard() {
  const [loads, setLoads] = useState<DispatchLoad[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [modalLoad, setModalLoad] = useState<DispatchLoad | null>(null);
  const [bookingLoad, setBookingLoad] = useState<DispatchLoad | null>(null);
  const [booking, setBooking] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  const fetchLoads = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    fetch("/api/dispatch/loads")
      .then((r) => r.json())
      .then((d) => {
        setLoads(d.loads ?? []);
        setLoading(false);
        setLastUpdated(new Date());
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLoads();
    const interval = setInterval(() => fetchLoads(true), POLL_INTERVAL_MS);
    const handleVisibility = () => {
      if (!document.hidden) fetchLoads(true);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchLoads]);

  const handleHide = (id: string) =>
    setHidden((prev) => new Set([...prev, id]));
  const handleUnhide = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const handleConfirmBook = async () => {
    if (!bookingLoad) return;
    setBooking(true);
    const res = await fetch(`/api/dispatch/loads/${bookingLoad.id}/book`, {
      method: "POST",
    });
    setBooking(false);
    if (res.ok) {
      setBookingLoad(null);
      fetchLoads();
    }
  };

  const matchesSearch = (l: DispatchLoad): boolean => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const hay = [
      l.brokerReference,
      String(l.loadNumber),
      l.broker,
      l.brokerEmail,
      l.pickupZip,
      l.deliveryZip,
      ...l.bids.flatMap((b) => [
        b.driver.name,
        b.driver.unit ? `UNIT-${b.driver.unit.unitNumber}` : null,
      ]),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  };

  // Tabs are pipeline stages: All = distributed to drivers (no driver bid yet),
  // New = a driver has bid, Quoted = dispatcher has quoted the broker.
  const notHidden = loads.filter((l) => !hidden.has(l.id));
  const pendingCount = notHidden.filter(
    (l) => l.status === "PENDING_DISTRIBUTION"
  ).length;
  const newCount = notHidden.filter((l) => l.status === "HAS_BIDS").length;
  const quotedCount = notHidden.filter((l) => l.status === "QUOTED").length;
  const totalCount = notHidden.length;
  const archivedCount = hidden.size;

  const visible = (() => {
    if (tab === "archived")
      return loads.filter((l) => hidden.has(l.id) && matchesSearch(l));
    const base = notHidden.filter(matchesSearch);
    if (tab === "all")
      return base.filter((l) => l.status === "PENDING_DISTRIBUTION");
    if (tab === "new") return base.filter((l) => l.status === "HAS_BIDS");
    if (tab === "quoted") return base.filter((l) => l.status === "QUOTED");
    return base;
  })();

  // ── Dynamic subtitle + KPI aggregates ──
  const brokerCount = new Set(notHidden.map((l) => l.broker)).size;
  const earliest = notHidden.reduce<string | null>(
    (acc, l) => (!acc || l.createdAt < acc ? l.createdAt : acc),
    null
  );
  const ttbSamples = notHidden
    .map((l) => {
      const firstReal = l.bids.find(isDriverBid);
      if (!firstReal) return null;
      return (
        (new Date(firstReal.createdAt).getTime() -
          new Date(l.createdAt).getTime()) /
        60000
      );
    })
    .filter((n): n is number => n != null && n >= 0);
  const avgTtb = ttbSamples.length
    ? fmtMins(ttbSamples.reduce((a, b) => a + b, 0) / ttbSamples.length)
    : "—";
  const topLoad = notHidden.reduce<DispatchLoad | null>((acc, l) => {
    const r = l.rate ?? 0;
    return r > (acc?.rate ?? 0) ? l : acc;
  }, null);

  const uniqueDrivers = new Set(
    notHidden.flatMap((l) => l.bids.map((b) => b.driverId))
  ).size;
  const premiumPool = notHidden
    .filter((l) => l.status === "QUOTED")
    .reduce((sum, l) => sum + (l.rate ?? 0), 0);

  const tabBtn = (t: Tab) =>
    `${styles.tab} ${tab === t ? styles.tabActive : ""}`;

  const onTabKey = (e: React.KeyboardEvent) => {
    const order: Tab[] = ["all", "new", "quoted", "archived"];
    const i = order.indexOf(tab);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setTab(order[(i + 1) % order.length]);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setTab(order[(i - 1 + order.length) % order.length]);
    }
  };

  return (
    <div className={styles.board}>
      {modalLoad && (
        <BidModal
          load={modalLoad}
          onClose={() => setModalLoad(null)}
          onSaved={() => {
            setModalLoad(null);
            fetchLoads();
          }}
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

      {/* Page header */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <h1 className={styles.h1}>
              <span className={styles.pulse} aria-hidden />
              Tendered Loads
            </h1>
            <p className={styles.sub}>
              <strong>{totalCount} tenders</strong> from {brokerCount} broker
              {brokerCount === 1 ? "" : "s"}
              {earliest ? ` since ${fmtTime(earliest)}` : ""}.{" "}
              <strong>{newCount} were bid by a driver</strong>, {quotedCount}{" "}
              awaiting a broker response. Avg time-to-bid{" "}
              <strong>{avgTtb}</strong>.
              {topLoad?.rate
                ? ` Highest paying: ${topLoad.broker} $${topLoad.rate.toLocaleString()} · ${
                    topLoad.pickupZip ?? "?"
                  }→${topLoad.deliveryZip ?? "?"}.`
                : ""}
            </p>
          </div>

          <div className={styles.actions}>
            <button className={styles.btn} onClick={() => fetchLoads()}>
              Refresh
            </button>
            <button className={styles.btn}>Filters</button>
            {isDev && notHidden[0] && (
              <button
                className={`${styles.btn} ${styles.btnDev}`}
                onClick={() => setModalLoad(notHidden[0])}
              >
                Preview Book modal
              </button>
            )}
            <button className={`${styles.btn} ${styles.btnPrim}`}>
              <span className={styles.plus}>+</span> Manual tender
            </button>
          </div>
        </div>
      </div>

      {/* Tabs + toolbar */}
      <div
        className={styles.tabStrip}
        role="tablist"
        aria-label="Tender filters"
        ref={tabsRef}
        onKeyDown={onTabKey}
      >
        <button
          role="tab"
          aria-selected={tab === "all"}
          tabIndex={tab === "all" ? 0 : -1}
          className={tabBtn("all")}
          onClick={() => setTab("all")}
        >
          All
          <span className={`${styles.tabCount} ${styles.countNeutral}`}>
            {pendingCount}
          </span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "new"}
          tabIndex={tab === "new" ? 0 : -1}
          className={tabBtn("new")}
          onClick={() => setTab("new")}
        >
          New
          {newCount > 0 && (
            <span className={`${styles.tabCount} ${styles.countBad}`}>
              {newCount}
            </span>
          )}
        </button>
        <button
          role="tab"
          aria-selected={tab === "quoted"}
          tabIndex={tab === "quoted" ? 0 : -1}
          className={tabBtn("quoted")}
          onClick={() => setTab("quoted")}
        >
          Quoted
          {quotedCount > 0 && (
            <span className={`${styles.tabCount} ${styles.countWarn}`}>
              {quotedCount}
            </span>
          )}
        </button>
        <button
          role="tab"
          aria-selected={tab === "archived"}
          tabIndex={tab === "archived" ? 0 : -1}
          className={tabBtn("archived")}
          onClick={() => setTab("archived")}
        >
          Archived
          {archivedCount > 0 && (
            <span className={`${styles.tabCount} ${styles.countNeutral}`}>
              {archivedCount}
            </span>
          )}
        </button>

        <div className={styles.tabRight}>
          <div className={styles.search}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              placeholder="Search ID, broker, lane, ZIP, driver…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search tenders"
            />
            <kbd className={styles.kbd}>/</kbd>
          </div>
          <span className={styles.chip}>Today</span>
          <span className={`${styles.chip} ${styles.chipInfo}`}>Cargo Van</span>
        </div>
      </div>

      {/* Mini KPI strip */}
      <div className={styles.kpiStrip}>
        <span className={styles.kpiTile}>
          <span className={`${styles.kpiDot} ${styles.dotLive}`} aria-hidden />
          <b>{uniqueDrivers}</b> drivers in pool
          {lastUpdated && ` · refreshed ${timeAgo(lastUpdated.toISOString())}`}
        </span>
        <span className={styles.kpiTile}>
          <span className={`${styles.kpiDot} ${styles.dotInfo}`} aria-hidden />
          avg bid → response <b>{avgTtb}</b>
        </span>
        <span className={styles.kpiTile}>
          <span className={`${styles.kpiDot} ${styles.dotWarn}`} aria-hidden />
          <b>{newCount}</b> awaiting your bid
        </span>
        <span className={styles.kpiTile}>
          <span className={`${styles.kpiDot} ${styles.dotGold}`} aria-hidden />
          quoted pool <b>${premiumPool.toLocaleString()}</b> today
        </span>
      </div>

      {/* Cards */}
      {loading ? (
        <div className={styles.list}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={styles.skeleton} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className={styles.empty}>
          {tab === "new"
            ? "No driver bids yet. Loads move here once a driver bids."
            : tab === "all"
              ? "No active tenders. Distributed loads will appear here."
              : "No loads in this view."}
        </div>
      ) : (
        <div className={styles.list}>
          {visible.map((load) => (
            <LoadCard
              key={load.id}
              load={load}
              archived={tab === "archived"}
              onBid={setModalLoad}
              onBook={setBookingLoad}
              onHide={handleHide}
              onUnhide={handleUnhide}
            />
          ))}
        </div>
      )}
    </div>
  );
}
