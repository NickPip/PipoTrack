"use client";

import { useEffect, useState } from "react";
import { Dialog as DP } from "radix-ui";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { extractErrorMessage } from "@/lib/api-errors";

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, "Required"),
  surname: z.string().min(1, "Required"),
  email: z.email("Invalid email"),
  password: z.string().min(6, "Min 6 characters").or(z.literal("")),
  idNumber: z.string().min(1, "Required"),
  role: z.enum(["ADMIN", "RECRUITING", "DISPATCHER", "OPERATIONS", "ACCOUNTING"]),
  phoneNumber: z.string().min(1, "Required"),
  phone2: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserRow {
  id: string;
  name: string;
  surname: string;
  email: string;
  idNumber: string;
  role: string;
  phoneNumber: string;
  phone2?: string | null;
  address?: string | null;
  emergencyContact?: string | null;
}

interface UserModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  user?: UserRow | null;
}

const ROLES = [
  { value: "ADMIN",       label: "Admin"       },
  { value: "RECRUITING",  label: "Recruiting"  },
  { value: "DISPATCHER",  label: "Dispatcher"  },
  { value: "OPERATIONS",  label: "Operations"  },
  { value: "ACCOUNTING",  label: "Accounting"  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Sect({ n, label }: { n: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <span style={{ width: 18, height: 18, borderRadius: 999, background: "var(--bg-soft)", border: "1px solid var(--line)", color: "var(--ink-2)", fontSize: 10.5, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, userSelect: "none" }}>{n}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
    </div>
  );
}

function Field({ htmlFor, label, required, optional, error, children }: { htmlFor?: string; label: string; required?: boolean; optional?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label htmlFor={htmlFor} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 500, color: "var(--ink-1)", letterSpacing: "-0.005em" }}>
        {label}
        {required && <span style={{ color: "var(--danger)", fontSize: 13, lineHeight: 1 }}>*</span>}
        {optional && <span style={{ fontSize: 10.5, fontWeight: 500, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginLeft: 4 }}>Optional</span>}
      </label>
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

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function UserModal({ open, onClose, onSaved, user }: UserModalProps) {
  const isEdit = !!user;
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", role: "DISPATCHER" },
  });

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setApiError(null);
      reset({
        name: user?.name ?? "",
        surname: user?.surname ?? "",
        email: user?.email ?? "",
        password: "",
        idNumber: user?.idNumber ?? "",
        role: (user?.role as FormData["role"]) ?? "DISPATCHER",
        phoneNumber: user?.phoneNumber ?? "",
        phone2: user?.phone2 ?? "",
        address: user?.address ?? "",
        emergencyContact: user?.emergencyContact ?? "",
      });
    }
  }, [open, user, reset]);

  function handleClose() {
    if (isDirty && !window.confirm("You have unsaved changes. Discard them?")) return;
    onClose();
  }

  async function onSubmit(data: FormData) {
    setApiError(null);
    const body: Partial<FormData> = { ...data };
    if (isEdit && !data.password) delete body.password;

    const res = await fetch(isEdit ? `/api/users/${user!.id}` : "/api/users", {
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
    onClose();
  }

  const FONT: React.CSSProperties = {
    fontFamily: "var(--font-geist-sans, ui-sans-serif, system-ui, -apple-system, sans-serif)",
    WebkitFontSmoothing: "antialiased",
  };

  const closeBtn: React.CSSProperties = {
    width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent",
    cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
    color: "var(--ink-2)", flexShrink: 0, transition: "background 0.14s, color 0.14s",
  };

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
              width: "100%", maxWidth: 560,
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
                  {isEdit ? "Edit User" : "Add User"}
                </DP.Title>
                <DP.Description style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--ink-3)" }}>
                  Fields marked with * are required.
                </DP.Description>
              </div>
              <button
                onClick={handleClose}
                aria-label="Close"
                style={closeBtn}
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
                id="usrm-form"
                onSubmit={handleSubmit(onSubmit)}
                onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleSubmit(onSubmit)(); } }}
              >

                {/* ── 1: Account ── */}
                <section style={{ padding: "18px 0", borderBottom: "1px solid var(--line)" }}>
                  <Sect n={1} label="Account" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <Field htmlFor="usrm-name" label="First Name" required error={errors.name?.message}>
                        <Ctrl err={!!errors.name}>
                          <input id="usrm-name" className="am-input" {...register("name")} placeholder="John" autoFocus />
                        </Ctrl>
                      </Field>
                      <Field htmlFor="usrm-surname" label="Last Name" required error={errors.surname?.message}>
                        <Ctrl err={!!errors.surname}>
                          <input id="usrm-surname" className="am-input" {...register("surname")} placeholder="Doe" />
                        </Ctrl>
                      </Field>
                    </div>

                    <Field htmlFor="usrm-email" label="Email" required error={errors.email?.message}>
                      <Ctrl err={!!errors.email}>
                        <input id="usrm-email" className="am-input" {...register("email")} type="email" placeholder="john@company.com" />
                      </Ctrl>
                    </Field>

                    <Field htmlFor="usrm-password" label={isEdit ? "New Password (leave blank to keep)" : "Password"} required={!isEdit} error={errors.password?.message}>
                      <Ctrl err={!!errors.password}>
                        <input id="usrm-password" className="am-input" {...register("password")} type="password" placeholder="••••••••" />
                      </Ctrl>
                    </Field>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <Field htmlFor="usrm-idNumber" label="ID Number" required error={errors.idNumber?.message}>
                        <Ctrl err={!!errors.idNumber}>
                          <input id="usrm-idNumber" className="am-input" {...register("idNumber")} placeholder="ID001" />
                        </Ctrl>
                      </Field>
                      <Field htmlFor="usrm-role" label="Role" required>
                        <Ctrl chevron>
                          <select id="usrm-role" className="am-sel" {...register("role")}>
                            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        </Ctrl>
                      </Field>
                    </div>
                  </div>
                </section>

                {/* ── 2: Contact ── */}
                <section style={{ padding: "18px 0" }}>
                  <Sect n={2} label="Contact" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <Field htmlFor="usrm-phoneNumber" label="Phone" required error={errors.phoneNumber?.message}>
                        <Ctrl err={!!errors.phoneNumber}>
                          <input id="usrm-phoneNumber" className="am-input" {...register("phoneNumber")} placeholder="+1 555 0000" />
                        </Ctrl>
                      </Field>
                      <Field htmlFor="usrm-phone2" label="Phone 2" optional>
                        <Ctrl>
                          <input id="usrm-phone2" className="am-input" {...register("phone2")} placeholder="+1 555 0001" />
                        </Ctrl>
                      </Field>
                    </div>

                    <Field htmlFor="usrm-address" label="Address" optional>
                      <Ctrl>
                        <input id="usrm-address" className="am-input" {...register("address")} placeholder="123 Main St" />
                      </Ctrl>
                    </Field>

                    <Field htmlFor="usrm-emergencyContact" label="Emergency Contact" optional>
                      <Ctrl>
                        <input id="usrm-emergencyContact" className="am-input" {...register("emergencyContact")} placeholder="Jane Doe +1 555 9999" />
                      </Ctrl>
                    </Field>
                  </div>
                </section>

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
                Cancel
              </button>
              <button
                type="submit"
                form="usrm-form"
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
                {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Add User"}
              </button>
            </div>

          </DP.Content>
        </div>
      </DP.Portal>
    </DP.Root>
  );
}
