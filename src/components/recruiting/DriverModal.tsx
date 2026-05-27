"use client";

import { useEffect, useState } from "react";
import { Dialog as DP } from "radix-ui";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FileInput } from "@/components/shared/FileInput";
import { uploadFile } from "@/lib/upload-client";
import { extractErrorMessage } from "@/lib/api-errors";

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
      setApiError(extractErrorMessage(json.error) ?? "Something went wrong. Please try again.");
      return;
    }

    onSaved();
    if (skipped.length === 0) onClose();
  }

  const citizenshipValue = watch("citizenshipType");
  const cleanBgValue = watch("cleanBackground");

  const FONT: React.CSSProperties = {
    fontFamily: "var(--font-geist-sans, ui-sans-serif, system-ui, -apple-system, sans-serif)",
    WebkitFontSmoothing: "antialiased",
  };

  function pillStyle(active: boolean): React.CSSProperties {
    return {
      padding: "5px 13px", borderRadius: 999, fontSize: 13, cursor: "pointer",
      border: active ? "1px solid var(--ink-1)" : "1px solid var(--line)",
      background: active ? "var(--ink-1)" : "transparent",
      color: active ? "var(--bg)" : "var(--ink-2)",
      transition: "background 0.14s, border-color 0.14s, color 0.14s",
      ...FONT,
    };
  }

  return (
    <DP.Root open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DP.Portal>
        <DP.Overlay
          className="am-overlay"
          style={{ position: "fixed", inset: 0, background: "rgba(11,11,12,0.42)", zIndex: 110 }}
        />

        <div style={{ position: "fixed", inset: 0, zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", pointerEvents: "none" }}>
          <DP.Content
            onInteractOutside={e => { e.preventDefault(); handleClose(); }}
            onEscapeKeyDown={e => { e.preventDefault(); handleClose(); }}
            style={{
              width: "100%", maxWidth: 620,
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
                  {isEdit ? "Edit Driver" : "Add Driver"}
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
                id="drvm-form"
                onSubmit={handleSubmit(onSubmit)}
                onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleSubmit(onSubmit)(); } }}
              >

                {/* ── 1: Personal Info ── */}
                <section style={{ padding: "18px 0", borderBottom: "1px solid var(--line)" }}>
                  <Sect n={1} label="Personal Info" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <Field label="Full Name" required error={errors.name?.message}>
                        <Ctrl err={!!errors.name}>
                          <input className="am-input" {...register("name")} placeholder="John Doe" autoFocus />
                        </Ctrl>
                      </Field>
                      <Field label="Phone Number" required error={errors.phone?.message}>
                        <Ctrl err={!!errors.phone}>
                          <input className="am-input" {...register("phone")} placeholder="+1 555 0000" />
                        </Ctrl>
                      </Field>
                    </div>
                    <Field label="Address" required error={errors.address?.message}>
                      <textarea className={`am-ta${errors.address ? " am-err" : ""}`} {...register("address")} placeholder="123 Main St, City, State 00000" rows={2} />
                    </Field>
                    <Field label="Emergency Contact" required error={errors.emergencyContact?.message}>
                      <Ctrl err={!!errors.emergencyContact}>
                        <input className="am-input" {...register("emergencyContact")} placeholder="Jane Doe +1 555 9999" />
                      </Ctrl>
                    </Field>
                  </div>
                </section>

                {/* ── 2: Documents ── */}
                <section style={{ padding: "18px 0", borderBottom: "1px solid var(--line)" }}>
                  <Sect n={2} label="Documents" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <Field label="D/L Number" required error={errors.dlNumber?.message}>
                        <Ctrl err={!!errors.dlNumber}>
                          <input className="am-input" {...register("dlNumber")} placeholder="DL-12345678" />
                        </Ctrl>
                      </Field>
                      <FileInput
                        label="D/L Document"
                        accept=".pdf,.jpg,.jpeg,.png"
                        files={dlFiles}
                        existingUrls={driver?.dlDocumentUrl ? [driver.dlDocumentUrl] : []}
                        onChange={setDlFiles}
                      />
                    </div>

                    <Field label="Citizenship Type" required error={errors.citizenshipType?.message}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {CITIZENSHIP_TYPES.map(t => (
                          <button key={t} type="button" onClick={() => setValue("citizenshipType", t, { shouldDirty: true })} style={pillStyle(citizenshipValue === t)}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </Field>

                    <Field label="Clean Background" required error={errors.cleanBackground?.message}>
                      <div style={{ display: "flex", gap: 8 }}>
                        {([true, false] as const).map(v => (
                          <button key={String(v)} type="button" onClick={() => setValue("cleanBackground", v, { shouldDirty: true })} style={pillStyle(cleanBgValue === v)}>
                            {v ? "Yes" : "No"}
                          </button>
                        ))}
                      </div>
                    </Field>
                  </div>
                </section>

                {/* ── 3: Optional Documents ── */}
                <section style={{ padding: "18px 0", borderBottom: "1px solid var(--line)" }}>
                  <Sect n={3} label="Optional Documents" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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
                </section>

                {/* ── 4: App Credentials ── */}
                <section style={{ padding: "18px 0" }}>
                  <Sect n={4} label="App Credentials" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <Field label="Application Username" optional>
                      <Ctrl>
                        <input className="am-input" {...register("appUsername")} placeholder="username" />
                      </Ctrl>
                    </Field>
                    <Field label="Application Password" optional>
                      <Ctrl>
                        <input className="am-input" {...register("appPassword")} type="password" placeholder="••••••••" />
                      </Ctrl>
                    </Field>
                  </div>
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
                form="drvm-form"
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
                {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Add Driver"}
              </button>
            </div>

          </DP.Content>
        </div>
      </DP.Portal>
    </DP.Root>
  );
}
