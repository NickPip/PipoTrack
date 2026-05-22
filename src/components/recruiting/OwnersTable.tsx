"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
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

  const filtered = owners.filter((o) =>
    `${o.name} ${o.email} ${o.phone}`.toLowerCase().includes(search.toLowerCase())
  );

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
        searchPlaceholder="Search by name, email, or phone…"
      />

      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Phone</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">Loading…</td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">No owners found</td>
              </tr>
            )}
            {filtered.map((owner, i) => (
              <tr
                key={owner.id}
                className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i === filtered.length - 1 ? "border-0" : ""}`}
              >
                <td className="px-4 py-3 font-medium text-gray-900">{owner.name}</td>
                <td className="px-4 py-3 text-gray-600">{owner.email}</td>
                <td className="px-4 py-3 text-gray-600">{owner.phone}</td>
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
