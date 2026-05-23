"use client";

import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
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

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "CANCELED", label: "Canceled" },
  { value: "DISPATCHED_TO_PICKUP", label: "Dispatched to Pickup" },
  { value: "ONSITE_FOR_PICKUP", label: "OnSite for Pickup" },
  { value: "LOADED_AND_DELIVERING", label: "Loaded and Delivering" },
  { value: "ONSITE_FOR_DELIVERY", label: "OnSite for Delivery" },
  { value: "DELIVERED", label: "Delivered" },
] as const;

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  brokerReference: z.string().optional(),
  broker: z.string().min(1, "Required"),
  dispatcherId: z.string().min(1, "Required"),
  trackingId: z.string().min(1, "Required"),
  status: z.string().min(1, "Required"),
  driverRate: z.number().min(0),
  rate: z.number().min(0),
  pickupAddress: z.string().min(1, "Required"),
  pickupDate: z.string().min(1, "Required"),
  pickupNotes: z.string().optional(),
  deliveryAddress: z.string().min(1, "Required"),
  deliveryDate: z.string().min(1, "Required"),
  deliveryNotes: z.string().optional(),
  unitId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LoadRow {
  id: string;
  loadNumber: number;
  status: string;
  financialStatus: string;
  factoringStatus?: string | null;
  broker: string;
  brokerReference?: string | null;
  pickupAddress: string;
  pickupDate: string;
  pickupNotes?: string | null;
  deliveryAddress: string;
  deliveryDate: string;
  deliveryNotes?: string | null;
  rate?: number | null;
  driverRate?: number | null;
  dispatcherId?: string | null;
  dispatcherName?: string | null;
  trackingId?: string | null;
  trackingName?: string | null;
  unitId?: string | null;
  unitNumber?: string | null;
  rcUrl?: string | null;
  bolUrls?: string[] | null;
  podUrl?: string | null;
  createdAt: string;
}

interface UserOption { id: string; name: string; surname: string; role: string }
interface UnitOption { id: string; unitNumber: string }

interface AddLoadModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  load?: LoadRow | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchUsers(): Promise<UserOption[]> {
  const res = await fetch("/api/users");
  return res.ok ? res.json() : [];
}

async function fetchUnits(): Promise<UnitOption[]> {
  const res = await fetch("/api/units");
  if (!res.ok) return [];
  const data = await res.json();
  return data.map((u: UnitOption) => ({ id: u.id, unitNumber: u.unitNumber }));
}

