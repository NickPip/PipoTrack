"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import FilterBar from "@/components/shared/FilterBar";
import type { LoadRow } from "@/components/operations/AddLoadModal";

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

const FIN_LABELS: Record<string, string> = {
  UNPAID: "Unpaid",
  PENDING: "Pending",
  PAID: "Paid",
};

const FIN_COLORS: Record<string, string> = {
  UNPAID: "bg-red-50 text-red-600",
  PENDING: "bg-yellow-50 text-yellow-700",
  PAID: "bg-green-50 text-green-700",
};

export default function DeliveredLoadsTable() {
  const { data: allLoads = [], isLoading } = useQuery({ queryKey: ["loads"], queryFn: fetchLoads });
  const delivered = allLoads.filter((l) => l.status === "DELIVERED");

  const [search, setSearch] = useState("");
  const [finFilter, setFinFilter] = useState("all");

  const filtered = delivered.filter((l) => {
    const matchSearch =
      String(l.loadNumber).includes(search) ||
      l.broker.toLowerCase().includes(search.toLowerCase()) ||
      l.pickupAddress.toLowerCase().includes(search.toLowerCase()) ||
      l.deliveryAddress.toLowerCase().includes(search.toLowerCase());
    const matchFin = finFilter === "all" || l.financialStatus === finFilter;
    return matchSearch && matchFin;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Delivered Loads</h1>
          <p className="text-sm text-gray-500 mt-0.5">{delivered.length} delivered</p>
        </div>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filterValue={finFilter}
        onFilterChange={setFinFilter}
        filterOptions={[
          { value: "UNPAID", label: "Unpaid" },
          { value: "PENDING", label: "Pending" },
          { value: "PAID", label: "Paid" },
        ]}
        filterPlaceholder="All Financial Statuses"
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
              <th className="text-left px-4 py-3 font-medium text-gray-500">Total Rate</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Payment</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No delivered loads</td></tr>
            )}
            {filtered.map((load, i) => (
              <tr
                key={load.id}
                className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i === filtered.length - 1 ? "border-0" : ""}`}
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">#{load.loadNumber}</p>
                  {load.brokerReference && <p className="text-xs text-gray-400">{load.brokerReference}</p>}
                </td>
                <td className="px-4 py-3 text-gray-900">{load.broker}</td>
                <td className="px-4 py-3">
                  <p className="text-gray-700">{load.pickupAddress}</p>
                  <p className="text-xs text-gray-400">{formatDate(load.pickupDate)}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-gray-700">{load.deliveryAddress}</p>
                  <p className="text-xs text-gray-400">{formatDate(load.deliveryDate)}</p>
                </td>
                <td className="px-4 py-3">
                  {load.rate != null ? (
                    <p className="text-gray-900 font-medium">${load.rate.toLocaleString()}</p>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${FIN_COLORS[load.financialStatus] ?? "bg-gray-100 text-gray-600"}`}>
                    {FIN_LABELS[load.financialStatus] ?? load.financialStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
