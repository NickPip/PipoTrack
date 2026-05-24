"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageTable, { TD, TD_MONO, Dim, RowActions, Pill, PrimaryBtn, FIRST_TD, LAST_TD } from "@/components/shared/PageTable";
import StatusBadge from "@/components/shared/StatusBadge";
import UserModal, { type UserRow } from "@/components/users/UserModal";

const ROLE_OPTIONS = [
  { value: "ADMIN",       label: "Admin" },
  { value: "RECRUITING",  label: "Recruiting" },
  { value: "DISPATCHER",  label: "Dispatcher" },
  { value: "OPERATIONS",  label: "Operations" },
  { value: "ACCOUNTING",  label: "Accounting" },
];

async function fetchUsers(): Promise<UserRow[]> {
  const res = await fetch("/api/users");
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

export default function UsersTable() {
  const qc = useQueryClient();
  const { data: users = [], isLoading } = useQuery({ queryKey: ["users"], queryFn: fetchUsers });

  const [search,     setSearch]     = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editUser,   setEditUser]   = useState<UserRow | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const filtered = users.filter(u => {
    const matchSearch = `${u.name} ${u.surname} ${u.email}`.toLowerCase().includes(search.toLowerCase());
    const matchRole   = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <>
      <PageTable
        breadcrumb="Users"
        title="Users"
        subtitle="Manage platform accounts and role assignments."
        count={users.length}
        isLoading={isLoading}
        actions={
          <PrimaryBtn onClick={() => { setEditUser(null); setModalOpen(true); }}>
            Add User
          </PrimaryBtn>
        }
        search={search}
        onSearchChange={setSearch}
        filterChips={[{ label: "Role", value: roleFilter, options: ROLE_OPTIONS, onChange: setRoleFilter }]}
        columns={[
          { label: "Name",              width: 220 },
          { label: "ID Number"                     },
          { label: "Role"                          },
          { label: "Phone"                         },
          { label: "Address"                       },
          { label: "Emergency Contact"             },
          { label: "",       width: 48             },
        ]}
        rows={filtered}
        rowKey={u => u.id}
        emptyMessage="No users found"
        emptyBody="Add a user to get started."
        renderCells={(user, isLast) => {
          const nb = isLast ? "none" : undefined;
          return (
            <>
              <td style={{ ...TD, ...FIRST_TD, borderBottom: nb }}>
                <p style={{ margin: 0, fontWeight: 500 }}>{user.name} {user.surname}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--ink-3)" }}>{user.email}</p>
              </td>
              <td style={{ ...TD_MONO, borderBottom: nb }}>{user.idNumber}</td>
              <td style={{ ...TD, borderBottom: nb }}>
                <StatusBadge value={user.role} />
              </td>
              <td style={{ ...TD, borderBottom: nb, whiteSpace: "nowrap" }}>{user.phoneNumber}</td>
              <td style={{ ...TD, borderBottom: nb, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.address ?? <Dim />}
              </td>
              <td style={{ ...TD, borderBottom: nb }}>{user.emergencyContact ?? <Dim />}</td>
              <td style={{ ...TD, ...LAST_TD, borderBottom: nb, textAlign: "right" }}>
                <RowActions
                  label={`${user.name} ${user.surname}`}
                  onEdit={() => { setEditUser(user); setModalOpen(true); }}
                  onDelete={() => deleteMutation.mutate(user.id)}
                />
              </td>
            </>
          );
        }}
      />

      <UserModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["users"] })}
        user={editUser}
      />
    </>
  );
}
