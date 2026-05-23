"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import FilterBar from "@/components/shared/FilterBar";
import AddLoadModal, { type LoadRow } from "@/components/operations/AddLoadModal";

const STATUS_FILTER_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "DISPATCHED_TO_PICKUP", label: "Dispatched to Pickup" },
  { value: "ONSITE_FOR_PICKUP", label: "OnSite for Pickup" },
  { value: "LOADED_AND_DELIVERING", label: "Loaded and Delivering" },
  { value: "ONSITE_FOR_DELIVERY", label: "OnSite for Delivery" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELED", label: "Canceled" },
];

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  DISPATCHED_TO_PICKUP: "Dispatched",
  ONSITE_FOR_PICKUP: "OnSite Pickup",
  LOADED_AND_DELIVERING: "Delivering",
  ONSITE_FOR_DELIVERY: "OnSite Delivery",
  DELIVERED: "Delivered",
  CANCELED: "Canceled",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  DISPATCHED_TO_PICKUP: "bg-blue-50 text-blue-700",
  ONSITE_FOR_PICKUP: "bg-yellow-50 text-yellow-700",
  LOADED_AND_DELIVERING: "bg-purple-50 text-purple-700",
  ONSITE_FOR_DELIVERY: "bg-orange-50 text-orange-700",
  DELIVERED: "bg-green-50 text-green-700",
  CANCELED: "bg-red-50 text-red-600",
};

async function fetchLoads(): Promise<LoadRow[]> {
  const res = await fetch("/api/loads");
  if (!res.ok) throw new Error("Failed to fetch loads");
  return res.json();
}

function formatDate(value: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${min}`;
}

export default function LoadsTable() {
  const qc = useQueryClient();
  const { data: loads = [], isLoading } = useQuery({ queryKey: ["loads"], queryFn: fetchLoads });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editLoad, setEditLoad] = useState<LoadRow | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/loads/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loads"] }),
  });

  const filtered = loads.filter((l) => {
    const matchSearch =
      String(l.loadNumber).includes(search) ||
      l.broker.toLowerCase().includes(search.toLowerCase()) ||
      (l.brokerReference ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (l.dispatcherName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      l.pickupAddress.toLowerCase().includes(search.toLowerCase()) ||
      l.deliveryAddress.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  function handleEdit(load: LoadRow) {
    setEditLoad(load);
    setModalOpen(true);
  }

  function handleAdd() {
    setEditLoad(null);
    setModalOpen(true);
  }

  function handleDelete(id: string) {
    if (confirm("Delete this load?")) deleteMutation.mutate(id);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">All Loads</h1>
          <p className="text-sm text-gray-500 mt-0.5">{loads.length} total</p>
        </div>
        <Button onClick={handleAdd} className="bg-black text-white hover:bg-gray-800">
          + Add New Load
        </Button>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filterValue={statusFilter}
        onFilterChange={setStatusFilter}
        filterOptions={STATUS_FILTER_OPTIONS}
        filterPlaceholder="All Statuses"
        searchPlaceholder="Search by load #, broker, address…"
      />

      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Load #</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Broker</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Pickup</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Delivery</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Rate</th>
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
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No loads found</td>
              </tr>
            )}
            {filtered.map((load, i) => (
              <tr
                key={load.id}
                className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i === filtered.length - 1 ? "border-0" : ""}`}
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">#{load.loadNumber}</p>
                  {load.brokerReference && (
                    <p className="text-xs text-gray-400">{load.brokerReference}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <p className="text-gray-900">{load.broker}</p>
                  {load.dispatcherName && (
                    <p className="text-xs text-gray-400">{load.dispatcherName}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <p className="text-gray-700">{load.pickupAddress}</p>
                  <p className="text-xs text-gray-400">{formatDate(load.pickupDate)}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-gray-700">{load.deliveryAddress}</p>
                  <p className="text-xs text-gray-400">{formatDate(load.deliveryDate)}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[load.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABELS[load.status] ?? load.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {load.rate != null ? (
                    <p className="text-gray-900 font-medium">${load.rate.toLocaleString()}</p>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                  {load.driverRate != null && load.driverRate > 0 && (
                    <p className="text-xs text-gray-400">Driver: ${load.driverRate.toLocaleString()}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleEdit(load)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(load.id)}
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

      <AddLoadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["loads"] })}
        load={editLoad}
      />
    </div>
  );
}
