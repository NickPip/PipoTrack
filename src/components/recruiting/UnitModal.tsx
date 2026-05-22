"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Info, X, ChevronDown } from "lucide-react";
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

async function uploadFile(file: File, bucket: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("bucket", bucket);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.url as string;
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
          {selectedNames.length
            ? selectedNames.join(", ")
            : "Select drivers…"}
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

// ─── File input ───────────────────────────────────────────────────────────────

function FileInput({
  label,
  multiple,
  accept,
  files,
  existingUrls,
  onChange,
  tooltip,
}: {
  label: string;
  multiple?: boolean;
  accept?: string;
  files: File[];
  existingUrls?: string[];
  onChange: (files: File[]) => void;
  tooltip?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    onChange(multiple ? [...files, ...selected] : selected);
    e.target.value = "";
  }

  function removeFile(i: number) {
    onChange(files.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label>{label}</Label>
        {tooltip && (
          <div className="group relative">
            <Info size={13} className="text-gray-400 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-56 bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 z-50 text-center leading-snug">
              {tooltip}
            </div>
          </div>
        )}
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-200 rounded-xl p-4 cursor-pointer hover:border-gray-400 transition-colors text-center"
      >
        <p className="text-sm text-gray-500">
          Click to {multiple ? "add files" : "upload"}{" "}
          <span className="text-black font-medium">Browse</span>
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={accept}
          className="hidden"
          onChange={handleChange}
        />
      </div>

      {(existingUrls?.length ?? 0) > 0 && files.length === 0 && (
        <div className="space-y-1">
          {existingUrls!.map((url, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
              <span className="truncate">{url.split("/").pop()}</span>
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 shrink-0">view</a>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-1.5">
              <span className="truncate">{f.name}</span>
              <button type="button" onClick={() => removeFile(i)} className="ml-2 text-gray-400 hover:text-red-500 shrink-0">
                <X size={12} />
              </button>
            </div>
          ))}
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

  const { data: owners = [] } = useQuery({ queryKey: ["owners"], queryFn: fetchOwners, enabled: open });
  const { data: drivers = [] } = useQuery({ queryKey: ["drivers"], queryFn: fetchDrivers, enabled: open });

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: "Sprinter Van", equipment: [], driverIds: [] },
  });

  useEffect(() => {
    if (open) {
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
      setUploadWarning(null);
    }
  }, [open, unit, reset]);

  async function onSubmit(data: FormData) {
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

    if (res.ok) {
      onSaved();
      if (skipped.length === 0) {
        onClose();
      }
    }
  }

  const typeValue = watch("type");
  const ownerIdValue = watch("ownerId");
  const equipmentValue = watch("equipment") ?? [];
  const driverIdsValue = watch("driverIds") ?? [];

  function toggleEquipment(item: (typeof EQUIPMENT_OPTIONS)[number]) {
    const current = equipmentValue as string[];
    setValue(
      "equipment",
      current.includes(item) ? (current.filter((e) => e !== item) as typeof equipmentValue) : ([...current, item] as typeof equipmentValue)
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Unit" : "Add Unit"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-2">

          {/* Row 1: Unit Number + Owner */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Unit Number *</Label>
              <Input {...register("unitNumber")} placeholder="U-001" />
              {errors.unitNumber && <p className="text-xs text-red-500">{errors.unitNumber.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Assign to Owner *</Label>
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
              {errors.ownerId && <p className="text-xs text-red-500">{errors.ownerId.message}</p>}
            </div>
          </div>

          {/* Vehicle Type — radio buttons */}
          <div className="space-y-2">
            <Label>Vehicle Type *</Label>
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
            <div className="space-y-1.5">
              <Label>Make *</Label>
              <Input {...register("make")} placeholder="Mercedes-Benz" />
              {errors.make && <p className="text-xs text-red-500">{errors.make.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Model *</Label>
              <Input {...register("model")} placeholder="Sprinter 2500" />
              {errors.model && <p className="text-xs text-red-500">{errors.model.message}</p>}
            </div>
          </div>

          {/* Year + VIN + Plate */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Year *</Label>
              <Input {...register("year")} placeholder="2022" />
              {errors.year && <p className="text-xs text-red-500">{errors.year.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>VIN *</Label>
              <Input {...register("vin")} placeholder="1FTFW1E5XNFC00000" />
              {errors.vin && <p className="text-xs text-red-500">{errors.vin.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Plate Number *</Label>
              <Input {...register("plateNumber")} placeholder="ABC-1234" />
              {errors.plateNumber && <p className="text-xs text-red-500">{errors.plateNumber.message}</p>}
            </div>
          </div>

          {/* Assign Drivers */}
          <div className="space-y-1.5">
            <Label>Assign Drivers</Label>
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
          </div>

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
                <div key={dim} className="space-y-1.5">
                  <Label className="text-xs text-gray-500 capitalize">{dim}</Label>
                  <Input
                    {...register(dim, { valueAsNumber: true })}
                    type="number"
                    step="0.1"
                    placeholder="0"
                  />
                  {errors[dim] && <p className="text-xs text-red-500">{errors[dim]?.message}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Payload */}
          <div className="space-y-1.5">
            <Label>Payload (lbs)</Label>
            <Input
              {...register("payload", { valueAsNumber: true })}
              type="number"
              step="1"
              placeholder="e.g. 3500"
              className="max-w-[180px]"
            />
            {errors.payload && <p className="text-xs text-red-500">{errors.payload.message}</p>}
          </div>

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

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => { setUploadWarning(null); onClose(); }}>
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
