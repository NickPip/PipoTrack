"use client";

import { useRef, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, FileText, ChevronDown } from "lucide-react";
import PageTable, { TD, TD_MONO, Dim, Pill, StackCell, Avatar, FIRST_TD, LAST_TD } from "@/components/shared/PageTable";
import NotesBtn from "@/components/operations/NotesBtn";
import type { LoadRow } from "@/components/operations/AddLoadModal";
import LoadNotesPanel, { type LoadSummary } from "@/components/operations/LoadNotesPanel";

// ── Status config ─────────────────────────────────────────────────────────────

const LOAD_STATUS_OPTIONS = [
  { value: "PENDING",               label: "Pending"     },
  { value: "DISPATCHED_TO_PICKUP",  label: "Dispatched"  },
  { value: "ONSITE_FOR_PICKUP",     label: "At Pickup"   },
  { value: "LOADED_AND_DELIVERING", label: "In Transit"  },
  { value: "ONSITE_FOR_DELIVERY",   label: "At Delivery" },
  { value: "DELIVERED",             label: "Delivered"   },
  { value: "CANCELED",              label: "Canceled"    },
];

type StatusVariant = "dispatched" | "atPickup" | "inTransit" | "delivered" | "delayed";
const STATUS_MAP: Record<string, { label: string; variant: StatusVariant }> = {
  PENDING:               { label: "Pending",     variant: "dispatched" },
  DISPATCHED_TO_PICKUP:  { label: "Dispatched",  variant: "dispatched" },
  ONSITE_FOR_PICKUP:     { label: "At Pickup",   variant: "atPickup"   },
  LOADED_AND_DELIVERING: { label: "In Transit",  variant: "inTransit"  },
  ONSITE_FOR_DELIVERY:   { label: "At Delivery", variant: "atPickup"   },
  DELIVERED:             { label: "Delivered",   variant: "delivered"  },
  CANCELED:              { label: "Canceled",    variant: "delayed"    },
};

const PAYMENT_OPTIONS = [
  { value: "PAID",    label: "Paid"    },
  { value: "UNPAID",  label: "Unpaid"  },
  { value: "PENDING", label: "Pending" },
];

const FACTORING_OPTIONS = [
  { value: "YES",     label: "Yes"     },
  { value: "NO",      label: "No"      },
  { value: "WARNING", label: "Warning" },
];

const FIN_FILTER_OPTIONS = [
  { value: "PAID",    label: "Paid"    },
  { value: "UNPAID",  label: "Unpaid"  },
  { value: "PENDING", label: "Pending" },
];

// ── Inline editable dropdown ──────────────────────────────────────────────────

type PillVariant = "green" | "red" | "amber" | "gray";

const PAYMENT_VARIANT: Record<string, PillVariant> = { PAID: "green", UNPAID: "red", PENDING: "amber" };
const FACTORING_VARIANT: Record<string, PillVariant> = { YES: "green", NO: "red", WARNING: "amber" };

