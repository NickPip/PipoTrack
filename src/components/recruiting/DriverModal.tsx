"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/FormField";
import { FileInput } from "@/components/shared/FileInput";
import { uploadFile } from "@/lib/upload-client";

// ─── Constants ────────────────────────────────────────────────────────────────

const CITIZENSHIP_TYPES = ["Citizen", "Resident", "Green Card", "Paper Process"] as const;

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, "Required"),
  phone: z.string().min(1, "Required"),
  address: z.string().min(1, "Required"),
  dlNumber: z.string().min(1, "Required"),
  citizenshipType: z.enum(CITIZENSHIP_TYPES, { error: "Required" }),
  cleanBackground: z.boolean({ error: "Please select Yes or No" }),
  emergencyContact: z.string().min(1, "Required"),
  appUsername: z.string().optional(),
  appPassword: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DriverRow {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  dlNumber?: string | null;
  dlDocumentUrl?: string | null;
  citizenshipType?: string | null;
  cleanBackground?: boolean | null;
  emergencyContact?: string | null;
  drivingRecordUrl?: string | null;
  twicTsaUrl?: string | null;
  appUsername?: string | null;
  appPassword?: string | null;
  vehicleType?: string | null;
  currentZip?: string | null;
  searchRadius?: number | null;
  telegramId?: string | null;
  unitId?: string | null;
  unit?: { id: string; unitNumber: string } | null;
}

interface DriverModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  driver?: DriverRow | null;
}

// ─── Section divider ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100 pt-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">{title}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function DriverModal({ open, onClose, onSaved, driver }: DriverModalProps) {
  const isEdit = !!driver;
  const [apiError, setApiError] = useState<string | null>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const [dlFiles, setDlFiles] = useState<File[]>([]);
  const [drFiles, setDrFiles] = useState<File[]>([]);
  const [twicFiles, setTwicFiles] = useState<File[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (open) {
      setApiError(null);
      setUploadWarning(null);
      setDlFiles([]);
      setDrFiles([]);
      setTwicFiles([]);
      reset({
        name: driver?.name ?? "",
        phone: driver?.phone ?? "",
        address: driver?.address ?? "",
        dlNumber: driver?.dlNumber ?? "",
        citizenshipType: (driver?.citizenshipType as FormData["citizenshipType"]) ?? undefined,
        cleanBackground: driver?.cleanBackground ?? undefined,
        emergencyContact: driver?.emergencyContact ?? "",
        appUsername: driver?.appUsername ?? "",
        appPassword: driver?.appPassword ?? "",
      });
    }
  }, [open, driver, reset]);

  function handleClose() {
    const hasFiles = dlFiles.length > 0 || drFiles.length > 0 || twicFiles.length > 0;
    if ((isDirty || hasFiles) && !window.confirm("You have unsaved changes. Discard them?")) return;
    onClose();
  }

  async function onSubmit(data: FormData) {
    setApiError(null);
    const skipped: string[] = [];

    let dlDocumentUrl = driver?.dlDocumentUrl ?? null;
    let drivingRecordUrl = driver?.drivingRecordUrl ?? null;
    let twicTsaUrl = driver?.twicTsaUrl ?? null;

    if (dlFiles.length) {
      try { dlDocumentUrl = await uploadFile(dlFiles[0], "piptrack_files"); }
      catch { skipped.push("D/L document"); }
    }
    if (drFiles.length) {
      try { drivingRecordUrl = await uploadFile(drFiles[0], "piptrack_files"); }
      catch { skipped.push("driving record"); }
    }
    if (twicFiles.length) {
      try { twicTsaUrl = await uploadFile(twicFiles[0], "piptrack_files"); }
      catch { skipped.push("TWIC/TSA"); }
    }

    if (skipped.length) {
      setUploadWarning(`File upload failed for: ${skipped.join(", ")}. Driver saved without those files.`);
    }

    const body = {
      ...data,
      dlDocumentUrl,
      drivingRecordUrl,
      twicTsaUrl,
      appUsername: data.appUsername || null,
      appPassword: data.appPassword || null,
    };

    const res = await fetch(isEdit ? `/api/drivers/${driver!.id}` : "/api/drivers", {
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

  const citizenshipValue = watch("citizenshipType");
  const cleanBgValue = watch("cleanBackground");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Driver" : "Add Driver"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-2">

          {/* ── Personal Info ── */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Full Name" error={errors.name?.message} required>
                <Input {...register("name")} placeholder="John Doe" autoFocus />
              </FormField>
              <FormField label="Phone Number" error={errors.phone?.message} required>
                <Input {...register("phone")} placeholder="+1 555 0000" />
              </FormField>
            </div>

            <FormField label="Address" error={errors.address?.message} required>
              <Textarea {...register("address")} placeholder="123 Main St, City, State 00000" rows={2} />
            </FormField>

            <FormField label="Emergency Contact" error={errors.emergencyContact?.message} required>
              <Input {...register("emergencyContact")} placeholder="Jane Doe +1 555 9999" />
            </FormField>
          </div>

          {/* ── Documents ── */}
          <Section title="Documents">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="D/L Number" error={errors.dlNumber?.message} required>
                <Input {...register("dlNumber")} placeholder="DL-12345678" />
              </FormField>
              <FileInput
                label="D/L Document"
                accept=".pdf,.jpg,.jpeg,.png"
                files={dlFiles}
                existingUrls={driver?.dlDocumentUrl ? [driver.dlDocumentUrl] : []}
                onChange={setDlFiles}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium leading-none">
                Citizenship Type <span className="text-red-500"> *</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {CITIZENSHIP_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setValue("citizenshipType", t, { shouldDirty: true })}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      citizenshipValue === t
                        ? "bg-black text-white border-black"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {errors.citizenshipType && (
                <p className="text-xs text-red-500">{errors.citizenshipType.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium leading-none">
                Clean Background <span className="text-red-500"> *</span>
              </p>
              <div className="flex gap-2">
                {([true, false] as const).map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => setValue("cleanBackground", v, { shouldDirty: true })}
                    className={`px-5 py-1.5 rounded-full text-sm border transition-colors ${
                      cleanBgValue === v
                        ? "bg-black text-white border-black"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {v ? "Yes" : "No"}
                  </button>
                ))}
              </div>
              {errors.cleanBackground && (
                <p className="text-xs text-red-500">{errors.cleanBackground.message}</p>
              )}
            </div>
          </Section>

          {/* ── Optional Documents ── */}
          <Section title="Optional Documents">
            <div className="grid grid-cols-2 gap-4">
              <FileInput
                label="Driving Record"
                accept=".pdf,.jpg,.jpeg,.png"
                files={drFiles}
                existingUrls={driver?.drivingRecordUrl ? [driver.drivingRecordUrl] : []}
                onChange={setDrFiles}
              />
              <FileInput
                label="TWIC / TSA"
                accept=".pdf,.jpg,.jpeg,.png"
                files={twicFiles}
                existingUrls={driver?.twicTsaUrl ? [driver.twicTsaUrl] : []}
                onChange={setTwicFiles}
              />
            </div>
          </Section>

          {/* ── App Credentials ── */}
          <Section title="App Credentials (Optional)">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Application Username">
                <Input {...register("appUsername")} placeholder="username" />
              </FormField>
              <FormField label="Application Password">
                <Input {...register("appPassword")} type="password" placeholder="••••••••" />
              </FormField>
            </div>
          </Section>

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
            <Button type="button" variant="outline" onClick={handleClose}>
              {uploadWarning ? "Close" : "Cancel"}
            </Button>
            <Button type="submit" className="bg-black text-white hover:bg-gray-800" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Add Driver"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
