"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  name: z.string().min(1, "Required"),
  vehicleType: z.enum(["Sprinter", "Cargo Van", "Small Straight", "Large Straight"]),
  currentZip: z.string().min(1, "Required"),
  searchRadius: z.number().int().positive("Must be positive"),
  telegramId: z.string().nullable().optional(),
  unitId: z.string().nullable().optional(),
});

type FormData = z.infer<typeof schema>;

export interface DriverRow {
  id: string;
  name: string;
  vehicleType: string;
  currentZip: string;
  searchRadius: number;
  telegramId?: string | null;
  unitId?: string | null;
  unit?: { id: string; unitNumber: string } | null;
}

interface UnitOption {
  id: string;
  unitNumber: string;
}

interface DriverModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  driver?: DriverRow | null;
}

const VEHICLE_TYPES = ["Sprinter", "Cargo Van", "Small Straight", "Large Straight"] as const;

async function fetchUnits(): Promise<UnitOption[]> {
  const res = await fetch("/api/units");
  if (!res.ok) return [];
  const data = await res.json();
  return data.map((u: { id: string; unitNumber: string }) => ({ id: u.id, unitNumber: u.unitNumber }));
}

export default function DriverModal({ open, onClose, onSaved, driver }: DriverModalProps) {
  const isEdit = !!driver;

  const { data: units = [] } = useQuery({
    queryKey: ["units"],
    queryFn: fetchUnits,
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { vehicleType: "Sprinter" },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: driver?.name ?? "",
        vehicleType: (driver?.vehicleType as FormData["vehicleType"]) ?? "Sprinter",
        currentZip: driver?.currentZip ?? "",
        searchRadius: driver?.searchRadius ?? (0 as never),
        telegramId: driver?.telegramId ?? "",
        unitId: driver?.unitId ?? null,
      });
    }
  }, [open, driver, reset]);

  async function onSubmit(data: FormData) {
    const body = {
      ...data,
      telegramId: data.telegramId || null,
      unitId: data.unitId || null,
    };

    const res = await fetch(isEdit ? `/api/drivers/${driver!.id}` : "/api/drivers", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      onSaved();
      onClose();
    }
  }

  const vehicleTypeValue = watch("vehicleType");
  const unitIdValue = watch("unitId");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Driver" : "Add Driver"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input {...register("name")} placeholder="John Doe" />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Vehicle Type</Label>
            <Select value={vehicleTypeValue} onValueChange={(v) => setValue("vehicleType", v as FormData["vehicleType"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VEHICLE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Current ZIP</Label>
              <Input {...register("currentZip")} placeholder="10001" />
              {errors.currentZip && <p className="text-xs text-red-500">{errors.currentZip.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Search Radius (mi)</Label>
              <Input {...register("searchRadius", { valueAsNumber: true })} type="number" placeholder="100" />
              {errors.searchRadius && <p className="text-xs text-red-500">{errors.searchRadius.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Telegram ID (optional)</Label>
            <Input {...register("telegramId")} placeholder="@username or numeric ID" />
          </div>

          <div className="space-y-1.5">
            <Label>Assigned Unit (optional)</Label>
            <Select
              value={unitIdValue ?? "none"}
              onValueChange={(v) => setValue("unitId", v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="No unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No unit</SelectItem>
                {units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.unitNumber}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="bg-black text-white hover:bg-gray-800" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Add Driver"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
