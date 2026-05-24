"use client";

import { useEffect, useState } from "react";
import { Dialog as DP } from "radix-ui";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { FileInput } from "@/components/shared/FileInput";
import { uploadFile } from "@/lib/upload-client";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "PENDING",               label: "Pending"               },
  { value: "CANCELED",              label: "Canceled"              },
  { value: "DISPATCHED_TO_PICKUP",  label: "Dispatched to Pickup"  },
  { value: "ONSITE_FOR_PICKUP",     label: "OnSite for Pickup"     },
  { value: "LOADED_AND_DELIVERING", label: "Loaded and Delivering" },
  { value: "ONSITE_FOR_DELIVERY",   label: "OnSite for Delivery"   },
  { value: "DELIVERED",             label: "Delivered"             },
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
  driverId: z.string().optional(),
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
  miles?: number | null;
  vehicleRequired?: string | null;
  dispatcherId?: string | null;
  dispatcherName?: string | null;
  trackingId?: string | null;
  trackingName?: string | null;
  unitId?: string | null;
  unitNumber?: string | null;
  driverId?: string | null;
  driverName?: string | null;
  rcUrl?: string | null;
  bolUrls?: string[] | null;
  podUrl?: string | null;
  notesCount?: number;
  createdAt: string;
}

interface UserOption { id: string; name: string; surname: string; role: string }
interface DriverOption { id: string; name: string }
interface UnitOption { id: string; unitNumber: string; drivers: DriverOption[] }

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
  return data.map((u: UnitOption) => ({ id: u.id, unitNumber: u.unitNumber, drivers: u.drivers ?? [] }));
}

