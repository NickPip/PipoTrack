"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageTable, { TD, Dim, RowActions, Pill, PrimaryBtn, FIRST_TD, LAST_TD } from "@/components/shared/PageTable";
import OwnerModal, { type OwnerRow } from "@/components/recruiting/OwnerModal";

async function fetchOwners(): Promise<OwnerRow[]> {
  const res = await fetch("/api/owners");
  if (!res.ok) throw new Error("Failed to fetch owners");
  return res.json();
}

export default function OwnersTable() {
  const qc = useQueryClient();
  const { data: owners = [], isLoading } = useQuery({ queryKey: ["owners"], queryFn: fetchOwners });

  const [search,    setSearch]    = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editOwner, setEditOwner] = useState<OwnerRow | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/owners/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["owners"] }),
  });

  const filtered = owners.filter(o => {
    const q = search.toLowerCase();
    return (
      o.name.toLowerCase().includes(q) ||
      (o.ownerName ?? "").toLowerCase().includes(q) ||
      o.email.toLowerCase().includes(q) ||
      o.phone.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <PageTable
        breadcrumb={["Recruiting", "Owners"]}
        title="Owners"
        subtitle="Companies and individuals that own fleet units."
        count={owners.length}
        isLoading={isLoading}
        actions={
          <PrimaryBtn onClick={() => { setEditOwner(null); setModalOpen(true); }}>
            Add Owner
          </PrimaryBtn>
        }
        search={search}
        onSearchChange={setSearch}
        columns={[
          { label: "Company Name"              },
          { label: "Owner Name"                },
          { label: "Phone"                     },
          { label: "Email"                     },
          { label: "Units",     width: 80      },
          { label: "",          width: 48      },
        ]}
        rows={filtered}
        rowKey={o => o.id}
        emptyMessage="No owners found"
        emptyBody="Add an owner to get started."
        renderCells={(owner, isLast) => {
          const nb = isLast ? "none" : undefined;
          return (
            <>
              <td style={{ ...TD, ...FIRST_TD, fontWeight: 500, borderBottom: nb }}>{owner.name}</td>
              <td style={{ ...TD, borderBottom: nb }}>{owner.ownerName ?? <Dim />}</td>
              <td style={{ ...TD, borderBottom: nb, whiteSpace: "nowrap" }}>{owner.phone}</td>
              <td style={{ ...TD, borderBottom: nb }}>{owner.email}</td>
              <td style={{ ...TD, borderBottom: nb }}>
                {owner.unitCount
                  ? <Pill label={String(owner.unitCount)} variant="gray" />
                  : <Dim />}
              </td>
              <td style={{ ...TD, ...LAST_TD, borderBottom: nb, textAlign: "right" }}>
                <RowActions
                  label={owner.name}
                  onEdit={() => { setEditOwner(owner); setModalOpen(true); }}
                  onDelete={() => deleteMutation.mutate(owner.id)}
                />
              </td>
            </>
          );
        }}
      />

      <OwnerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["owners"] })}
        owner={editOwner}
      />
    </>
  );
}
