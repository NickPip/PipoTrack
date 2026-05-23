"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageTable, { TD, Dim, KebabBtn, Pill, PrimaryBtn, FIRST_TD, LAST_TD } from "@/components/shared/PageTable";
import DriverModal, { type DriverRow } from "@/components/recruiting/DriverModal";

async function fetchDrivers(): Promise<DriverRow[]> {
  const res = await fetch("/api/drivers");
  if (!res.ok) throw new Error("Failed to fetch drivers");
  return res.json();
}

export default function DriversTable() {
  const qc = useQueryClient();
  const { data: drivers = [], isLoading } = useQuery({ queryKey: ["drivers"], queryFn: fetchDrivers });

  const [search,    setSearch]    = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editDriver,setEditDriver]= useState<DriverRow | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/drivers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drivers"] }),
  });

  const filtered = drivers.filter(d => {
    const q = search.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      (d.phone ?? "").toLowerCase().includes(q) ||
      (d.dlNumber ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <>
      <PageTable
        breadcrumb={["Recruiting", "Drivers"]}
        title="Drivers"
        subtitle="All drivers registered in the system."
        count={drivers.length}
        isLoading={isLoading}
        actions={
          <PrimaryBtn onClick={() => { setEditDriver(null); setModalOpen(true); }}>
            Add Driver
          </PrimaryBtn>
        }
        search={search}
        onSearchChange={setSearch}
        columns={[
          { label: "Full Name"                    },
          { label: "Phone"                        },
          { label: "Assigned Unit"                },
          { label: "DL Number"                    },
          { label: "Citizenship"                  },
          { label: "Clean Background", width: 140 },
          { label: "",                 width: 48  },
        ]}
        rows={filtered}
        rowKey={d => d.id}
        emptyMessage="No drivers found"
        emptyBody="Add a driver to get started."
        renderCells={(driver, isLast) => {
          const nb = isLast ? "none" : undefined;
          const bgVariant =
            driver.cleanBackground === true  ? "green" :
            driver.cleanBackground === false ? "red"   : undefined;
          const bgLabel =
            driver.cleanBackground === true  ? "Yes" :
            driver.cleanBackground === false ? "No"  : null;
          return (
            <>
              <td style={{ ...TD, ...FIRST_TD, fontWeight: 500, borderBottom: nb }}>{driver.name}</td>
              <td style={{ ...TD, borderBottom: nb, whiteSpace: "nowrap" }}>{driver.phone ?? <Dim />}</td>
              <td style={{ ...TD, borderBottom: nb }}>{driver.unit?.unitNumber ?? <Dim />}</td>
              <td style={{ ...TD, borderBottom: nb }}>{driver.dlNumber ?? <Dim />}</td>
              <td style={{ ...TD, borderBottom: nb }}>{driver.citizenshipType ?? <Dim />}</td>
              <td style={{ ...TD, borderBottom: nb }}>
                {bgLabel ? <Pill label={bgLabel} variant={bgVariant} /> : <Dim />}
              </td>
              <td style={{ ...TD, ...LAST_TD, borderBottom: nb, textAlign: "right" }}>
                <KebabBtn onClick={() => { setEditDriver(driver); setModalOpen(true); }} />
              </td>
            </>
          );
        }}
      />

      <DriverModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["drivers"] })}
        driver={editDriver}
      />
    </>
  );
}
