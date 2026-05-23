"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Truck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import FilterBar from "@/components/shared/FilterBar";
import UnitModal, { type UnitRow } from "@/components/recruiting/UnitModal";

const TYPE_OPTIONS = [
  { value: "Sprinter Van", label: "Sprinter Van" },
  { value: "Cargo Van", label: "Cargo Van" },
  { value: "Small Straight", label: "Small Straight" },
  { value: "Large Straight", label: "Large Straight" },
];

async function fetchUnits(): Promise<UnitRow[]> {
  const res = await fetch("/api/units");
  if (!res.ok) throw new Error("Failed to fetch units");
  return res.json();
}

export default function UnitsTable() {
  const qc = useQueryClient();
  const { data: units = [], isLoading } = useQuery({ queryKey: ["units"], queryFn: fetchUnits });

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editUnit, setEditUnit] = useState<UnitRow | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/units/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["units"] }),
  });

  const filtered = units.filter((u) => {
    const matchSearch =
      u.unitNumber.toLowerCase().includes(search.toLowerCase()) ||
      (u.ownerName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (u.make ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (u.model ?? "").toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || u.type === typeFilter;
    return matchSearch && matchType;
  });

  function handleEdit(unit: UnitRow) {
    setEditUnit(unit);
    setModalOpen(true);
  }

  function handleAdd() {
    setEditUnit(null);
    setModalOpen(true);
  }

  function handleDelete(id: string) {
    if (confirm("Delete this unit?")) deleteMutation.mutate(id);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Units</h1>
          <p className="text-sm text-gray-500 mt-0.5">{units.length} total</p>
        </div>
        <Button onClick={handleAdd} className="bg-black text-white hover:bg-gray-800">
          + Add Unit
        </Button>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filterValue={typeFilter}
        onFilterChange={setTypeFilter}
        filterOptions={TYPE_OPTIONS}
        filterPlaceholder="All Types"
        searchPlaceholder="Search by unit number or owner…"
      />

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Unit #</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Dimensions (ft)</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Owner</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Drivers</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-50">
                <td className="px-4 py-3"><Skeleton className="h-4 w-20" /><Skeleton className="h-3 w-32 mt-1.5" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-8" /></td>
                <td className="px-4 py-3" />
              </tr>
            ))}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center">
                  <Truck size={28} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-sm text-gray-400">No units found</p>
                </td>
              </tr>
            )}
            {filtered.map((unit, i) => {
              const dims = unit.dimensions as { length: number; width: number; height: number } | null;
              return (
                <tr
                  key={unit.id}
                  className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i === filtered.length - 1 ? "border-0" : ""}`}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{unit.unitNumber}</p>
                    <p className="text-xs text-gray-400">{unit.year} {unit.make} {unit.model}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{unit.type}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {dims ? `${dims.length} × ${dims.width} × ${dims.height}` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{unit.ownerName ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{unit.driverCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(unit)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(unit.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <UnitModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["units"] })}
        unit={editUnit}
      />
    </div>
  );
}
