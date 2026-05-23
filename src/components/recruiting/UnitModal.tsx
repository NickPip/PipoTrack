"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField } from "@/components/shared/FormField";
import { FileInput } from "@/components/shared/FileInput";
import { uploadFile } from "@/lib/upload-client";

// ─── Constants ────────────────────────────────────────────────────────────────

const VEHICLE_TYPES = ["Sprinter Van", "Cargo Van", "Small Straight", "Large Straight"] as const;
const EQUIPMENT_OPTIONS = ["PPE", "E-TRACK", "DOLLY", "BLANKETS", "STRAPS"] as const;

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  unitNumber: z.string().min(1, "Required"),
  ownerId: z.string().min(1, "Required"),
  type: z.enum(VEHICLE_TYPES, { error: "Required" }),
  make: z.string().min(1, "Required"),
  model: z.string().min(1, "Required"),
  year: z.string().min(1, "Required"),
  vin: z.string().min(1, "Required"),
  plateNumber: z.string().min(1, "Required"),
  driverIds: z.array(z.string()).optional(),
  equipment: z.array(z.enum(EQUIPMENT_OPTIONS)).optional(),
  length: z.number().positive("Must be > 0").nullable().optional(),
  width: z.number().positive("Must be > 0").nullable().optional(),
  height: z.number().positive("Must be > 0").nullable().optional(),
  payload: z.number().positive("Must be > 0").nullable().optional(),
});

type FormData = z.infer<typeof schema>;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UnitRow {
  id: string;
  unitNumber: string;
  type: string;
  make?: string | null;
  model?: string | null;
  year?: string | null;
  vin?: string | null;
  plateNumber?: string | null;
  ownerId?: string | null;
  ownerName?: string | null;
  payload?: number | null;
  equipment?: string[] | null;
  dimensions?: { length: number; width: number; height: number } | null;
  registrationUrl?: string | null;
  pictureUrls?: string[] | null;
  drivers: { id: string; name: string }[];
  driverCount: number;
}

interface OwnerOption { id: string; name: string }
interface DriverOption { id: string; name: string; unitId: string | null }

interface UnitModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  unit?: UnitRow | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchOwners(): Promise<OwnerOption[]> {
  const res = await fetch("/api/owners");
  return res.ok ? res.json() : [];
}

async function fetchDrivers(): Promise<DriverOption[]> {
  const res = await fetch("/api/drivers");
  if (!res.ok) return [];
  const data = await res.json();
  return data.map((d: DriverOption) => ({ id: d.id, name: d.name, unitId: d.unitId }));
}

// ─── Multi-select drivers ─────────────────────────────────────────────────────

