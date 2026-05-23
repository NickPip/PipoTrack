"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, FileText, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LoadRow } from "@/components/operations/AddLoadModal";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_FILTER_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "DISPATCHED_TO_PICKUP", label: "Dispatched to Pickup" },
  { value: "ONSITE_FOR_PICKUP", label: "OnSite for Pickup" },
  { value: "LOADED_AND_DELIVERING", label: "Loaded and Delivering" },
  { value: "ONSITE_FOR_DELIVERY", label: "OnSite for Delivery" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELED", label: "Canceled" },
];

const PAYMENT_FILTER_OPTIONS = [
  { value: "PAID", label: "Paid" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "PENDING", label: "Pending" },
];

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  DISPATCHED_TO_PICKUP: "Dispatched to Pickup",
  ONSITE_FOR_PICKUP: "OnSite for Pickup",
  LOADED_AND_DELIVERING: "Loaded and Delivering",
  ONSITE_FOR_DELIVERY: "OnSite for Delivery",
  DELIVERED: "Delivered",
  CANCELED: "Canceled",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700",
  DISPATCHED_TO_PICKUP: "bg-blue-50 text-blue-700",
  ONSITE_FOR_PICKUP: "bg-purple-50 text-purple-700",
  LOADED_AND_DELIVERING: "bg-blue-50 text-blue-700",
  ONSITE_FOR_DELIVERY: "bg-orange-50 text-orange-700",
  DELIVERED: "bg-green-50 text-green-700",
  CANCELED: "bg-red-50 text-red-500",
};

const PAYMENT_LABELS: Record<string, string> = {
  PAID: "Paid",
  UNPAID: "Unpaid",
  PENDING: "Pending",
};

const PAYMENT_COLORS: Record<string, string> = {
  PAID: "bg-green-50 text-green-700",
  UNPAID: "bg-red-50 text-red-500",
  PENDING: "bg-yellow-50 text-yellow-700",
};

const FACTORING_LABELS: Record<string, string> = {
  YES: "Yes",
  NO: "No",
  WARNING: "Warning",
};

const FACTORING_COLORS: Record<string, string> = {
  YES: "bg-green-50 text-green-700",
  NO: "bg-red-50 text-red-500",
  WARNING: "bg-yellow-50 text-yellow-700",
};

const FACTORING_OPTIONS = [
  { value: "YES", label: "Yes" },
  { value: "NO", label: "No" },
  { value: "WARNING", label: "Warning" },
];

const PAYMENT_OPTIONS = [
  { value: "PAID", label: "Paid" },
  { value: "UNPAID", label: "Unpaid" },
];

// ─── Inline Dropdown ──────────────────────────────────────────────────────────

interface InlineDropdownProps {
  value: string | null | undefined;
  options: { value: string; label: string }[];
  labelMap: Record<string, string>;
  colorMap: Record<string, string>;
  emptyLabel?: string;
  onChange: (val: string | null) => void;
  disabled?: boolean;
}

