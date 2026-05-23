"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageTable, { TD, TD_MONO, Dim, KebabBtn, PrimaryBtn, FIRST_TD, LAST_TD } from "@/components/shared/PageTable";
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
          { label: "Unit #",         width: 160 },
          { label: "Type"                       },
          { label: "Dimensions (ft)"            },
          { label: "Owner"                      },
          { label: "Drivers",        width: 80  },
          { label: "",               width: 48  },
        ]}
        rows={filtered}
        rowKey={u => u.id}
        emptyMessage="No units found"
        emptyBody="Add a unit to get started."
        renderCells={(unit, isLast) => {
          const nb   = isLast ? "none" : undefined;
          const dims = unit.dimensions as { length: number; width: number; height: number } | null;
          return (
            <>
              <td style={{ ...TD, ...FIRST_TD, borderBottom: nb }}>
                <p style={{ margin: 0, fontWeight: 500, fontFamily: "var(--font-geist-mono, monospace)", fontSize: 12.5 }}>{unit.unitNumber}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--ink-3)" }}>{[unit.year, unit.make, unit.model].filter(Boolean).join(" ") || "—"}</p>
              </td>
              <td style={{ ...TD, borderBottom: nb }}>{unit.type}</td>
              <td style={{ ...TD, borderBottom: nb }}>
                {dims ? `${dims.length} × ${dims.width} × ${dims.height}` : <Dim />}
              </td>
              <td style={{ ...TD, borderBottom: nb }}>{unit.ownerName ?? <Dim />}</td>
              <td style={{ ...TD, borderBottom: nb }}>{unit.driverCount}</td>
              <td style={{ ...TD, ...LAST_TD, borderBottom: nb, textAlign: "right" }}>
                <KebabBtn onClick={() => { setEditUnit(unit); setModalOpen(true); }} />
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