function DriversMultiSelect({
  drivers,
  selected,
  onChange,
  currentUnitId,
}: {
  drivers: DriverOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  currentUnitId?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const available = drivers.filter(
    (d) => !d.unitId || d.unitId === currentUnitId || selected.includes(d.id)
  );

  const selectedNames = drivers
    .filter((d) => selected.includes(d.id))
    .map((d) => d.name);

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg text-sm text-left bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
      >
        <span className={selectedNames.length ? "text-gray-900" : "text-gray-400"}>
          {selectedNames.length ? selectedNames.join(", ") : "Select drivers…"}
        </span>
        <ChevronDown size={14} className="text-gray-400 shrink-0 ml-2" />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-lg py-1 max-h-48 overflow-y-auto">
          {available.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400">No available drivers</p>
          ) : (
            available.map((d) => (
              <label
                key={d.id}
                className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer"
              >
                <Checkbox
                  checked={selected.includes(d.id)}
                  onCheckedChange={() => toggle(d.id)}
                />
                <span className="text-sm text-gray-700">{d.name}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function UnitModal({ open, onClose, onSaved, unit }: UnitModalProps) {
  const isEdit = !!unit;

  const [regFiles, setRegFiles] = useState<File[]>([]);
  const [picFiles, setPicFiles] = useState<File[]>([]);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: owners = [] } = useQuery({ queryKey: ["owners"], queryFn: fetchOwners, enabled: open });
  const { data: drivers = [] } = useQuery({ queryKey: ["drivers"], queryFn: fetchDrivers, enabled: open });

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: "Sprinter Van", equipment: [], driverIds: [] },
  });

  useEffect(() => {
    if (open) {
      setApiError(null);
      setUploadWarning(null);
      reset({
        unitNumber: unit?.unitNumber ?? "",
        ownerId: unit?.ownerId ?? "",
        type: (unit?.type as FormData["type"]) ?? "Sprinter Van",
        make: unit?.make ?? "",
        model: unit?.model ?? "",
        year: unit?.year ?? "",
        vin: unit?.vin ?? "",
        plateNumber: unit?.plateNumber ?? "",
        driverIds: unit?.drivers.map((d) => d.id) ?? [],
        equipment: (unit?.equipment as FormData["equipment"]) ?? [],
        length: unit?.dimensions?.length ?? null,
        width: unit?.dimensions?.width ?? null,
        height: unit?.dimensions?.height ?? null,
        payload: unit?.payload ?? null,
      });
      setRegFiles([]);
      setPicFiles([]);
    }
  }, [open, unit, reset]);

  function handleClose() {
    const hasFileChanges = regFiles.length > 0 || picFiles.length > 0;
    if ((isDirty || hasFileChanges) && !window.confirm("You have unsaved changes. Discard them?")) return;
    setUploadWarning(null);
    onClose();
  }

  async function onSubmit(data: FormData) {
    setApiError(null);
    let registrationUrl = unit?.registrationUrl ?? null;
    let pictureUrls: string[] = (unit?.pictureUrls as string[]) ?? [];
    const skipped: string[] = [];

    if (regFiles.length) {
      try {
        registrationUrl = await uploadFile(regFiles[0], "piptrack_files");
      } catch {
        skipped.push("vehicle registration");
      }
    }
    if (picFiles.length) {
      try {
        const uploaded = await Promise.all(picFiles.map((f) => uploadFile(f, "piptrack_files")));
        pictureUrls = isEdit ? [...pictureUrls, ...uploaded] : uploaded;
      } catch {
        skipped.push("vehicle pictures");
      }
    }
    if (skipped.length) {
      setUploadWarning(`File upload failed for: ${skipped.join(", ")}. Unit saved without those files. Check your Supabase Storage configuration.`);
    }

    const hasDimensions = data.length && data.width && data.height;

    const body = {
      unitNumber: data.unitNumber,
      type: data.type,
      make: data.make,
      model: data.model,
      year: data.year,
      vin: data.vin,
      plateNumber: data.plateNumber,
      ownerId: data.ownerId,
      driverIds: data.driverIds ?? [],
      equipment: data.equipment ?? [],
      dimensions: hasDimensions
        ? { length: data.length, width: data.width, height: data.height }
        : null,
      payload: data.payload ?? null,
      registrationUrl,
      pictureUrls,
    };

    const res = await fetch(isEdit ? `/api/units/${unit!.id}` : "/api/units", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setApiError(json.error ?? "Something went wrong. Please try again.");
      return;
    }

    onSaved();
    if (skipped.length === 0) onClose();
  }

  const typeValue = watch("type");
  const ownerIdValue = watch("ownerId");
  const equipmentValue = watch("equipment") ?? [];
  const driverIdsValue = watch("driverIds") ?? [];

  function toggleEquipment(item: (typeof EQUIPMENT_OPTIONS)[number]) {
    const current = equipmentValue as string[];
    setValue(
      "equipment",
      current.includes(item)
        ? (current.filter((e) => e !== item) as typeof equipmentValue)
        : ([...current, item] as typeof equipmentValue)
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Unit" : "Add Unit"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-2">

          {/* Row 1: Unit Number + Owner */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Unit Number" error={errors.unitNumber?.message} required>
              <Input {...register("unitNumber")} placeholder="U-001" autoFocus />
            </FormField>
            <FormField label="Assign to Owner" error={errors.ownerId?.message} required>
              <Select value={ownerIdValue} onValueChange={(v) => setValue("ownerId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select owner…" />
                </SelectTrigger>
                <SelectContent>
                  {owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          {/* Vehicle Type — pill buttons */}
          <div className="space-y-2">
            <Label>
              Vehicle Type <span className="text-red-500">*</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {VEHICLE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setValue("type", t)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    typeValue === t
                      ? "bg-black text-white border-black"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {errors.type && <p className="text-xs text-red-500">{errors.type.message}</p>}
          </div>

          {/* Make + Model */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Make" error={errors.make?.message} required>
              <Input {...register("make")} placeholder="Mercedes-Benz" />
            </FormField>
            <FormField label="Model" error={errors.model?.message} required>
              <Input {...register("model")} placeholder="Sprinter 2500" />
            </FormField>
          </div>

          {/* Year + VIN + Plate */}
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Year" error={errors.year?.message} required>
              <Input {...register("year")} placeholder="2022" />
            </FormField>
            <FormField label="VIN" error={errors.vin?.message} required>
              <Input {...register("vin")} placeholder="1FTFW1E5XNFC00000" />
            </FormField>
            <FormField label="Plate Number" error={errors.plateNumber?.message} required>
              <Input {...register("plateNumber")} placeholder="ABC-1234" />
            </FormField>
          </div>

          {/* Assign Drivers */}
          <FormField label="Assign Drivers">
            <Controller
              control={control}
              name="driverIds"
              render={({ field }) => (
                <DriversMultiSelect
                  drivers={drivers}
                  selected={field.value ?? []}
                  onChange={field.onChange}
                  currentUnitId={unit?.id}
                />
              )}
            />
          </FormField>

          {/* File uploads */}
          <div className="grid grid-cols-2 gap-4">
            <FileInput
              label="Vehicle Registration"
              accept=".pdf,.jpg,.jpeg,.png"
              files={regFiles}
              existingUrls={unit?.registrationUrl ? [unit.registrationUrl] : []}
              onChange={setRegFiles}
            />
            <FileInput
              label="Vehicle Pictures"
              multiple
              accept="image/*"
              files={picFiles}
              existingUrls={(unit?.pictureUrls as string[]) ?? []}
              onChange={setPicFiles}
              tooltip="Upload photos of the vehicle exterior and interior. Multiple files allowed."
            />
          </div>

          {/* Dimensions */}
          <div className="space-y-2">
            <Label>Dimensions (inches)</Label>
            <div className="grid grid-cols-3 gap-3">
              {(["length", "width", "height"] as const).map((dim) => (
                <FormField key={dim} label={dim.charAt(0).toUpperCase() + dim.slice(1)} error={errors[dim]?.message} className="space-y-1">
                  <Input
                    {...register(dim, { valueAsNumber: true })}
                    type="number"
                    step="0.1"
                    placeholder="0"
                  />
                </FormField>
              ))}
            </div>
          </div>

          {/* Payload */}
          <FormField label="Payload (lbs)" error={errors.payload?.message}>
            <Input
              {...register("payload", { valueAsNumber: true })}
              type="number"
              step="1"
              placeholder="e.g. 3500"
              className="max-w-[180px]"
            />
          </FormField>

          {/* Equipment checkboxes */}
          <div className="space-y-2">
            <Label>Equipment</Label>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {EQUIPMENT_OPTIONS.map((item) => (
                <label key={item} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={equipmentValue.includes(item)}
                    onCheckedChange={() => toggleEquipment(item)}
                  />
                  <span className="text-sm text-gray-700">{item}</span>
                </label>
              ))}
            </div>
          </div>

          {uploadWarning && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800">
              <strong>Warning:</strong> {uploadWarning}
            </div>
          )}

          {apiError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-xs text-red-700">
              {apiError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => { setUploadWarning(null); handleClose(); }}>
              {uploadWarning ? "Close" : "Cancel"}
            </Button>
            <Button
              type="submit"
              className="bg-black text-white hover:bg-gray-800"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Add Unit"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