function InlineDropdown({
  value,
  options,
  labelMap,
  colorMap,
  emptyLabel = "—",
  onChange,
  disabled,
}: InlineDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const label = value ? (labelMap[value] ?? value) : emptyLabel;
  const color = value ? (colorMap[value] ?? "bg-gray-100 text-gray-500") : "";

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
          value ? color : "text-gray-400"
        } ${disabled ? "cursor-default" : "cursor-pointer hover:opacity-80"}`}
      >
        {label}
        {!disabled && <ChevronDown size={10} className="opacity-60" />}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-50 min-w-[120px]">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 transition-colors ${
                value === opt.value ? "font-medium" : ""
              }`}
            >
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                  colorMap[opt.value] ?? "bg-gray-100 text-gray-500"
                }`}
              >
                {opt.label}
              </span>
            </button>
          ))}
          {value && (
            <button
              onClick={() => { onChange(null); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

async function fetchLoads(): Promise<LoadRow[]> {
  const res = await fetch("/api/loads");
  if (!res.ok) throw new Error("Failed to fetch loads");
  return res.json();
}

export default function AccountingTable({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const { data: loads = [], isLoading } = useQuery({ queryKey: ["loads"], queryFn: fetchLoads });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const res = await fetch(`/api/loads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ["loads"] });
      const prev = qc.getQueryData<LoadRow[]>(["loads"]);
      qc.setQueryData<LoadRow[]>(["loads"], (old = []) =>
        old.map((l) => (l.id === id ? { ...l, ...patch } : l))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["loads"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["loads"] }),
  });

  const filtered = loads.filter((l) => {
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
    const matchPayment = paymentFilter === "all" || l.financialStatus === paymentFilter;
    return matchSearch && matchStatus && matchPayment;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Accounting</h1>
          <p className="text-sm text-gray-500 mt-0.5">{loads.length} total loads</p>
        </div>
      </div>

      {/* Search + two filter dropdowns */}
      <div className="flex gap-3 mb-6">
        <Input
          className="flex-1"
          placeholder="Search by load #, broker, dispatcher, tracking ID, driver, or address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All Load Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Load Statuses</SelectItem>
            {STATUS_FILTER_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payment</SelectItem>
            {PAYMENT_FILTER_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Load #</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Broker</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Dispatcher</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Origin</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Destination</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Unit</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Factoring</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Payment</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-400">Loading…</td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-400">No loads found</td>
              </tr>
            )}
            {filtered.map((load, i) => (
              <tr
                key={load.id}
                className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                  i === filtered.length - 1 ? "border-0" : ""
                }`}
              >
                {/* Load # */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <p className="font-medium text-gray-900">#{load.loadNumber}</p>
                  {load.brokerReference && (
                    <p className="text-xs text-gray-400">{load.brokerReference}</p>
                  )}
                </td>

                {/* Broker */}
                <td className="px-4 py-3">
                  <p className="text-gray-900">{load.broker}</p>
                </td>

                {/* Dispatcher */}
                <td className="px-4 py-3">
                  <p className="text-gray-700">{load.dispatcherName ?? <span className="text-gray-300">—</span>}</p>
                </td>

                {/* Origin */}
                <td className="px-4 py-3 max-w-[160px]">
                  <p className="text-gray-700 truncate">{load.pickupAddress}</p>
                </td>

                {/* Destination */}
                <td className="px-4 py-3 max-w-[160px]">
                  <p className="text-gray-700 truncate">{load.deliveryAddress}</p>
                </td>

                {/* Unit */}
                <td className="px-4 py-3 whitespace-nowrap">
                  {load.unitNumber ? (
                    <p className="text-gray-700">{load.unitNumber}</p>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>

                {/* Status */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      STATUS_COLORS[load.status] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {STATUS_LABELS[load.status] ?? load.status}
                  </span>
                </td>

                {/* Factoring */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <InlineDropdown
                    value={load.factoringStatus}
                    options={FACTORING_OPTIONS}
                    labelMap={FACTORING_LABELS}
                    colorMap={FACTORING_COLORS}
                    emptyLabel="—"
                    disabled={!canEdit}
                    onChange={(val) =>
                      updateMutation.mutate({
                        id: load.id,
                        patch: { factoringStatus: val },
                      })
                    }
                  />
                </td>

                {/* Payment */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <InlineDropdown
                    value={load.financialStatus}
                    options={PAYMENT_OPTIONS}
                    labelMap={PAYMENT_LABELS}
                    colorMap={PAYMENT_COLORS}
                    emptyLabel="Unpaid"
                    disabled={!canEdit}
                    onChange={(val) =>
                      updateMutation.mutate({
                        id: load.id,
                        patch: { financialStatus: val ?? "UNPAID" },
                      })
                    }
                  />
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                      title="View load"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                      title="View documents"
                      onClick={() => {
                        const docs = [load.rcUrl, ...(load.bolUrls ?? []), load.podUrl].filter(Boolean);
                        if (docs.length) window.open(docs[0]!, "_blank");
                      }}
                    >
                      <FileText size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