// Formats a Date to "MM/DD HH:mm" for display
function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${min}`;
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function AddLoadModal({ open, onClose, onSaved, load }: AddLoadModalProps) {
  const isEdit = !!load;

  const [rcFiles, setRcFiles] = useState<File[]>([]);
  const [bolFiles, setBolFiles] = useState<File[]>([]);
  const [podFiles, setPodFiles] = useState<File[]>([]);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: fetchUsers, enabled: open });
  const { data: units = [] } = useQuery({ queryKey: ["units"], queryFn: fetchUnits, enabled: open });

  const dispatchers = users.filter((u) => u.role === "DISPATCHER" || u.role === "ADMIN");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: "PENDING",
      driverRate: 0,
      rate: 0,
      brokerReference: "",
      unitId: "",
    },
  });

  useEffect(() => {
    if (open) {
      setApiError(null);
      setUploadWarning(null);
      reset({
        brokerReference: load?.brokerReference ?? "",
        broker: load?.broker ?? "",
        dispatcherId: load?.dispatcherId ?? "",
        trackingId: load?.trackingId ?? "",
        status: load?.status ?? "PENDING",
        driverRate: load?.driverRate ?? 0,
        rate: load?.rate ?? 0,
        pickupAddress: load?.pickupAddress ?? "",
        pickupDate: load?.pickupDate ? formatDateTime(load.pickupDate) : "",
        pickupNotes: load?.pickupNotes ?? "",
        deliveryAddress: load?.deliveryAddress ?? "",
        deliveryDate: load?.deliveryDate ? formatDateTime(load.deliveryDate) : "",
        deliveryNotes: load?.deliveryNotes ?? "",
        unitId: load?.unitId ?? "",
      });
      setRcFiles([]);
      setBolFiles([]);
      setPodFiles([]);
    }
  }, [open, load, reset]);

  function handleClose() {
    const hasFileChanges = rcFiles.length > 0 || bolFiles.length > 0 || podFiles.length > 0;
    if ((isDirty || hasFileChanges) && !window.confirm("You have unsaved changes. Discard them?")) return;
    setUploadWarning(null);
    onClose();
  }

  async function onSubmit(data: FormData) {
    setApiError(null);
    let rcUrl = load?.rcUrl ?? null;
    let bolUrls: string[] = (load?.bolUrls as string[]) ?? [];
    let podUrl = load?.podUrl ?? null;
    const skipped: string[] = [];

    if (rcFiles.length) {
      try { rcUrl = await uploadFile(rcFiles[0], "piptrack_files"); }
      catch { skipped.push("Rate Confirmation"); }
    }
    if (bolFiles.length) {
      try {
        const uploaded = await Promise.all(bolFiles.map((f) => uploadFile(f, "piptrack_files")));
        bolUrls = isEdit ? [...bolUrls, ...uploaded] : uploaded;
      } catch { skipped.push("BOL / Freight Pictures"); }
    }
    if (podFiles.length) {
      try { podUrl = await uploadFile(podFiles[0], "piptrack_files"); }
      catch { skipped.push("Signed POD"); }
    }
    if (skipped.length) {
      setUploadWarning(`File upload failed for: ${skipped.join(", ")}. Load saved without those files.`);
    }

    const body = {
      broker: data.broker,
      brokerReference: data.brokerReference || undefined,
      dispatcherId: data.dispatcherId,
      trackingId: data.trackingId,
      status: data.status,
      driverRate: data.driverRate,
      rate: data.rate,
      pickupAddress: data.pickupAddress,
      pickupDate: data.pickupDate,
      pickupNotes: data.pickupNotes || undefined,
      deliveryAddress: data.deliveryAddress,
      deliveryDate: data.deliveryDate,
      deliveryNotes: data.deliveryNotes || undefined,
      unitId: data.unitId || null,
      rcUrl,
      bolUrls,
      podUrl,
    };

    const res = await fetch(isEdit ? `/api/loads/${load!.id}` : "/api/loads", {
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

  const statusValue = watch("status");
  const dispatcherValue = watch("dispatcherId");
  const trackingValue = watch("trackingId");
  const unitValue = watch("unitId");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit Load #${load!.loadNumber}` : "Add New Load"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-2">

          {/* ── Section 1: Load Information ─────────────────── */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Load Information</h3>

            {/* Load Number (read-only on edit) + Broker Reference */}
            <div className="grid grid-cols-2 gap-4">
              {isEdit && (
                <FormField label="Load Number">
                  <Input value={load!.loadNumber} readOnly className="bg-gray-50 text-gray-500" />
                </FormField>
              )}
              <FormField label="Broker Reference" className={isEdit ? "" : "col-span-1"}>
                <Input {...register("brokerReference")} placeholder="N/A" />
              </FormField>
              {!isEdit && <div />}
            </div>

            {/* Broker */}
            <FormField label="Broker" error={errors.broker?.message} required>
              <Input {...register("broker")} placeholder="e.g., XPO Logistics" autoFocus={!isEdit} />
            </FormField>

            {/* Dispatcher + Tracking ID */}
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Dispatcher" error={errors.dispatcherId?.message} required>
                <Select value={dispatcherValue} onValueChange={(v) => setValue("dispatcherId", v, { shouldDirty: true })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select dispatcher" />
                  </SelectTrigger>
                  <SelectContent>
                    {dispatchers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name} {u.surname}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Tracking ID" error={errors.trackingId?.message} required>
                <Select value={trackingValue} onValueChange={(v) => setValue("trackingId", v, { shouldDirty: true })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tracking user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name} {u.surname}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            {/* Status + Driver Rate + Total Rate */}
            <div className="grid grid-cols-3 gap-4">
              <FormField label="Status" error={errors.status?.message} required>
                <Select value={statusValue} onValueChange={(v) => setValue("status", v, { shouldDirty: true })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Driver Rate ($)" error={errors.driverRate?.message}>
                <Input
                  {...register("driverRate", { valueAsNumber: true })}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                />
              </FormField>

              <FormField label="Total Rate ($)" error={errors.rate?.message}>
                <Input
                  {...register("rate", { valueAsNumber: true })}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                />
              </FormField>
            </div>
          </div>

          {/* ── Section 2: Pickup Details ────────────────────── */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pickup Details</h3>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Pickup Address" error={errors.pickupAddress?.message} required>
                <Input {...register("pickupAddress")} placeholder="e.g., MS 38706" />
              </FormField>
              <FormField label="Pickup Time" error={errors.pickupDate?.message} required>
                <Input {...register("pickupDate")} placeholder="e.g., 11/03 18:30" />
              </FormField>
            </div>

            <FormField label="Pickup Notes">
              <Textarea {...register("pickupNotes")} placeholder="Additional pickup instructions..." />
            </FormField>
          </div>

          {/* ── Section 3: Delivery Details ──────────────────── */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Delivery Details</h3>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Delivery Address" error={errors.deliveryAddress?.message} required>
                <Input {...register("deliveryAddress")} placeholder="e.g., MI 48235" />
              </FormField>
              <FormField label="Delivery Time" error={errors.deliveryDate?.message} required>
                <Input {...register("deliveryDate")} placeholder="e.g., 11/04 08:30" />
              </FormField>
            </div>

            <FormField label="Delivery Notes">
              <Textarea {...register("deliveryNotes")} placeholder="Additional delivery instructions..." />
            </FormField>
          </div>

          {/* ── Section 4: Unit Assignment ───────────────────── */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Unit Assignment</h3>
            <FormField label="Assigned Unit">
              <Select
                value={unitValue ?? "none"}
                onValueChange={(v) => setValue("unitId", v === "none" ? "" : v, { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Not assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not assigned</SelectItem>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.unitNumber}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          {/* ── Section 5: Document Uploads ──────────────────── */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Document Uploads</h3>
            <div className="space-y-4">
              <FileInput
                label="Rate Confirmation"
                accept=".pdf,.png"
                files={rcFiles}
                existingUrls={load?.rcUrl ? [load.rcUrl] : []}
                onChange={setRcFiles}
              />
              <FileInput
                label="BOL + Loaded Freight Pictures"
                multiple
                files={bolFiles}
                existingUrls={(load?.bolUrls as string[]) ?? []}
                onChange={setBolFiles}
              />
              <FileInput
                label="Signed POD"
                accept=".pdf,.png,.jpg,.jpeg"
                files={podFiles}
                existingUrls={load?.podUrl ? [load.podUrl] : []}
                onChange={setPodFiles}
              />
            </div>
          </div>

          {/* ── Feedback ─────────────────────────────────────── */}
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

          {/* ── Actions ──────────────────────────────────────── */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setUploadWarning(null); handleClose(); }}
            >
              {uploadWarning ? "Close" : "Cancel"}
            </Button>
            <Button
              type="submit"
              className="bg-black text-white hover:bg-gray-800"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Add Load"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
