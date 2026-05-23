"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageTable, { TD, TD_MONO, Dim, KebabBtn, Pill, StackCell, Avatar, PrimaryBtn, FIRST_TD, LAST_TD } from "@/components/shared/PageTable";
import AddLoadModal, { type LoadRow } from "@/components/operations/AddLoadModal";
import LoadNotesPanel, { type LoadSummary } from "@/components/operations/LoadNotesPanel";
import NotesBtn from "@/components/operations/NotesBtn";

const STATUS_OPTIONS = [
  { value: "PENDING",               label: "Pending"      },
  { value: "DISPATCHED_TO_PICKUP",  label: "Dispatched"   },
  { value: "ONSITE_FOR_PICKUP",     label: "At Pickup"    },
  { value: "LOADED_AND_DELIVERING", label: "In Transit"   },
  { value: "ONSITE_FOR_DELIVERY",   label: "At Delivery"  },
  { value: "DELIVERED",             label: "Delivered"    },
  { value: "CANCELED",              label: "Canceled"     },
];

type StatusVariant = "dispatched" | "atPickup" | "inTransit" | "delivered" | "delayed" | "gray";
const STATUS_MAP: Record<string, { label: string; variant: StatusVariant }> = {
  PENDING:               { label: "Pending",     variant: "dispatched" },
  DISPATCHED_TO_PICKUP:  { label: "Dispatched",  variant: "dispatched" },
  ONSITE_FOR_PICKUP:     { label: "At Pickup",   variant: "atPickup"   },
  LOADED_AND_DELIVERING: { label: "In Transit",  variant: "inTransit"  },
  ONSITE_FOR_DELIVERY:   { label: "At Delivery", variant: "atPickup"   },
  DELIVERED:             { label: "Delivered",   variant: "delivered"  },
  CANCELED:              { label: "Canceled",    variant: "delayed"    },
};

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

export default function LoadsTable() {
  const qc = useQueryClient();
  const { data: loads = [], isLoading } = useQuery({ queryKey: ["loads"], queryFn: fetchLoads });

  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editLoad,     setEditLoad]     = useState<LoadRow | null>(null);
  const [notesLoad,    setNotesLoad]    = useState<LoadSummary | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/loads/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loads"] }),
  });

  const filtered = loads.filter(l => {
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
        breadcrumb={["Operations", "All Loads"]}
        title="All Loads"
        subtitle="Every load across all statuses."
        count={loads.length}
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
          { label: "Load #",       width: 80          },
          { label: "Ref #",        width: 110         },
          { label: "Status"                           },
          { label: "Broker"                           },
          { label: "Dispatcher"                       },
          { label: "Origin"                           },
          { label: "",             width: 18          },
          { label: "Destination"                      },
          { label: "Unit"                             },
          { label: "Rate",         align: "right"     },
          { label: "",             width: 80          },
          { label: "",             width: 48          },
        ]}
        rows={filtered}
        rowKey={l => l.id}
        emptyMessage="No loads found"
        emptyBody="Try adjusting your search or status filter."
        renderCells={(load, isLast) => {
          const nb       = isLast ? "none" : undefined;
          const pickup   = parseAddress(load.pickupAddress);
          const delivery = parseAddress(load.deliveryAddress);
          const statusCfg = STATUS_MAP[load.status] ?? { label: load.status, variant: "gray" as StatusVariant };
          return (
            <>
              <td style={{ ...TD_MONO, ...FIRST_TD, borderBottom: nb }}>#{load.loadNumber}</td>
              <td style={{ ...TD_MONO, color: "var(--ink-3)", borderBottom: nb }}>{load.brokerReference ?? <Dim />}</td>
              <td style={{ ...TD, borderBottom: nb }}>
                <Pill label={statusCfg.label} variant={statusCfg.variant as any} />
              </td>
              <td style={{ ...TD, borderBottom: nb, whiteSpace: "nowrap" }}>{load.broker}</td>
              <td style={{ ...TD, borderBottom: nb }}>
                {load.dispatcherName
                  ? <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Avatar name={load.dispatcherName} /><span style={{ whiteSpace: "nowrap" }}>{load.dispatcherName}</span></div>
                  : <Dim />}
              </td>
              <td style={{ ...TD, borderBottom: nb }}><StackCell top={pickup.main} topSub={pickup.zip || undefined} sub={fmtDate(load.pickupDate)} /></td>
              <td style={{ padding: 0, width: 18, verticalAlign: "middle", color: "var(--ink-3)", textAlign: "center", borderBottom: isLast ? "none" : "1px solid var(--line)" }}>→</td>
              <td style={{ ...TD, borderBottom: nb }}><StackCell top={delivery.main} topSub={delivery.zip || undefined} sub={fmtDate(load.deliveryDate)} /></td>
              <td style={{ ...TD, borderBottom: nb }}>{load.unitNumber ?? <Dim />}</td>
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
