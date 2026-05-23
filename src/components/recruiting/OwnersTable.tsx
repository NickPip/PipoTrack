"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import FilterBar from "@/components/shared/FilterBar";
import OwnerModal, { type OwnerRow } from "@/components/recruiting/OwnerModal";

async function fetchOwners(): Promise<OwnerRow[]> {
  const res = await fetch("/api/owners");
  if (!res.ok) throw new Error("Failed to fetch owners");
  return res.json();
}

export default function OwnersTable() {
  const qc = useQueryClient();
  const { data: owners = [], isLoading } = useQuery({ queryKey: ["owners"], queryFn: fetchOwners });

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editOwner, setEditOwner] = useState<OwnerRow | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/owners/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["owners"] }),
  });

  const filtered = owners.filter((o) => {
    const q = search.toLowerCase();
    return (
      o.name.toLowerCase().includes(q) ||
      (o.ownerName ?? "").toLowerCase().includes(q) ||
      o.email.toLowerCase().includes(q) ||
      o.phone.toLowerCase().includes(q)
    );
  });

  function handleEdit(owner: OwnerRow) {
    setEditOwner(owner);
    setModalOpen(true);
  }

  function handleAdd() {
    setEditOwner(null);
    setModalOpen(true);
  }

  function handleDelete(id: string) {
    if (confirm("Delete this owner?")) deleteMutation.mutate(id);
  }

  const COLS = 6;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Owners</h1>
          <p className="text-sm text-gray-500 mt-0.5">{owners.length} total</p>
        </div>
        <Button onClick={handleAdd} className="bg-black text-white hover:bg-gray-800">
          + Add Owner
        </Button>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by company, owner name, email, or phone…"
      />

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Company Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Owner Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Phone Number</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Units</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-50">
                <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-44" /></td>
                <td className="px-4 py-3"><Skeleton className="h-5 w-8 rounded-full" /></td>
                <td className="px-4 py-3" />
              </tr>
            ))}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={COLS} className="px-4 py-14 text-center">
                  <Building2 size={28} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-sm text-gray-400">No owners found</p>
                </td>
              </tr>
            )}
            {filtered.map((owner, i) => (
              <tr
                key={owner.id}
                className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i === filtered.length - 1 ? "border-0" : ""}`}
              >
                <td className="px-4 py-3 font-medium text-gray-900">{owner.name}</td>
                <td className="px-4 py-3 text-gray-600">
                  {owner.ownerName ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-600">{owner.phone}</td>
                <td className="px-4 py-3 text-gray-600">{owner.email}</td>
                <td className="px-4 py-3 text-gray-600">
                  {owner.unitCount ? (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {owner.unitCount}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleEdit(owner)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(owner.id)}
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

      <OwnerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["owners"] })}
        owner={editOwner}
      />
    </div>
  );
}
