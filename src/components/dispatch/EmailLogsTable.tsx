"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PageTable, {
  TD, TD_MONO, Dim, StackCell, Pill,
  FIRST_TD, LAST_TD,
} from "@/components/shared/PageTable";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmailLoad {
  id: string;
  loadNumber: number;
  status: string;
  broker: string;
  brokerName: string | null;
  brokerEmail: string | null;
  brokerPhone: string | null;
  brokerReference: string;
  pickupAddress: string;
  pickupZip: string | null;
  pickupDate: string;
  deliveryAddress: string;
  deliveryZip: string | null;
  deliveryDate: string;
  vehicleRequired: string | null;
  miles: number | null;
  weight: number | null;
  dimensions: { pieces?: number; L?: number; W?: number; H?: number } | null;
  rate: number | null;
  createdAt: string;
  bids: { id: string }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "2-digit", day: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

const STATUS_MAP: Record<string, { label: string; variant: "green" | "amber" | "gray" | "inTransit" | "dispatched" }> = {
  PENDING_DISTRIBUTION: { label: "Distributing",   variant: "amber"      },
  HAS_BIDS:             { label: "Has Bids",        variant: "inTransit"  },
  QUOTED:               { label: "Quoted",           variant: "inTransit"  },
  PENDING:              { label: "Booked",           variant: "green"      },
  DISPATCHED_TO_PICKUP: { label: "Dispatched",       variant: "dispatched" },
  ONSITE_FOR_PICKUP:    { label: "At Pickup",        variant: "amber"      },
  LOADED_AND_DELIVERING:{ label: "Delivering",       variant: "inTransit"  },
  ONSITE_FOR_DELIVERY:  { label: "At Delivery",      variant: "amber"      },
  DELIVERED:            { label: "Delivered",        variant: "green"      },
  CANCELED:             { label: "Canceled",         variant: "gray"       },
};

const COLS = [
  { label: "#",         width: 60  },
  { label: "Ref",       width: 120 },
  { label: "Route"                 },
  { label: "Vehicle",   width: 130 },
  { label: "Details",   width: 150 },
  { label: "Broker",    width: 190 },
  { label: "Status",    width: 120 },
  { label: "Parsed At", width: 130 },
  { label: "",          width: 60  },
];

// ── Detail Modal ──────────────────────────────────────────────────────────────

function DetailModal({ load, onClose }: { load: EmailLoad; onClose: () => void }) {
  const dims = load.dimensions;
  const st = STATUS_MAP[load.status] ?? { label: load.status, variant: "gray" as const };

  const section = (title: string, rows: [string, string | number | null | undefined][]) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px" }}>
        {rows.map(([label, val]) => (
          <div key={label}>
            <div style={{ fontSize: 11.5, color: "#9ca3af", marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: val != null && val !== "" ? "#111" : "#d1d5db" }}>
              {val != null && val !== "" ? String(val) : "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>

        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#111" }}>Order #{load.brokerReference}</span>
              <Pill label={st.label} variant={st.variant} />
            </div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>Load #{load.loadNumber} · Parsed {fmtDate(load.createdAt)}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, border: "none", background: "transparent", cursor: "pointer", fontSize: 20, color: "#6b7280", borderRadius: 8 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto" }}>
          {section("Broker", [
            ["Company",   load.broker],
            ["Contact",   load.brokerName],
            ["Email",     load.brokerEmail],
            ["Phone",     load.brokerPhone],
          ])}

          <div style={{ borderTop: "1px solid #f0f0f0", marginBottom: 20 }} />

          {section("Pickup", [
            ["Address",   load.pickupAddress],
            ["ZIP",       load.pickupZip],
            ["Date/Time", fmtDate(load.pickupDate)],
          ])}

          {section("Delivery", [
            ["Address",   load.deliveryAddress],
            ["ZIP",       load.deliveryZip],
            ["Date/Time", fmtDate(load.deliveryDate)],
          ])}

          <div style={{ borderTop: "1px solid #f0f0f0", marginBottom: 20 }} />

          {section("Freight", [
            ["Vehicle Required", load.vehicleRequired],
            ["Miles",            load.miles != null ? `${load.miles} mi` : null],
            ["Weight",           load.weight != null ? `${load.weight.toLocaleString()} lbs` : null],
            ["Rate",             load.rate != null ? `$${load.rate}` : null],
            ["Pieces",           dims?.pieces ?? null],
            ["Dimensions",       dims?.L ? `${dims.L}L × ${dims.W}W × ${dims.H}H` : null],
          ])}

          <div style={{ borderTop: "1px solid #f0f0f0", marginBottom: 20 }} />

          {section("Distribution", [
            ["Status",        st.label],
            ["Bids received", load.bids.length],
            ["Load #",        load.loadNumber],
            ["Ref",           load.brokerReference],
          ])}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function EmailLogsTable() {
  const qc = useQueryClient();
  const [polling, setPolling]     = useState(false);
  const [pollMsg, setPollMsg]     = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [detail, setDetail]       = useState<EmailLoad | null>(null);

  const { data, isLoading } = useQuery<{ loads: EmailLoad[] }>({
    queryKey: ["email-logs"],
    queryFn: () => fetch("/api/email/logs").then((r) => r.json()),
    staleTime: 30_000,
  });

  const loads = data?.loads ?? [];

  const filtered = loads.filter((l) => {
    const q = search.toLowerCase();
    return (
      !q ||
      l.brokerReference.toLowerCase().includes(q) ||
      l.broker.toLowerCase().includes(q) ||
      l.pickupAddress.toLowerCase().includes(q) ||
      l.deliveryAddress.toLowerCase().includes(q)
    );
  });

  const handlePoll = () => {
    setPolling(true);
    setPollMsg(null);
    fetch("/api/email/trigger", { method: "POST" })
      .then((r) => r.json())
      .then(() => {
        setPollMsg("Inbox checked — refreshing…");
        qc.invalidateQueries({ queryKey: ["email-logs"] });
      })
      .catch(() => setPollMsg("Request failed"))
      .finally(() => {
        setPolling(false);
        setTimeout(() => setPollMsg(null), 4000);
      });
  };

  return (
    <>
      {detail && <DetailModal load={detail} onClose={() => setDetail(null)} />}

      <PageTable
        breadcrumb={["Dispatch", "Email Parser"]}
        title="Email Parser"
        subtitle="Loads parsed from broker emails. Click a row to inspect all parsed fields."
        count={loads.length}
        isLoading={isLoading}
        search={search}
        onSearchChange={setSearch}
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {pollMsg && <span style={{ fontSize: 12, color: "#6b7280" }}>{pollMsg}</span>}
            <button
              onClick={handlePoll}
              disabled={polling}
              style={{
                height: 34, padding: "0 16px",
                background: polling ? "#6b7280" : "#111",
                color: "#fff", border: "none", borderRadius: 8,
                fontSize: 13, fontWeight: 600,
                cursor: polling ? "not-allowed" : "pointer",
              }}
            >
              {polling ? "Checking…" : "Poll Inbox Now"}
            </button>
          </div>
        }
        columns={COLS}
        rows={filtered}
        rowKey={(l) => l.id}
        emptyMessage="No email-parsed loads yet"
        emptyBody="Click 'Poll Inbox Now' to check the inbox, or wait for the cron job."
        renderCells={(load, isLast) => {
          const st = STATUS_MAP[load.status] ?? { label: load.status, variant: "gray" as const };
          const dims = load.dimensions;
          return (
            <>
              <td style={{ ...TD, ...FIRST_TD, color: "#9ca3af", fontSize: 12 }}>
                #{load.loadNumber}
              </td>
              <td style={TD_MONO}>
                <strong style={{ color: "#111" }}>{load.brokerReference}</strong>
              </td>
              <td style={TD}>
                <StackCell
                  top={`${load.pickupAddress}${load.pickupZip ? ` ${load.pickupZip}` : ""}`}
                  sub={`${load.deliveryAddress}${load.deliveryZip ? ` ${load.deliveryZip}` : ""}`}
                />
              </td>
              <td style={TD}>
                {load.vehicleRequired
                  ? <Pill label={load.vehicleRequired} variant="gray" />
                  : <Dim />}
              </td>
              <td style={TD}>
                <StackCell
                  top={[
                    load.miles  ? `${load.miles} mi`                   : null,
                    load.weight ? `${load.weight.toLocaleString()} lbs` : null,
                  ].filter(Boolean).join(" · ") || "—"}
                  sub={dims?.pieces ? `${dims.pieces} pcs${dims.L ? ` · ${dims.L}×${dims.W}×${dims.H}` : ""}` : undefined}
                />
              </td>
              <td style={TD}>
                <StackCell
                  top={load.broker}
                  sub={load.brokerEmail ?? load.brokerPhone ?? undefined}
                />
              </td>
              <td style={TD}>
                <Pill label={st.label} variant={st.variant} />
              </td>
              <td style={{ ...TD, color: "#9ca3af", fontSize: 12 }}>
                {fmtDate(load.createdAt)}
              </td>
              <td style={{ ...TD, ...(isLast ? LAST_TD : {}) }}>
                <button
                  onClick={() => setDetail(load)}
                  style={{
                    padding: "4px 10px", border: "1px solid #e5e7eb",
                    borderRadius: 6, background: "#fff", cursor: "pointer",
                    fontSize: 12, fontWeight: 500, color: "#374151",
                  }}
                >
                  View
                </button>
              </td>
            </>
          );
        }}
      />
    </>
  );
}
