"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, PackageSearch } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import FilterBar from "@/components/shared/FilterBar";
import AddLoadModal, { type LoadRow } from "@/components/operations/AddLoadModal";

const ACTIVE_STATUSES = new Set([
  "PENDING",
  "DISPATCHED_TO_PICKUP",
  "ONSITE_FOR_PICKUP",
  "LOADED_AND_DELIVERING",
  "ONSITE_FOR_DELIVERY",
]);

const STATUS_FILTER_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "DISPATCHED_TO_PICKUP", label: "Dispatched to Pickup" },
  { value: "ONSITE_FOR_PICKUP", label: "OnSite for Pickup" },
  { value: "LOADED_AND_DELIVERING", label: "Loaded and Delivering" },
  { value: "ONSITE_FOR_DELIVERY", label: "OnSite for Delivery" },
];

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  DISPATCHED_TO_PICKUP: "Dispatched to Pickup",
  ONSITE_FOR_PICKUP: "OnSite for Pickup",
  LOADED_AND_DELIVERING: "Loaded and Delivering",
  ONSITE_FOR_DELIVERY: "OnSite for Delivery",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700",
  DISPATCHED_TO_PICKUP: "bg-blue-50 text-blue-700",
  ONSITE_FOR_PICKUP: "bg-purple-50 text-purple-700",
  LOADED_AND_DELIVERING: "bg-blue-50 text-blue-700",
  ONSITE_FOR_DELIVERY: "bg-orange-50 text-orange-700",
};

async function fetchLoads(): Promise<LoadRow[]> {
  const res = await fetch("/api/loads");
  if (!res.ok) throw new Error("Failed to fetch loads");
  return res.json();
}

function formatDate(value: string) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${min}`;
}

export default function ActiveLoadsTable() {
  const qc = useQueryClient();
  const { data: allLoads = [], isLoading } = useQuery({ queryKey: ["loads"], queryFn: fetchLoads });
  const activeLoads = allLoads.filter((l) => ACTIVE_STATUSES.has(l.status));

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

  const filtered = activeLoads.filter((l) => {
    const q = search.toLowerCase();
    const matchSearch =
      String(l.loadNumber).includes(search) ||
      l.broker.toLowerCase().includes(q) ||
      (l.brokerReference ?? "").toLowerCase().includes(q) ||
      (l.dispatcherName ?? "").toLowerCase().includes(q) ||
      (l.trackingName ?? "").toLowerCase().includes(q) ||
      l.pickupAddress.toLowerCase().includes(q) ||
      l.deliveryAddress.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Active Loads</h1>
          <p className="text-sm text-gray-500 mt-0.5">{activeLoads.length} active</p>
        </div>
        <Button onClick={() => { setEditLoad(null); setModalOpen(true); }} className="bg-black text-white hover:bg-gray-800">
          + Add New Load
        </Button>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filterValue={statusFilter}
        onFilterChange={setStatusFilter}
        filterOptions={STATUS_FILTER_OPTIONS}
        filterPlaceholder="All Active Statuses"
        searchPlaceholder="Search by load #, broker, address…"
      />

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Load #</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Ref #</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Broker</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Dispatcher</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Tracking ID</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Origin</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Destination</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Unit</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Distance</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Movement</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-50">
                <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-16 mt-1.5" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-16 mt-1.5" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                <td className="px-4 py-3"><Skeleton className="h-5 w-24 rounded-full" /></td>
                <td className="px-4 py-3" />
              </tr>
            ))}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-14 text-center">
                  <PackageSearch size={28} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-sm text-gray-400">No active loads</p>
                </td>
              </tr>
            )}
            {filtered.map((load, i) => (
              <tr
                key={load.id}
                className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i === filtered.length - 1 ? "border-0" : ""}`}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <p className="font-medium text-gray-900">#{load.loadNumber}</p>
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {load.brokerReference ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                  {load.broker}
                </td>
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                  {load.dispatcherName ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                  {load.trackingName ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 max-w-[150px]">
                  <p className="text-gray-700 truncate">{load.pickupAddress}</p>
                  <p className="text-xs text-gray-400">{formatDate(load.pickupDate)}</p>
                </td>
                <td className="px-4 py-3 max-w-[150px]">
                  <p className="text-gray-700 truncate">{load.deliveryAddress}</p>
                  <p className="text-xs text-gray-400">{formatDate(load.deliveryDate)}</p>
                </td>
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                  {load.unitNumber ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {load.miles != null ? (
                    <span className="text-gray-700">{load.miles.toLocaleString()} mi</span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                  {load.vehicleRequired ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[load.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABELS[load.status] ?? load.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => { setEditLoad(load); setModalOpen(true); }} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => { if (confirm("Delete this load?")) deleteMutation.mutate(load.id); }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
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
