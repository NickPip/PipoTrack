"use client";

import { useRef, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import PageTable, { TD, TD_MONO, Dim, KebabBtn, Pill, StackCell, Avatar, PrimaryBtn, FIRST_TD, LAST_TD } from "@/components/shared/PageTable";
import AddLoadModal, { type LoadRow } from "@/components/operations/AddLoadModal";
import LoadNotesPanel, { type LoadSummary } from "@/components/operations/LoadNotesPanel";
import NotesBtn from "@/components/operations/NotesBtn";

// ── Status config ────────────────────────────────────────────────────────────

const ACTIVE_STATUSES = new Set([
  "PENDING", "DISPATCHED_TO_PICKUP", "ONSITE_FOR_PICKUP",
  "LOADED_AND_DELIVERING", "ONSITE_FOR_DELIVERY",
]);

const STATUS_OPTIONS = [
  { value: "PENDING",               label: "Pending"     },
  { value: "DISPATCHED_TO_PICKUP",  label: "Dispatched"  },
  { value: "ONSITE_FOR_PICKUP",     label: "At Pickup"   },
  { value: "LOADED_AND_DELIVERING", label: "In Transit"  },
  { value: "ONSITE_FOR_DELIVERY",   label: "At Delivery" },
];

type StatusVariant = "dispatched" | "atPickup" | "inTransit";
const STATUS_MAP: Record<string, { label: string; variant: StatusVariant }> = {
  PENDING:               { label: "Pending",     variant: "dispatched" },
  DISPATCHED_TO_PICKUP:  { label: "Dispatched",  variant: "dispatched" },
  ONSITE_FOR_PICKUP:     { label: "At Pickup",   variant: "atPickup"   },
  LOADED_AND_DELIVERING: { label: "In Transit",  variant: "inTransit"  },
  ONSITE_FOR_DELIVERY:   { label: "At Delivery", variant: "atPickup"   },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchLoads(): Promise<LoadRow[]> {
  const res = await fetch("/api/loads");
  if (!res.ok) throw new Error("Failed to fetch loads");
  return res.json();
}

function parseAddress(addr: string) {
  const match = addr.match(/\b(\d{5})(-\d{4})?\b/);
  if (match) return { main: addr.replace(match[0], "").replace(/,\s*$/, "").trim(), zip: match[1] };
  return { main: addr, zip: "" };
}

function fmtDate(value: string) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return `${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

// ── Inline status dropdown ────────────────────────────────────────────────────

function StatusDropdown({ loadId, status, onMutate }: { loadId: string; status: string; onMutate: (id: string, newStatus: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const cfg = STATUS_MAP[status] ?? { label: status, variant: "dispatched" as StatusVariant };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}
      >
        <Pill label={cfg.label} variant={cfg.variant} />
        <ChevronDown size={11} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.10)", padding: "4px 0", zIndex: 50, minWidth: 130 }}>
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onMutate(loadId, opt.value); setOpen(false); }}
              style={{ width: "100%", textAlign: "left", padding: "6px 10px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-soft)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
            >
              <Pill label={opt.label} variant={STATUS_MAP[opt.value]?.variant ?? "dispatched"} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ActiveLoadsTable() {
  const qc = useQueryClient();
  const { data: allLoads = [], isLoading } = useQuery({ queryKey: ["loads"], queryFn: fetchLoads });
  const activeLoads = allLoads.filter(l => ACTIVE_STATUSES.has(l.status));

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/loads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["loads"] });
      const prev = qc.getQueryData<typeof allLoads>(["loads"]);
      qc.setQueryData<typeof allLoads>(["loads"], (old = []) =>
        old.map(l => (l.id === id ? { ...l, status } : l))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["loads"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["loads"] }),
  });

  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editLoad,     setEditLoad]     = useState<LoadRow | null>(null);
  const [notesLoad,    setNotesLoad]    = useState<LoadSummary | null>(null);

  const filtered = activeLoads.filter(l => {
    const q = search.toLowerCase();
    const matchSearch =
      String(l.loadNumber).includes(search) ||
      l.broker.toLowerCase().includes(q) ||
      (l.brokerReference ?? "").toLowerCase().includes(q) ||
      (l.dispatcherName ?? "").toLowerCase().includes(q) ||
      l.pickupAddress.toLowerCase().includes(q) ||
      l.deliveryAddress.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <>
      <PageTable
        breadcrumb={["Operations", "Active Loads"]}
        title="Active Loads"
        subtitle="Loads currently in progress — from pending to on-site delivery."
        count={activeLoads.length}
        isLoading={isLoading}
        actions={
          <PrimaryBtn onClick={() => { setEditLoad(null); setModalOpen(true); }}>
            New Load
          </PrimaryBtn>
        }
        search={search}
        onSearchChange={setSearch}
        filterChips={[{ label: "Status", value: statusFilter, options: STATUS_OPTIONS, onChange: setStatusFilter }]}
        columns={[
          { label: "Load #",        width: 80          },
          { label: "Ref #",         width: 110         },
          { label: "Status"                            },
          { label: "Broker"                            },
          { label: "Dispatcher"                        },
          { label: "Tracking ID"                       },
          { label: "Origin"                            },
          { label: "",              width: 18          },
          { label: "Destination"                       },
          { label: "Assigned Unit"                     },
          { label: "Rate",          align: "right"     },
          { label: "",              width: 80          },
          { label: "",              width: 48          },
        ]}
        rows={filtered}
        rowKey={l => l.id}
        emptyMessage="No active loads"
        emptyBody="Add a load or adjust your filters."
        renderCells={(load, isLast) => {
          const nb       = isLast ? "none" : undefined;
          const pickup   = parseAddress(load.pickupAddress);
          const delivery = parseAddress(load.deliveryAddress);
          return (
            <>
              <td style={{ ...TD_MONO, ...FIRST_TD, borderBottom: nb }}>#{load.loadNumber}</td>
              <td style={{ ...TD_MONO, color: "var(--ink-3)", borderBottom: nb }}>{load.brokerReference ?? <Dim />}</td>
              <td style={{ ...TD, borderBottom: nb }}>
                <StatusDropdown loadId={load.id} status={load.status} onMutate={(id, s) => statusMutation.mutate({ id, status: s })} />
              </td>
              <td style={{ ...TD, borderBottom: nb, whiteSpace: "nowrap" }}>{load.broker}</td>
              <td style={{ ...TD, borderBottom: nb }}>
                {load.dispatcherName
                  ? <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Avatar name={load.dispatcherName} /><span style={{ whiteSpace: "nowrap" }}>{load.dispatcherName}</span></div>
                  : <Dim />}
              </td>
              <td style={{ ...TD_MONO, borderBottom: nb }}>{load.trackingName ?? <Dim />}</td>
              <td style={{ ...TD, borderBottom: nb }}><StackCell top={pickup.main} topSub={pickup.zip || undefined} sub={fmtDate(load.pickupDate)} /></td>
              <td style={{ padding: 0, width: 18, verticalAlign: "middle", color: "var(--ink-3)", textAlign: "center", borderBottom: isLast ? "none" : "1px solid var(--line)" }}>→</td>
              <td style={{ ...TD, borderBottom: nb }}><StackCell top={delivery.main} topSub={delivery.zip || undefined} sub={fmtDate(load.deliveryDate)} /></td>
              <td style={{ ...TD, borderBottom: nb }}>
                {load.unitNumber
                  ? <StackCell top={load.unitNumber} sub={load.driverName ?? "No driver"} />
                  : <Dim />}
              </td>
              <td style={{ ...TD, borderBottom: nb, textAlign: "right", fontFamily: "var(--font-geist-mono, monospace)", fontSize: 12.5 }}>
                {load.rate != null ? `$${load.rate.toLocaleString()}` : <Dim />}
              </td>
              <td style={{ ...TD, borderBottom: nb, textAlign: "center" }}>
                <NotesBtn count={load.notesCount ?? 0} onClick={() => setNotesLoad({ id: load.id, loadNumber: load.loadNumber, broker: load.broker, trackingName: load.trackingName, dispatcherName: load.dispatcherName, pickupAddress: load.pickupAddress, pickupDate: load.pickupDate, deliveryAddress: load.deliveryAddress, deliveryDate: load.deliveryDate })} />
              </td>
              <td style={{ ...TD, ...LAST_TD, borderBottom: nb, textAlign: "right" }}>
                <KebabBtn onClick={() => { setEditLoad(load); setModalOpen(true); }} />
              </td>
            </>
          );
        }}
      />

      <AddLoadModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ["loads"] }); setModalOpen(false); }} load={editLoad} />
      {notesLoad && <LoadNotesPanel load={notesLoad} onClose={() => setNotesLoad(null)} />}
    </>
  );
}
