"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageTable, { TD, Dim, RowActions, PrimaryBtn, FIRST_TD, LAST_TD } from "@/components/shared/PageTable";
import UnitModal, { type UnitRow } from "@/components/recruiting/UnitModal";

const TYPE_OPTIONS = [
  { value: "Sprinter Van",    label: "Sprinter Van"    },
  { value: "Cargo Van",       label: "Cargo Van"       },
  { value: "Small Straight",  label: "Small Straight"  },
  { value: "Large Straight",  label: "Large Straight"  },
];

async function fetchUnits(): Promise<UnitRow[]> {
  const res = await fetch("/api/units");
  if (!res.ok) throw new Error("Failed to fetch units");
  return res.json();
}

function AvailabilityToggle({ unitId, available, onMutate }: {
  unitId: string;
  available: boolean;
  onMutate: (id: string, available: boolean) => void;
}) {
  const isAvailable = available ?? true;
  return (
    <button
      onClick={() => onMutate(unitId, !isAvailable)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        fontFamily: "inherit",
        cursor: "pointer",
        border: "1.5px solid",
        transition: "background 0.15s, border-color 0.15s, color 0.15s",
        background: isAvailable ? "rgba(22,163,74,0.10)" : "rgba(220,38,38,0.08)",
        borderColor: isAvailable ? "rgba(22,163,74,0.35)" : "rgba(220,38,38,0.30)",
        color: isAvailable ? "#15803d" : "#b91c1c",
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: isAvailable ? "#16a34a" : "#dc2626",
        flexShrink: 0,
      }} />
      {isAvailable ? "Available" : "Not Available"}
    </button>
  );
}

export default function UnitsTable() {
  const qc = useQueryClient();
  const { data: units = [], isLoading } = useQuery({ queryKey: ["units"], queryFn: fetchUnits });

  const [search,     setSearch]     = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editUnit,   setEditUnit]   = useState<UnitRow | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/units/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["units"] }),
  });

  const availabilityMutation = useMutation({
    mutationFn: async ({ id, available }: { id: string; available: boolean }) => {
      const res = await fetch(`/api/units/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available }),
      });
      if (!res.ok) throw new Error("Failed to update availability");
    },
    onMutate: async ({ id, available }) => {
      await qc.cancelQueries({ queryKey: ["units"] });
      const prev = qc.getQueryData<UnitRow[]>(["units"]);
      qc.setQueryData<UnitRow[]>(["units"], old =>
        old?.map(u => u.id === id ? { ...u, available } : u) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["units"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["units"] }),
  });

  const filtered = units.filter(u => {
    const matchSearch =
      u.unitNumber.toLowerCase().includes(search.toLowerCase()) ||
      (u.ownerName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (u.make ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (u.model ?? "").toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || u.type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <>
      <PageTable
        breadcrumb={["Recruiting", "Units"]}
        title="Units"
        subtitle="Fleet vehicles registered in the system."
        count={units.length}
        isLoading={isLoading}
        actions={
          <PrimaryBtn onClick={() => { setEditUnit(null); setModalOpen(true); }}>
            Add Unit
          </PrimaryBtn>
        }
        search={search}
        onSearchChange={setSearch}
        filterChips={[{ label: "Type", value: typeFilter, options: TYPE_OPTIONS, onChange: setTypeFilter }]}
        columns={[
          { label: "Unit Number",    width: 140 },
          { label: "Owner"                      },
          { label: "Drivers",        width: 80  },
          { label: "Vehicle"                    },
          { label: "Type"                       },
          { label: "VIN"                        },
          { label: "Available",      width: 140 },
          { label: "",               width: 48  },
        ]}
        rows={filtered}
        rowKey={u => u.id}
        emptyMessage="No units found"
        emptyBody="Add a unit to get started."
        renderCells={(unit, isLast) => {
          const nb = isLast ? "none" : undefined;
          return (
            <>
              <td style={{ ...TD, ...FIRST_TD, borderBottom: nb }}>
                <p style={{ margin: 0, fontWeight: 500, fontFamily: "var(--font-geist-mono, monospace)", fontSize: 12.5 }}>{unit.unitNumber}</p>
              </td>
              <td style={{ ...TD, borderBottom: nb }}>{unit.ownerName ?? <Dim />}</td>
              <td style={{ ...TD, borderBottom: nb }}>{unit.driverCount}</td>
              <td style={{ ...TD, borderBottom: nb }}>
                {[unit.year, unit.make, unit.model].filter(Boolean).join(" ") || <Dim />}
              </td>
              <td style={{ ...TD, borderBottom: nb }}>{unit.type}</td>
              <td style={{ ...TD, borderBottom: nb }}>
                {unit.vin
                  ? <span style={{ fontFamily: "var(--font-geist-mono, monospace)", fontSize: 12, color: "var(--ink-2)" }}>{unit.vin}</span>
                  : <Dim />}
              </td>
              <td style={{ ...TD, borderBottom: nb }}>
                <AvailabilityToggle
                  unitId={unit.id}
                  available={unit.available ?? true}
                  onMutate={(id, av) => availabilityMutation.mutate({ id, available: av })}
                />
              </td>
              <td style={{ ...TD, ...LAST_TD, borderBottom: nb, textAlign: "right" }}>
                <RowActions
                  label={unit.unitNumber}
                  onEdit={() => { setEditUnit(unit); setModalOpen(true); }}
                  onDelete={() => deleteMutation.mutate(unit.id)}
                />
              </td>
            </>
          );
        }}
      />

      <UnitModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["units"] })}
        unit={editUnit}
      />
    </>
  );
}
