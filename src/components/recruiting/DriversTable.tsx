"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import FilterBar from "@/components/shared/FilterBar";
import DriverModal, { type DriverRow } from "@/components/recruiting/DriverModal";

const TYPE_OPTIONS = [
  { value: "Sprinter", label: "Sprinter" },
  { value: "Cargo Van", label: "Cargo Van" },
  { value: "Small Straight", label: "Small Straight" },
  { value: "Large Straight", label: "Large Straight" },
];

async function fetchDrivers(): Promise<DriverRow[]> {
  const res = await fetch("/api/drivers");
  if (!res.ok) throw new Error("Failed to fetch drivers");
  return res.json();
}

export default function DriversTable() {
  const qc = useQueryClient();
  const { data: drivers = [], isLoading } = useQuery({ queryKey: ["drivers"], queryFn: fetchDrivers });

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editDriver, setEditDriver] = useState<DriverRow | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/drivers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drivers"] }),
  });

  const filtered = drivers.filter((d) => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.currentZip.includes(search);
    const matchType = typeFilter === "all" || d.vehicleType === typeFilter;
    return matchSearch && matchType;
  });

  function handleEdit(driver: DriverRow) {
    setEditDriver(driver);
    setModalOpen(true);
  }

  function handleAdd() {
    setEditDriver(null);
    setModalOpen(true);
  }

  function handleDelete(id: string) {
    if (confirm("Delete this driver?")) deleteMutation.mutate(id);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Drivers</h1>
          <p className="text-sm text-gray-500 mt-0.5">{drivers.length} total</p>
        </div>
        <Button onClick={handleAdd} className="bg-black text-white hover:bg-gray-800">
          + Add Driver
        </Button>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filterValue={typeFilter}
        onFilterChange={setTypeFilter}
        filterOptions={TYPE_OPTIONS}
        filterPlaceholder="All Types"
        searchPlaceholder="Search by name or ZIP…"
      />

      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Vehicle Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">ZIP</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Radius</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Unit</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Telegram</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No drivers found</td>
              </tr>
            )}
            {filtered.map((driver, i) => (
              <tr
                key={driver.id}
                className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i === filtered.length - 1 ? "border-0" : ""}`}
              >
                <td className="px-4 py-3 font-medium text-gray-900">{driver.name}</td>
                <td className="px-4 py-3 text-gray-600">{driver.vehicleType}</td>
                <td className="px-4 py-3 text-gray-600">{driver.currentZip}</td>
                <td className="px-4 py-3 text-gray-600">{driver.searchRadius} mi</td>
                <td className="px-4 py-3 text-gray-600">
                  {driver.unit?.unitNumber ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {driver.telegramId ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleEdit(driver)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(driver.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DriverModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["drivers"] })}
        driver={editDriver}
      />
    </div>
  );
}
