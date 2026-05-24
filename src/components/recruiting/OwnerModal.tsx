"use client";

import { useEffect, useState } from "react";
import { Dialog as DP } from "radix-ui";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FileInput } from "@/components/shared/FileInput";
import { uploadFile } from "@/lib/upload-client";

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, "Required"),
  ownerName: z.string().min(1, "Required"),
  phone: z.string().min(1, "Required"),
  email: z.email("Invalid email"),
  address: z.string().min(1, "Required"),
  ssnFein: z.string().min(1, "Required"),
  company: z.string().optional(),
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function Sect({ n, label }: { n: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <span style={{ width: 18, height: 18, borderRadius: 999, background: "var(--bg-soft)", border: "1px solid var(--line)", color: "var(--ink-2)", fontSize: 10.5, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, userSelect: "none" }}>{n}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
    </div>
  );
}

function Field({ label, required, optional, error, children }: { label: string; required?: boolean; optional?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 500, color: "var(--ink-1)", letterSpacing: "-0.005em" }}>
        {label}
        {required && <span style={{ color: "var(--danger)", fontSize: 13, lineHeight: 1 }}>*</span>}
        {optional && <span style={{ fontSize: 10.5, fontWeight: 500, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginLeft: 4 }}>Optional</span>}
      </span>
      {children}
      {error && <span style={{ fontSize: 11.5, color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}

function Ctrl({ err, children }: { err?: boolean; children: React.ReactNode }) {
  return <div className={`am-ctrl${err ? " am-err" : ""}`}>{children}</div>;
}

function KbdHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--ink-3)" }}>
      {keys.map(k => (
        <kbd key={k} style={{ padding: "1px 6px", border: "1px solid var(--line-strong)", borderBottomWidth: 2, borderRadius: 5, fontSize: 10.5, fontWeight: 500, fontFamily: "var(--font-geist-mono, monospace)", color: "var(--ink-3)", background: "var(--bg)", lineHeight: 1.6 }}>{k}</kbd>
      ))}
      <span style={{ marginLeft: 2 }}>{label}</span>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function OwnerModal({ open, onClose, onSaved, owner }: OwnerModalProps) {
  const isEdit = !!owner;
  const [apiError, setApiError] = useState<string | null>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);

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
      ssnFiles.length > 0 || ownerDocFiles.length > 0 ||
      bankFiles.length > 0 || w9Files.length > 0 || insuranceFiles.length > 0;
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

    async function tryUpload(files: File[], current: string | null, label: string, setter: (url: string) => void) {
      if (!files.length) return;
      try { setter(await uploadFile(files[0], "piptrack_files")); }
      catch { skipped.push(label); void current; }
    }

    await tryUpload(ssnFiles, ssnFeinDocUrl, "SSN/FEIN document", url => { ssnFeinDocUrl = url; });
    await tryUpload(ownerDocFiles, ownerDocUrl, "owner document", url => { ownerDocUrl = url; });
    await tryUpload(bankFiles, bankInfoUrl, "bank info", url => { bankInfoUrl = url; });
    await tryUpload(w9Files, w9Url, "W-9", url => { w9Url = url; });
    await tryUpload(insuranceFiles, insuranceUrl, "insurance", url => { insuranceUrl = url; });

    if (skipped.length) {
      setUploadWarning(`File upload failed for: ${skipped.join(", ")}. Owner saved without those files.`);
    }

    const body = {
      ...data,
      company: data.company || null,
      ssnFeinDocUrl, ownerDocUrl, bankInfoUrl, w9Url, insuranceUrl,
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

  const FONT: React.CSSProperties = {
    fontFamily: "var(--font-geist-sans, ui-sans-serif, system-ui, -apple-system, sans-serif)",
    WebkitFontSmoothing: "antialiased",
  };

  return (
    <DP.Root open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DP.Portal>
        <DP.Overlay
          className="am-overlay"
          style={{ position: "fixed", inset: 0, background: "rgba(11,11,12,0.42)", zIndex: 50 }}
        />

        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", pointerEvents: "none" }}>
          <DP.Content
            onInteractOutside={e => { e.preventDefault(); handleClose(); }}
            onEscapeKeyDown={e => { e.preventDefault(); handleClose(); }}
            style={{
              width: "100%", maxWidth: 680,
              background: "var(--bg)", borderRadius: 16,
              border: "1px solid var(--line)",
              boxShadow: "0 24px 60px -10px rgba(0,0,0,.35), 0 8px 18px -8px rgba(0,0,0,.18)",
              display: "flex", flexDirection: "column",
              maxHeight: "calc(100vh - 32px)",
              animation: "am-content-in 0.22s cubic-bezier(.2,.7,.2,1) both",
              pointerEvents: "all", outline: "none",
              ...FONT,
            }}
          >

            {/* ── Header ── */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "20px 24px 16px", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
              <div style={{ flex: 1 }}>
                <DP.Title style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink-1)" }}>
                  {isEdit ? "Edit Owner" : "Add Owner"}
                </DP.Title>
                <DP.Description style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--ink-3)" }}>
                  Fields marked with * are required.
                </DP.Description>
              </div>
              <button
                onClick={handleClose}
                aria-label="Close"
                style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ink-2)", flexShrink: 0, transition: "background 0.14s, color 0.14s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-soft)"; e.currentTarget.style.color = "var(--ink-1)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ink-2)"; }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <line x1="3" y1="3" x2="13" y2="13" /><line x1="13" y1="3" x2="3" y2="13" />
                </svg>
              </button>
            </div>

            {/* ── Scrollable body ── */}
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 24px" }}>
              <form
                id="ownm-form"
                onSubmit={handleSubmit(onSubmit)}
                onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleSubmit(onSubmit)(); } }}
              >

                {/* ── 1: Company Info ── */}
                <section style={{ padding: "18px 0", borderBottom: "1px solid var(--line)" }}>
                  <Sect n={1} label="Company Info" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <Field label="Company Name" required error={errors.name?.message}>
                      <Ctrl err={!!errors.name}>
                        <input className="am-input" {...register("name")} placeholder="Acme Logistics LLC" autoFocus />
                      </Ctrl>
                    </Field>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <Field label="Owner Full Name" required error={errors.ownerName?.message}>
                        <Ctrl err={!!errors.ownerName}>
                          <input className="am-input" {...register("ownerName")} placeholder="John Smith" />
                        </Ctrl>
                      </Field>
                      <Field label="Owner Phone" required error={errors.phone?.message}>
                        <Ctrl err={!!errors.phone}>
                          <input className="am-input" {...register("phone")} placeholder="+1 555 0000" />
                        </Ctrl>
                      </Field>
                    </div>

                    <Field label="Email" required error={errors.email?.message}>
                      <Ctrl err={!!errors.email}>
                        <input className="am-input" {...register("email")} type="email" placeholder="owner@company.com" />
                      </Ctrl>
                    </Field>

                    <Field label="Address" required error={errors.address?.message}>
                      <textarea className={`am-ta${errors.address ? " am-err" : ""}`} {...register("address")} placeholder="123 Main St, City, State 00000" rows={2} />
                    </Field>
                  </div>
                </section>

                {/* ── 2: Tax Identity ── */}
                <section style={{ padding: "18px 0", borderBottom: "1px solid var(--line)" }}>
                  <Sect n={2} label="Tax Identity" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <Field label="SSN / FEIN" required error={errors.ssnFein?.message}>
                      <Ctrl err={!!errors.ssnFein}>
                        <input className="am-input" {...register("ssnFein")} placeholder="XX-XXXXXXX" />
                      </Ctrl>
                    </Field>
                    <FileInput
                      label="SSN / FEIN Document"
                      accept=".pdf,.jpg,.jpeg,.png"
                      files={ssnFiles}
                      existingUrls={owner?.ssnFeinDocUrl ? [owner.ssnFeinDocUrl] : []}
                      onChange={setSsnFiles}
                      tooltip="Attach a copy of the SSN card or FEIN assignment letter."
                    />
                  </div>
                </section>

                {/* ── 3: Documents ── */}
                <section style={{ padding: "18px 0", borderBottom: "1px solid var(--line)" }}>
                  <Sect n={3} label="Documents" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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
                  </div>
                </section>

                {/* ── 4: Additional ── */}
                <section style={{ padding: "18px 0" }}>
                  <Sect n={4} label="Additional" />
                  <Field label="Company (Additional)" optional>
                    <Ctrl>
                      <input className="am-input" {...register("company")} placeholder="Additional company name or DBA" />
                    </Ctrl>
                  </Field>
                </section>

                {uploadWarning && (
                  <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "#fdf2e9", border: "1px solid #f4d6b5", fontSize: 12.5, color: "#9a4f12" }}>
                    <strong>Warning:</strong> {uploadWarning}
                  </div>
                )}
                {apiError && (
                  <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "var(--danger-bg)", border: "1px solid var(--danger-bd)", fontSize: 12.5, color: "var(--danger)" }}>
                    {apiError}
                  </div>
                )}
              </form>
            </div>

            {/* ── Footer ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 20px 16px", borderTop: "1px solid var(--line)", flexShrink: 0, background: "var(--bg)" }}>
              <KbdHint keys={["⌘", "↵"]} label={`to ${isEdit ? "save" : "create"}`} />
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={handleClose}
                style={{ height: 36, padding: "0 14px", borderRadius: 10, border: "1px solid var(--line-strong)", background: "transparent", fontSize: 13, fontWeight: 500, color: "var(--ink-1)", cursor: "pointer", letterSpacing: "-0.005em", transition: "background 0.14s", ...FONT }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-soft)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                {uploadWarning ? "Close" : "Cancel"}
              </button>
              <button
                type="submit"
                form="ownm-form"
                disabled={isSubmitting}
                style={{ height: 36, padding: "0 16px", borderRadius: 10, border: "1px solid var(--ink-1)", background: "var(--ink-1)", fontSize: 13, fontWeight: 600, color: "var(--bg)", cursor: isSubmitting ? "default" : "pointer", letterSpacing: "-0.005em", transition: "background 0.14s", display: "inline-flex", alignItems: "center", gap: 7, opacity: isSubmitting ? 0.7 : 1, ...FONT }}
                onMouseEnter={e => { if (!isSubmitting) e.currentTarget.style.background = "var(--ink-0)"; }}
                onMouseLeave={e => { if (!isSubmitting) e.currentTarget.style.background = "var(--ink-1)"; }}
              >
                {isSubmitting && (
                  <svg className="am-spinner" width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M6.5 1.5 A5 5 0 0 1 11.5 6.5" />
                  </svg>
                )}
                {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Add Owner"}
              </button>
            </div>

          </DP.Content>
        </div>
      </DP.Portal>
    </DP.Root>
  );
}