interface InlinePillDropdownProps {
  value: string | null | undefined;
  options: { value: string; label: string }[];
  variantMap: Record<string, PillVariant>;
  emptyLabel?: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

function InlinePillDropdown({ value, options, variantMap, emptyLabel = "—", onChange, disabled }: InlinePillDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const label   = value ? (options.find(o => o.value === value)?.label ?? value) : emptyLabel;
  const variant = value ? (variantMap[value] ?? "gray") : "gray";

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => !disabled && setOpen(v => !v)}
        disabled={disabled}
        style={{ background: "none", border: "none", padding: 0, cursor: disabled ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}
      >
        <Pill label={label} variant={variant} />
        {!disabled && (
          <ChevronDown size={11} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
        )}
      </button>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.10)", padding: "4px 0", zIndex: 50, minWidth: 120 }}>
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{ width: "100%", textAlign: "left", padding: "6px 10px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-soft)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
            >
              <Pill label={opt.label} variant={variantMap[opt.value] ?? "gray"} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function AccountingTable({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const { data: loads = [], isLoading } = useQuery({ queryKey: ["loads"], queryFn: fetchLoads });

  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [notesLoad,     setNotesLoad]     = useState<LoadSummary | null>(null);

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const res = await fetch(`/api/loads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ["loads"] });
      const prev = qc.getQueryData<LoadRow[]>(["loads"]);
      qc.setQueryData<LoadRow[]>(["loads"], (old = []) =>
        old.map(l => (l.id === id ? { ...l, ...patch } : l))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["loads"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["loads"] }),
  });

  const filtered = loads.filter(l => {
    const q = search.toLowerCase();
    const matchSearch =
      String(l.loadNumber).includes(search) ||
      l.broker.toLowerCase().includes(q) ||
      (l.brokerReference ?? "").toLowerCase().includes(q) ||
      (l.dispatcherName ?? "").toLowerCase().includes(q) ||
      (l.trackingName ?? "").toLowerCase().includes(q) ||
      l.pickupAddress.toLowerCase().includes(q) ||
      l.deliveryAddress.toLowerCase().includes(q);
    const matchStatus  = statusFilter  === "all" || l.status          === statusFilter;
    const matchPayment = paymentFilter === "all" || l.financialStatus === paymentFilter;
    return matchSearch && matchStatus && matchPayment;
  });

  return (
    <>
      <PageTable
        breadcrumb={["Accounting"]}
        title="Accounting"
        subtitle="Payment and factoring status for all loads."
        count={loads.length}
        isLoading={isLoading}
        search={search}
        onSearchChange={setSearch}
        filterChips={[
          { label: "Status",  value: statusFilter,  options: LOAD_STATUS_OPTIONS, onChange: setStatusFilter  },
          { label: "Payment", value: paymentFilter, options: FIN_FILTER_OPTIONS,  onChange: setPaymentFilter },
        ]}
        columns={[
          { label: "Load #",      width: 80      },
          { label: "Ref #",       width: 110     },
          { label: "Broker"                      },
          { label: "Dispatcher"                  },
          { label: "Origin"                      },
          { label: "",            width: 18      },
          { label: "Destination"                 },
          { label: "Unit",        width: 90      },
          { label: "Status"                      },
          { label: "Factoring"                   },
          { label: "Payment"                     },
          { label: "",            width: 80      },
          { label: "",            width: 80      },
        ]}
        rows={filtered}
        rowKey={l => l.id}
        emptyMessage="No loads found"
        emptyBody="Try adjusting your search or filters."
        renderCells={(load, isLast) => {
          const nb       = isLast ? "none" : undefined;
          const pickup   = parseAddress(load.pickupAddress);
          const delivery = parseAddress(load.deliveryAddress);
          const statusCfg = STATUS_MAP[load.status] ?? { label: load.status, variant: "dispatched" as StatusVariant };
          return (
            <>
              <td style={{ ...TD_MONO, ...FIRST_TD, borderBottom: nb }}>#{load.loadNumber}</td>
              <td style={{ ...TD_MONO, color: "var(--ink-3)", borderBottom: nb }}>{load.brokerReference ?? <Dim />}</td>
              <td style={{ ...TD, borderBottom: nb, whiteSpace: "nowrap" }}>{load.broker}</td>
              <td style={{ ...TD, borderBottom: nb }}>
                {load.dispatcherName
                  ? <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Avatar name={load.dispatcherName} /><span style={{ whiteSpace: "nowrap" }}>{load.dispatcherName}</span></div>
                  : <Dim />}
              </td>
              <td style={{ ...TD, borderBottom: nb }}>
                <StackCell top={pickup.main} topSub={pickup.zip || undefined} sub={fmtDate(load.pickupDate)} />
              </td>
              <td style={{ padding: 0, width: 18, verticalAlign: "middle", color: "var(--ink-3)", textAlign: "center", borderBottom: isLast ? "none" : "1px solid var(--line)" }}>→</td>
              <td style={{ ...TD, borderBottom: nb }}>
                <StackCell top={delivery.main} topSub={delivery.zip || undefined} sub={fmtDate(load.deliveryDate)} />
              </td>
              <td style={{ ...TD, borderBottom: nb }}>{load.unitNumber ?? <Dim />}</td>
              <td style={{ ...TD, borderBottom: nb }}>
                <Pill label={statusCfg.label} variant={statusCfg.variant} />
              </td>
              <td style={{ ...TD, borderBottom: nb }}>
                <InlinePillDropdown
                  value={load.factoringStatus}
                  options={FACTORING_OPTIONS}
                  variantMap={FACTORING_VARIANT}
                  emptyLabel="—"
                  disabled={!canEdit}
                  onChange={val => updateMutation.mutate({ id: load.id, patch: { factoringStatus: val } })}
                />
              </td>
              <td style={{ ...TD, borderBottom: nb }}>
                <InlinePillDropdown
                  value={load.financialStatus}
                  options={PAYMENT_OPTIONS}
                  variantMap={PAYMENT_VARIANT}
                  emptyLabel="Unpaid"
                  disabled={!canEdit}
                  onChange={val => updateMutation.mutate({ id: load.id, patch: { financialStatus: val } })}
                />
              </td>
              <td style={{ ...TD, borderBottom: nb, textAlign: "center" }}>
                <NotesBtn count={load.notesCount ?? 0} onClick={() => setNotesLoad({ id: load.id, loadNumber: load.loadNumber, broker: load.broker, trackingName: load.trackingName, dispatcherName: load.dispatcherName, pickupAddress: load.pickupAddress, pickupDate: load.pickupDate, deliveryAddress: load.deliveryAddress, deliveryDate: load.deliveryDate })} />
              </td>
              <td style={{ ...TD, ...LAST_TD, borderBottom: nb, textAlign: "right" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                  <IconBtn title="View documents" onClick={() => {
                    const docs = [load.rcUrl, ...(load.bolUrls ?? []), load.podUrl].filter(Boolean);
                    if (docs.length) window.open(docs[0]!, "_blank");
                  }}>
                    <FileText size={14} />
                  </IconBtn>
                  <IconBtn title="View load"><Eye size={14} /></IconBtn>
                </div>
              </td>
            </>
          );
        }}
      />

      {notesLoad && <LoadNotesPanel load={notesLoad} onClose={() => setNotesLoad(null)} />}
    </>
  );
}

function IconBtn({ onClick, title, children }: { onClick?: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "transparent", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", transition: "background 0.14s ease, color 0.14s ease" }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-soft)"; e.currentTarget.style.color = "var(--ink-1)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ink-3)"; }}
    >
      {children}
    </button>
  );
}
