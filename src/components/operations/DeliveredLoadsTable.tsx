"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageTable, { TD, TD_MONO, Dim, RowActions, Pill, StackCell, Avatar, FIRST_TD, LAST_TD } from "@/components/shared/PageTable";
import AddLoadModal, { type LoadRow } from "@/components/operations/AddLoadModal";
import LoadNotesPanel, { type LoadSummary } from "@/components/operations/LoadNotesPanel";
import NotesBtn from "@/components/operations/NotesBtn";

const FIN_OPTIONS = [
  { value: "UNPAID",  label: "Unpaid"  },
  { value: "PENDING", label: "Pending" },
  { value: "PAID",    label: "Paid"    },
];

const FIN_VARIANT: Record<string, "green" | "amber" | "red"> = {
  PAID: "green", PENDING: "amber", UNPAID: "red",
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

export default function DeliveredLoadsTable() {
  const qc = useQueryClient();
  const { data: allLoads = [], isLoading } = useQuery({ queryKey: ["loads"], queryFn: fetchLoads });
  const delivered = allLoads.filter(l => l.status === "DELIVERED");

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/loads/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loads"] }),
  });

  const [search,    setSearch]    = useState("");
  const [finFilter, setFinFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editLoad,  setEditLoad]  = useState<LoadRow | null>(null);
  const [notesLoad, setNotesLoad] = useState<LoadSummary | null>(null);

  const filtered = delivered.filter(l => {
    const q = search.toLowerCase();
    const matchSearch =
      String(l.loadNumber).includes(search) ||
      l.broker.toLowerCase().includes(q) ||
      (l.brokerReference ?? "").toLowerCase().includes(q) ||
      (l.dispatcherName ?? "").toLowerCase().includes(q) ||
      l.pickupAddress.toLowerCase().includes(q) ||
      l.deliveryAddress.toLowerCase().includes(q);
    const matchFin = finFilter === "all" || l.financialStatus === finFilter;
    return matchSearch && matchFin;
  });

  return (
    <>
      <PageTable
        breadcrumb={["Operations", "Delivered"]}
        title="Delivered Loads"
        subtitle="Completed loads pending or received payment."
        count={delivered.length}
        isLoading={isLoading}
        search={search}
        onSearchChange={setSearch}
        filterChips={[{ label: "Payment", value: finFilter, options: FIN_OPTIONS, onChange: setFinFilter }]}
        columns={[
          { label: "Load #",       width: 80              },
          { label: "Ref #",        width: 110             },
          { label: "Broker"                               },
          { label: "Dispatcher"                           },
          { label: "Origin"                               },
          { label: "",             width: 18              },
          { label: "Destination"                          },
          { label: "Unit"                                 },
          { label: "Payment"                              },
          { label: "Rate",         align: "right"         },
          { label: "",             width: 80              },
          { label: "",             width: 48              },
        ]}
        rows={filtered}
        rowKey={l => l.id}
        emptyMessage="No delivered loads"
        emptyBody="Loads will appear here once marked as delivered."
        renderCells={(load, isLast) => {
          const nb       = isLast ? "none" : undefined;
          const pickup   = parseAddress(load.pickupAddress);
          const delivery = parseAddress(load.deliveryAddress);
          const finV     = FIN_VARIANT[load.financialStatus] ?? "gray";
          const finLabel = load.financialStatus === "PAID" ? "Paid" : load.financialStatus === "PENDING" ? "Pending" : "Unpaid";
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
              <td style={{ ...TD, borderBottom: nb }}><StackCell top={pickup.main} topSub={pickup.zip || undefined} sub={fmtDate(load.pickupDate)} /></td>
              <td style={{ padding: 0, width: 18, verticalAlign: "middle", color: "var(--ink-3)", textAlign: "center", borderBottom: isLast ? "none" : "1px solid var(--line)" }}>→</td>
              <td style={{ ...TD, borderBottom: nb }}><StackCell top={delivery.main} topSub={delivery.zip || undefined} sub={fmtDate(load.deliveryDate)} /></td>
              <td style={{ ...TD, borderBottom: nb }}>{load.unitNumber ?? <Dim />}</td>
              <td style={{ ...TD, borderBottom: nb }}><Pill label={finLabel} variant={finV as "green"|"amber"|"red"} /></td>
              <td style={{ ...TD, borderBottom: nb, textAlign: "right", fontFamily: "var(--font-geist-mono, monospace)", fontSize: 12.5 }}>
                {load.rate != null ? `$${load.rate.toLocaleString()}` : <Dim />}
              </td>
              <td style={{ ...TD, borderBottom: nb, textAlign: "center" }}>
                <NotesBtn count={load.notesCount ?? 0} onClick={() => setNotesLoad({ id: load.id, loadNumber: load.loadNumber, broker: load.broker, trackingName: load.trackingName, dispatcherName: load.dispatcherName, pickupAddress: load.pickupAddress, pickupDate: load.pickupDate, deliveryAddress: load.deliveryAddress, deliveryDate: load.deliveryDate })} />
              </td>
              <td style={{ ...TD, ...LAST_TD, borderBottom: nb, textAlign: "right" }}>
                <RowActions
                  label={`#${load.loadNumber}`}
                  onEdit={() => { setEditLoad(load); setModalOpen(true); }}
                  onDelete={() => deleteMutation.mutate(load.id)}
                />
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