function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${min}`;
}


// ─── Form sub-components ──────────────────────────────────────────────────────

function Sect({ n, label }: { n: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <span style={{ width: 18, height: 18, borderRadius: 999, background: "var(--bg-soft)", border: "1px solid var(--line)", color: "var(--ink-2)", fontSize: 10.5, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, userSelect: "none" }}>
        {n}
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </span>
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

function Ctrl({ err, prefix, suffix, chevron, children }: { err?: boolean; prefix?: string; suffix?: string; chevron?: boolean; children: React.ReactNode }) {
  return (
    <div className={`am-ctrl${err ? " am-err" : ""}`}>
      {prefix && <span className="am-prefix">{prefix}</span>}
      {children}
      {suffix && <span className="am-suffix">{suffix}</span>}
      {chevron && (
        <span className="am-chevron">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><polyline points="2,4 6,8 10,4" /></svg>
        </span>
      )}
    </div>
  );
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

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function AddLoadModal({ open, onClose, onSaved, load }: AddLoadModalProps) {
  const isEdit = !!load;

  const [rcFiles,        setRcFiles]        = useState<File[]>([]);
  const [bolFiles,       setBolFiles]       = useState<File[]>([]);
  const [podFiles,       setPodFiles]       = useState<File[]>([]);
  const [uploadWarning,  setUploadWarning]  = useState<string | null>(null);
  const [apiError,       setApiError]       = useState<string | null>(null);

  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: fetchUsers, enabled: open });
  const { data: units = [] } = useQuery({ queryKey: ["units"], queryFn: fetchUnits, enabled: open });

  const dispatchers = users.filter(u => u.role === "DISPATCHER" || u.role === "ADMIN");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: "PENDING", driverRate: 0, rate: 0, brokerReference: "", unitId: "", driverId: "" },
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
        unitId:   load?.unitId   ?? "",
        driverId: load?.driverId ?? "",
      });
      setRcFiles([]);
      setBolFiles([]);
      setPodFiles([]);
    }
  }, [open, load, reset]);

  function handleClose() {
    const dirty = isDirty || rcFiles.length > 0 || bolFiles.length > 0 || podFiles.length > 0;
    if (dirty && !window.confirm("You have unsaved changes. Discard them?")) return;
    setUploadWarning(null);
    onClose();
  }

  async function onSubmit(data: FormData) {
    setApiError(null);
    let rcUrl  = load?.rcUrl ?? null;
    let bolUrls: string[] = (load?.bolUrls as string[]) ?? [];
    let podUrl = load?.podUrl ?? null;
    const skipped: string[] = [];

    if (rcFiles.length) {
      try { rcUrl = await uploadFile(rcFiles[0], "piptrack_files"); }
      catch { skipped.push("Rate Confirmation"); }
    }
    if (bolFiles.length) {
      try {
        const uploaded = await Promise.all(bolFiles.map(f => uploadFile(f, "piptrack_files")));
        bolUrls = isEdit ? [...bolUrls, ...uploaded] : uploaded;
      } catch { skipped.push("BOL / Freight Pictures"); }
    }
    if (podFiles.length) {
      try { podUrl = await uploadFile(podFiles[0], "piptrack_files"); }
      catch { skipped.push("Signed POD"); }
    }
    if (skipped.length) setUploadWarning(`File upload failed for: ${skipped.join(", ")}. Load saved without those files.`);

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
      unitId:   data.unitId   || null,
      driverId: data.driverId || null,
      rcUrl, bolUrls, podUrl,
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

  const watchedUnitId  = watch("unitId");
  const driverOptions  = watchedUnitId
    ? (units.find(u => u.id === watchedUnitId)?.drivers ?? [])
    : units.flatMap(u => u.drivers);

  const FONT: React.CSSProperties = {
    fontFamily: "var(--font-geist-sans, ui-sans-serif, system-ui, -apple-system, sans-serif)",
    WebkitFontSmoothing: "antialiased",
  };

  return (
    <DP.Root open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DP.Portal>
        {/* Scrim */}
        <DP.Overlay
          className="am-overlay"
          style={{ position: "fixed", inset: 0, background: "rgba(11,11,12,0.42)", zIndex: 50 }}
        />

        {/* Centering layer */}
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", pointerEvents: "none" }}>

          {/* Modal box */}
          <DP.Content
            onInteractOutside={e => { e.preventDefault(); handleClose(); }}
            onEscapeKeyDown={e => { e.preventDefault(); handleClose(); }}
            style={{
              width: "100%", maxWidth: 720,
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
                  {isEdit ? `Edit Load #${load!.loadNumber}` : "Add New Load"}
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
                id="adlm-form"
                onSubmit={handleSubmit(onSubmit)}
                onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleSubmit(onSubmit)(); } }}
              >

                {/* ── 1: Load Information ── */}
                <section style={{ padding: "18px 0", borderBottom: "1px solid var(--line)" }}>
                  <Sect n={1} label="Load Information" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                    {/* Load # (edit) / Broker Ref row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      {isEdit ? (
                        <Field label="Load Number">
                          <Ctrl>
                            <input className="am-input" value={`#${load!.loadNumber}`} readOnly style={{ color: "var(--ink-3)", cursor: "default" }} />
                          </Ctrl>
                        </Field>
                      ) : (
                        <Field label="Broker Reference" optional>
                          <Ctrl>
                            <input className="am-input" {...register("brokerReference")} placeholder="N/A" />
                          </Ctrl>
                        </Field>
                      )}
                      {isEdit ? (
                        <Field label="Broker Reference" optional>
                          <Ctrl>
                            <input className="am-input" {...register("brokerReference")} placeholder="N/A" />
                          </Ctrl>
                        </Field>
                      ) : (
                        <div />
                      )}
                    </div>

                    {/* Broker */}
                    <Field label="Broker" required error={errors.broker?.message}>
                      <Ctrl err={!!errors.broker}>
                        <input className="am-input" {...register("broker")} placeholder="e.g., XPO Logistics" autoFocus={!isEdit} aria-required="true" />
                      </Ctrl>
                    </Field>

                    {/* Dispatcher + Tracking ID */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <Field label="Dispatcher" required error={errors.dispatcherId?.message}>
                        <Ctrl err={!!errors.dispatcherId} chevron>
                          <select className="am-sel" {...register("dispatcherId")} aria-required="true">
                            <option value="">Select dispatcher</option>
                            {dispatchers.map(u => <option key={u.id} value={u.id}>{u.name} {u.surname}</option>)}
                          </select>
                        </Ctrl>
                      </Field>
                      <Field label="Tracking ID" required error={errors.trackingId?.message}>
                        <Ctrl err={!!errors.trackingId} chevron>
                          <select className="am-sel" {...register("trackingId")} aria-required="true">
                            <option value="">Select tracking user</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name} {u.surname}</option>)}
                          </select>
                        </Ctrl>
                      </Field>
                    </div>

                    {/* Status + Driver Rate + Total Rate */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                      <Field label="Status" required error={errors.status?.message}>
                        <Ctrl err={!!errors.status} chevron>
                          <select className="am-sel" {...register("status")} aria-required="true">
                            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </Ctrl>
                      </Field>
                      <Field label="Driver Rate" error={errors.driverRate?.message}>
                        <Ctrl prefix="$" suffix="USD">
                          <input className="am-input" {...register("driverRate", { valueAsNumber: true })} type="number" step="0.01" min="0" placeholder="0" style={{ textAlign: "right" }} />
                        </Ctrl>
                      </Field>
                      <Field label="Total Rate" error={errors.rate?.message}>
                        <Ctrl prefix="$" suffix="USD">
                          <input className="am-input" {...register("rate", { valueAsNumber: true })} type="number" step="0.01" min="0" placeholder="0" style={{ textAlign: "right" }} />
                        </Ctrl>
                      </Field>
                    </div>
                  </div>
                </section>

                {/* ── 2: Pickup Details ── */}
                <section style={{ padding: "18px 0", borderBottom: "1px solid var(--line)" }}>
                  <Sect n={2} label="Pickup Details" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <Field label="Pickup Address" required error={errors.pickupAddress?.message}>
                        <Ctrl err={!!errors.pickupAddress}>
                          <input className="am-input" {...register("pickupAddress")} placeholder="e.g., MS 38706" aria-required="true" />
                        </Ctrl>
                      </Field>
                      <Field label="Pickup Time" required error={errors.pickupDate?.message}>
                        <Ctrl err={!!errors.pickupDate}>
                          <input className="am-input" {...register("pickupDate")} placeholder="e.g., 11/03 18:30" aria-required="true" />
                        </Ctrl>
                      </Field>
                    </div>
                    <Field label="Pickup Notes" optional>
                      <textarea className="am-ta" {...register("pickupNotes")} placeholder="Additional pickup instructions..." />
                    </Field>
                  </div>
                </section>

                {/* ── 3: Delivery Details ── */}
                <section style={{ padding: "18px 0", borderBottom: "1px solid var(--line)" }}>
                  <Sect n={3} label="Delivery Details" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <Field label="Delivery Address" required error={errors.deliveryAddress?.message}>
                        <Ctrl err={!!errors.deliveryAddress}>
                          <input className="am-input" {...register("deliveryAddress")} placeholder="e.g., MI 48235" aria-required="true" />
                        </Ctrl>
                      </Field>
                      <Field label="Delivery Time" required error={errors.deliveryDate?.message}>
                        <Ctrl err={!!errors.deliveryDate}>
                          <input className="am-input" {...register("deliveryDate")} placeholder="e.g., 11/04 08:30" aria-required="true" />
                        </Ctrl>
                      </Field>
                    </div>
                    <Field label="Delivery Notes" optional>
                      <textarea className="am-ta" {...register("deliveryNotes")} placeholder="Additional delivery instructions..." />
                    </Field>
                  </div>
                </section>

                {/* ── 4: Unit Assignment ── */}
                <section style={{ padding: "18px 0", borderBottom: "1px solid var(--line)" }}>
                  <Sect n={4} label="Unit Assignment" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <Field label="Assigned Unit" optional>
                      <Ctrl chevron>
                        <select className="am-sel" {...register("unitId")}>
                          <option value="">Not assigned</option>
                          {units.map(u => <option key={u.id} value={u.id}>{u.unitNumber}</option>)}
                        </select>
                      </Ctrl>
                    </Field>
                    <Field label="Driver" optional>
                      <Ctrl chevron>
                        <select className="am-sel" {...register("driverId")}>
                          <option value="">{watchedUnitId ? "No driver" : "Select a unit first"}</option>
                          {driverOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </Ctrl>
                    </Field>
                  </div>
                </section>

                {/* ── 5: Document Uploads ── */}
                <section style={{ padding: "18px 0" }}>
                  <Sect n={5} label="Document Uploads" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <FileInput label="Rate Confirmation"         accept=".pdf,.png"            files={rcFiles}  existingUrls={load?.rcUrl ? [load.rcUrl] : []}     onChange={setRcFiles}  />
                    <FileInput label="BOL + Loaded Freight Pictures" multiple                  files={bolFiles} existingUrls={(load?.bolUrls as string[]) ?? []}   onChange={setBolFiles} />
                    <FileInput label="Signed POD"                accept=".pdf,.png,.jpg,.jpeg" files={podFiles} existingUrls={load?.podUrl ? [load.podUrl] : []}  onChange={setPodFiles} />
                  </div>
                </section>

                {/* Feedback banners */}
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

              {/* Cancel */}
              <button
                type="button"
                onClick={() => { setUploadWarning(null); handleClose(); }}
                style={{ height: 36, padding: "0 14px", borderRadius: 10, border: "1px solid var(--line-strong)", background: "transparent", fontSize: 13, fontWeight: 500, color: "var(--ink-1)", cursor: "pointer", letterSpacing: "-0.005em", transition: "background 0.14s, border-color 0.14s", ...FONT }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-soft)"; e.currentTarget.style.borderColor = "var(--line-strong)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--line-strong)"; }}
                onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(1px)"; }}
                onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = ""; }}
              >
                {uploadWarning ? "Close" : "Cancel"}
              </button>

              {/* Create / Save */}
              <button
                type="submit"
                form="adlm-form"
                disabled={isSubmitting}
                style={{ height: 36, padding: "0 16px", borderRadius: 10, border: "1px solid var(--ink-1)", background: "var(--ink-1)", fontSize: 13, fontWeight: 600, color: "var(--bg)", cursor: isSubmitting ? "default" : "pointer", letterSpacing: "-0.005em", transition: "background 0.14s", display: "inline-flex", alignItems: "center", gap: 7, opacity: isSubmitting ? 0.7 : 1, ...FONT }}
                onMouseEnter={e => { if (!isSubmitting) e.currentTarget.style.background = "var(--ink-0)"; }}
                onMouseLeave={e => { if (!isSubmitting) e.currentTarget.style.background = "var(--ink-1)"; }}
                onMouseDown={e => { if (!isSubmitting) (e.currentTarget as HTMLButtonElement).style.transform = "translateY(1px)"; }}
                onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = ""; }}
              >
                {isSubmitting && (
                  <svg className="am-spinner" width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M6.5 1.5 A5 5 0 0 1 11.5 6.5" />
                  </svg>
                )}
                {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Add Load"}
              </button>
            </div>

          </DP.Content>
        </div>
      </DP.Portal>
    </DP.Root>
  );
}
