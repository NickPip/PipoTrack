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

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  // required
  name: z.string().min(1, "Required"),
  ownerName: z.string().min(1, "Required"),
  phone: z.string().min(1, "Required"),
  email: z.email("Invalid email"),
  address: z.string().min(1, "Required"),
  ssnFein: z.string().min(1, "Required"),
  // optional
  company: z.string().optional(),
  // urls are managed separately via file state, not in form values
});

type FormData = z.infer<typeof schema>;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OwnerRow {
  id: string;
  name: string;
  ownerName?: string | null;
  email: string;
  phone: string;
  address?: string | null;
  ssnFein?: string | null;
  ssnFeinDocUrl?: string | null;
  ownerDocUrl?: string | null;
  company?: string | null;
  bankInfoUrl?: string | null;
  w9Url?: string | null;
  insuranceUrl?: string | null;
  unitCount?: number;
}

interface OwnerModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  owner?: OwnerRow | null;
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

export default function OwnerModal({ open, onClose, onSaved, owner }: OwnerModalProps) {
  const isEdit = !!owner;
  const [apiError, setApiError] = useState<string | null>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);

  // file states
  const [ssnFiles, setSsnFiles] = useState<File[]>([]);
  const [ownerDocFiles, setOwnerDocFiles] = useState<File[]>([]);
  const [bankFiles, setBankFiles] = useState<File[]>([]);
  const [w9Files, setW9Files] = useState<File[]>([]);
  const [insuranceFiles, setInsuranceFiles] = useState<File[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      setApiError(null);
      setUploadWarning(null);
      setSsnFiles([]);
      setOwnerDocFiles([]);
      setBankFiles([]);
      setW9Files([]);
      setInsuranceFiles([]);
      reset({
        name: owner?.name ?? "",
        ownerName: owner?.ownerName ?? "",
        phone: owner?.phone ?? "",
        email: owner?.email ?? "",
        address: owner?.address ?? "",
        ssnFein: owner?.ssnFein ?? "",
        company: owner?.company ?? "",
      });
    }
  }, [open, owner, reset]);

  function handleClose() {
    const hasFiles =
      ssnFiles.length > 0 ||
      ownerDocFiles.length > 0 ||
      bankFiles.length > 0 ||
      w9Files.length > 0 ||
      insuranceFiles.length > 0;
    if ((isDirty || hasFiles) && !window.confirm("You have unsaved changes. Discard them?")) return;
    onClose();
  }

  async function onSubmit(data: FormData) {
    setApiError(null);
    const skipped: string[] = [];

    let ssnFeinDocUrl = owner?.ssnFeinDocUrl ?? null;
    let ownerDocUrl = owner?.ownerDocUrl ?? null;
    let bankInfoUrl = owner?.bankInfoUrl ?? null;
    let w9Url = owner?.w9Url ?? null;
    let insuranceUrl = owner?.insuranceUrl ?? null;

    async function tryUpload(
      files: File[],
      current: string | null,
      label: string,
      setter: (url: string) => void
    ) {
      if (!files.length) return;
      try { setter(await uploadFile(files[0], "piptrack_files")); }
      catch { skipped.push(label); void current; }
    }

    await tryUpload(ssnFiles, ssnFeinDocUrl, "SSN/FEIN document", (url) => { ssnFeinDocUrl = url; });
    await tryUpload(ownerDocFiles, ownerDocUrl, "owner document", (url) => { ownerDocUrl = url; });
    await tryUpload(bankFiles, bankInfoUrl, "bank info", (url) => { bankInfoUrl = url; });
    await tryUpload(w9Files, w9Url, "W-9", (url) => { w9Url = url; });
    await tryUpload(insuranceFiles, insuranceUrl, "insurance", (url) => { insuranceUrl = url; });

    if (skipped.length) {
      setUploadWarning(`File upload failed for: ${skipped.join(", ")}. Owner saved without those files.`);
    }

    const body = {
      ...data,
      company: data.company || null,
      ssnFeinDocUrl,
      ownerDocUrl,
      bankInfoUrl,
      w9Url,
      insuranceUrl,
    };

    const res = await fetch(isEdit ? `/api/owners/${owner!.id}` : "/api/owners", {
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Owner" : "Add Owner"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-2">

          {/* ── Company Info ── */}
          <div className="space-y-4">
            <FormField label="Company Name" error={errors.name?.message} required>
              <Input {...register("name")} placeholder="Acme Logistics LLC" autoFocus />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Owner Full Name" error={errors.ownerName?.message} required>
                <Input {...register("ownerName")} placeholder="John Smith" />
              </FormField>
              <FormField label="Owner Phone" error={errors.phone?.message} required>
                <Input {...register("phone")} placeholder="+1 555 0000" />
              </FormField>
            </div>

            <FormField label="Email" error={errors.email?.message} required>
              <Input {...register("email")} type="email" placeholder="owner@company.com" />
            </FormField>

            <FormField label="Address" error={errors.address?.message} required>
              <Textarea {...register("address")} placeholder="123 Main St, City, State 00000" rows={2} />
            </FormField>
          </div>

          {/* ── Tax Identity ── */}
          <Section title="Tax Identity">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="SSN / FEIN" error={errors.ssnFein?.message} required>
                <Input {...register("ssnFein")} placeholder="XX-XXXXXXX" />
              </FormField>
              <FileInput
                label="SSN / FEIN Document"
                accept=".pdf,.jpg,.jpeg,.png"
                files={ssnFiles}
                existingUrls={owner?.ssnFeinDocUrl ? [owner.ssnFeinDocUrl] : []}
                onChange={setSsnFiles}
                tooltip="Attach a copy of the SSN card or FEIN assignment letter."
              />
            </div>
          </Section>

          {/* ── Optional Documents ── */}
          <Section title="Documents (Optional)">
            <div className="grid grid-cols-2 gap-4">
              <FileInput
                label="Owner Document"
                accept=".pdf,.jpg,.jpeg,.png"
                files={ownerDocFiles}
                existingUrls={owner?.ownerDocUrl ? [owner.ownerDocUrl] : []}
                onChange={setOwnerDocFiles}
              />
              <FileInput
                label="Bank Info (Void Check)"
                accept=".pdf,.jpg,.jpeg,.png"
                files={bankFiles}
                existingUrls={owner?.bankInfoUrl ? [owner.bankInfoUrl] : []}
                onChange={setBankFiles}
                tooltip="Upload a voided check or bank letter showing routing and account numbers."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FileInput
                label="W-9"
                accept=".pdf"
                files={w9Files}
                existingUrls={owner?.w9Url ? [owner.w9Url] : []}
                onChange={setW9Files}
              />
              <FileInput
                label="Insurance"
                accept=".pdf,.jpg,.jpeg,.png"
                files={insuranceFiles}
                existingUrls={owner?.insuranceUrl ? [owner.insuranceUrl] : []}
                onChange={setInsuranceFiles}
              />
            </div>
          </Section>

          {/* ── Additional Info ── */}
          <Section title="Additional (Optional)">
            <FormField label="Company (Additional)">
              <Input {...register("company")} placeholder="Additional company name or DBA" />
            </FormField>
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
              {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Add Owner"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
