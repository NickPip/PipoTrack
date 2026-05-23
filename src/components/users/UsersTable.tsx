"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import FilterBar from "@/components/shared/FilterBar";
import StatusBadge from "@/components/shared/StatusBadge";
import UserModal, { type UserRow } from "@/components/users/UserModal";

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Admin" },
  { value: "RECRUITING", label: "Recruiting" },
  { value: "DISPATCHER", label: "Dispatcher" },
  { value: "OPERATIONS", label: "Operations" },
  { value: "ACCOUNTING", label: "Accounting" },
];

async function fetchUsers(): Promise<UserRow[]> {
  const res = await fetch("/api/users");
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

export default function UsersTable() {
  const qc = useQueryClient();
  const { data: users = [], isLoading } = useQuery({ queryKey: ["users"], queryFn: fetchUsers });

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const filtered = users.filter((u) => {
    const matchSearch =
      `${u.name} ${u.surname} ${u.email}`.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  function handleEdit(user: UserRow) {
    setEditUser(user);
    setModalOpen(true);
  }

  function handleAdd() {
    setEditUser(null);
    setModalOpen(true);
  }

  function handleDelete(id: string) {
    if (confirm("Delete this user?")) {
      deleteMutation.mutate(id);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} total</p>
        </div>
        <Button onClick={handleAdd} className="bg-black text-white hover:bg-gray-800">
          + Add User
        </Button>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filterValue={roleFilter}
        onFilterChange={setRoleFilter}
        filterOptions={ROLE_OPTIONS}
        filterPlaceholder="All Roles"
        searchPlaceholder="Search by name or email…"
      />

      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">ID Number</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">User Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Phone Number</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Address</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Emergency Contact</th>
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
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No users found</td>
              </tr>
            )}
            {filtered.map((user, i) => (
              <tr
                key={user.id}
                className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i === filtered.length - 1 ? "border-0" : ""}`}
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{user.name} {user.surname}</p>
                  <p className="text-xs text-gray-400">{user.email}</p>
                </td>
                <td className="px-4 py-3 text-gray-600">{user.idNumber}</td>
                <td className="px-4 py-3">
                  <StatusBadge value={user.role} />
                </td>
                <td className="px-4 py-3 text-gray-600">{user.phoneNumber}</td>
                <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">
                  {user.address ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {user.emergencyContact ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleEdit(user)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
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

      <UserModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["users"] })}
        user={editUser}
      />
    </div>
  );
}
