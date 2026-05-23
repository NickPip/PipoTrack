"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, UserRound } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import FilterBar from "@/components/shared/FilterBar";
import DriverModal, { type DriverRow } from "@/components/recruiting/DriverModal";

async function fetchDrivers(): Promise<DriverRow[]> {
  const res = await fetch("/api/drivers");
  if (!res.ok) throw new Error("Failed to fetch drivers");
  return res.json();
}

function CleanBadge({ value }: { value: boolean | null | undefined }) {
  if (value === true)
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">Yes</span>;
  if (value === false)
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">No</span>;
  return <span className="text-gray-300">—</span>;
}

export default function DriversTable() {
  const qc = useQueryClient();
  const { data: drivers = [], isLoading } = useQuery({ queryKey: ["drivers"], queryFn: fetchDrivers });

  const [search, setSearch] = useState("");
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
    const q = search.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      (d.phone ?? "").toLowerCase().includes(q) ||
      (d.dlNumber ?? "").toLowerCase().includes(q)
    );
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

  const COLS = 7;

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
        searchPlaceholder="Search by name, phone, or D/L number…"
      />

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Full Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Phone Number</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Assigned Unit</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">DL Number</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Citizenship</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Clean Background</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-50">
                <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                <td className="px-4 py-3"><Skeleton className="h-5 w-10 rounded-full" /></td>
                <td className="px-4 py-3" />
              </tr>
            ))}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={COLS} className="px-4 py-14 text-center">
                  <UserRound size={28} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-sm text-gray-400">No drivers found</p>
                </td>
              </tr>
            )}
            {filtered.map((driver, i) => (
              <tr
                key={driver.id}
                className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i === filtered.length - 1 ? "border-0" : ""}`}
              >
                <td className="px-4 py-3 font-medium text-gray-900">{driver.name}</td>
                <td className="px-4 py-3 text-gray-600">{driver.phone ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3 text-gray-600">
                  {driver.unit?.unitNumber ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {driver.dlNumber ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {driver.citizenshipType ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <CleanBadge value={driver.cleanBackground} />
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
