"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog as DP } from "radix-ui";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
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

function Ctrl({ err, chevron, children }: { err?: boolean; chevron?: boolean; children: React.ReactNode }) {
  return (
    <div className={`am-ctrl${err ? " am-err" : ""}`}>
      {children}
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

// ─── Multi-select drivers ─────────────────────────────────────────────────────

function DriversMultiSelect({ drivers, selected, onChange, currentUnitId }: {
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

  const available = drivers.filter(d => !d.unitId || d.unitId === currentUnitId || selected.includes(d.id));
  const selectedNames = drivers.filter(d => selected.includes(d.id)).map(d => d.name);

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" className="am-multisel-trigger" onClick={() => setOpen(v => !v)}>
        <span style={{ color: selectedNames.length ? "var(--ink-1)" : "var(--ink-4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedNames.length ? selectedNames.join(", ") : "Select drivers…"}
        </span>
        <ChevronDown size={14} style={{ color: "var(--ink-3)", flexShrink: 0, marginLeft: 8 }} />
      </button>

      {open && (
        <div className="am-multisel-dropdown">
          {available.length === 0 ? (
            <p style={{ padding: "8px 12px", fontSize: 13, color: "var(--ink-4)" }}>No available drivers</p>
          ) : (
            available.map(d => (
              <button key={d.id} type="button" className="am-multisel-item" onClick={() => toggle(d.id)}>
                <input
                  type="checkbox"
                  readOnly
                  checked={selected.includes(d.id)}
                  style={{ width: 14, height: 14, accentColor: "var(--ink-1)", cursor: "pointer", flexShrink: 0 }}
                />
                <span>{d.name}</span>
              </button>
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
        driverIds: unit?.drivers.map(d => d.id) ?? [],
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
      try { registrationUrl = await uploadFile(regFiles[0], "piptrack_files"); }
      catch { skipped.push("vehicle registration"); }
    }
    if (picFiles.length) {
      try {
        const uploaded = await Promise.all(picFiles.map(f => uploadFile(f, "piptrack_files")));
        pictureUrls = isEdit ? [...pictureUrls, ...uploaded] : uploaded;
      } catch { skipped.push("vehicle pictures"); }
    }
    if (skipped.length) {
      setUploadWarning(`File upload failed for: ${skipped.join(", ")}. Unit saved without those files.`);
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
      dimensions: hasDimensions ? { length: data.length, width: data.width, height: data.height } : null,
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
  const equipmentValue = watch("equipment") ?? [];

  function toggleEquipment(item: (typeof EQUIPMENT_OPTIONS)[number]) {
    const current = equipmentValue as string[];
    setValue(
      "equipment",
      current.includes(item)
        ? (current.filter(e => e !== item) as typeof equipmentValue)
        : ([...current, item] as typeof equipmentValue)
    );
  }

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
                  {isEdit ? "Edit Unit" : "Add Unit"}
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
                id="untm-form"
                onSubmit={handleSubmit(onSubmit)}
                onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleSubmit(onSubmit)(); } }}
              >

                {/* ── 1: Vehicle Info ── */}
                <section style={{ padding: "18px 0", borderBottom: "1px solid var(--line)" }}>
                  <Sect n={1} label="Vehicle Info" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <Field label="Unit Number" required error={errors.unitNumber?.message}>
                        <Ctrl err={!!errors.unitNumber}>
                          <input className="am-input" {...register("unitNumber")} placeholder="U-001" autoFocus />
                        </Ctrl>
                      </Field>
                      <Field label="Assign to Owner" required error={errors.ownerId?.message}>
                        <Ctrl err={!!errors.ownerId} chevron>
                          <select className="am-sel" {...register("ownerId")}>
                            <option value="">Select owner…</option>
                            {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                          </select>
                        </Ctrl>
                      </Field>
                    </div>

                    <Field label="Vehicle Type" required error={errors.type?.message}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {VEHICLE_TYPES.map(t => (
                          <button key={t} type="button" onClick={() => setValue("type", t)} style={pillStyle(typeValue === t)}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </Field>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <Field label="Make" required error={errors.make?.message}>
                        <Ctrl err={!!errors.make}>
                          <input className="am-input" {...register("make")} placeholder="Mercedes-Benz" />
                        </Ctrl>
                      </Field>
                      <Field label="Model" required error={errors.model?.message}>
                        <Ctrl err={!!errors.model}>
                          <input className="am-input" {...register("model")} placeholder="Sprinter 2500" />
                        </Ctrl>
                      </Field>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                      <Field label="Year" required error={errors.year?.message}>
                        <Ctrl err={!!errors.year}>
                          <input className="am-input" {...register("year")} placeholder="2022" />
                        </Ctrl>
                      </Field>
                      <Field label="VIN" required error={errors.vin?.message}>
                        <Ctrl err={!!errors.vin}>
                          <input className="am-input" {...register("vin")} placeholder="1FTFW1E5X…" />
                        </Ctrl>
                      </Field>
                      <Field label="Plate Number" required error={errors.plateNumber?.message}>
                        <Ctrl err={!!errors.plateNumber}>
                          <input className="am-input" {...register("plateNumber")} placeholder="ABC-1234" />
                        </Ctrl>
                      </Field>
                    </div>
                  </div>
                </section>

                {/* ── 2: Assignment & Files ── */}
                <section style={{ padding: "18px 0", borderBottom: "1px solid var(--line)" }}>
                  <Sect n={2} label="Assignment & Files" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <Field label="Assign Drivers" optional>
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
                    </Field>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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
                  </div>
                </section>

                {/* ── 3: Specs ── */}
                <section style={{ padding: "18px 0" }}>
                  <Sect n={3} label="Specs" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                    <Field label="Dimensions (inches)" optional>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                        {(["length", "width", "height"] as const).map(dim => (
                          <Field key={dim} label={dim.charAt(0).toUpperCase() + dim.slice(1)} error={errors[dim]?.message}>
                            <Ctrl err={!!errors[dim]}>
                              <input className="am-input" {...register(dim, { valueAsNumber: true })} type="number" step="0.1" placeholder="0" style={{ textAlign: "right" }} />
                            </Ctrl>
                          </Field>
                        ))}
                      </div>
                    </Field>

                    <Field label="Payload (lbs)" optional error={errors.payload?.message}>
                      <div style={{ maxWidth: 180 }}>
                        <Ctrl err={!!errors.payload}>
                          <input className="am-input" {...register("payload", { valueAsNumber: true })} type="number" step="1" placeholder="e.g. 3500" style={{ textAlign: "right" }} />
                        </Ctrl>
                      </div>
                    </Field>

                    <Field label="Equipment" optional>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {EQUIPMENT_OPTIONS.map(item => (
                          <button key={item} type="button" onClick={() => toggleEquipment(item)} style={pillStyle(equipmentValue.includes(item))}>
                            {item}
                          </button>
                        ))}
                      </div>
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
                onClick={() => { setUploadWarning(null); handleClose(); }}
                style={{ height: 36, padding: "0 14px", borderRadius: 10, border: "1px solid var(--line-strong)", background: "transparent", fontSize: 13, fontWeight: 500, color: "var(--ink-1)", cursor: "pointer", letterSpacing: "-0.005em", transition: "background 0.14s", ...FONT }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-soft)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                {uploadWarning ? "Close" : "Cancel"}
              </button>
              <button
                type="submit"
                form="untm-form"
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
                {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Add Unit"}
              </button>
            </div>

          </DP.Content>
        </div>
      </DP.Portal>
    </DP.Root>
  );
}
