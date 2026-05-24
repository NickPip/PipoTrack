"use client";

import { Dialog as DP } from "radix-ui";

interface ConfirmModalProps {
  open: boolean;
  label?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ open, label, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <DP.Root open={open} onOpenChange={v => { if (!v) onCancel(); }}>
      <DP.Portal>
        <DP.Overlay
          className="am-overlay"
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.32)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <DP.Content
            style={{
              background: "var(--bg)",
              border: "1px solid var(--line)",
              borderRadius: 20,
              boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
              width: "100%",
              maxWidth: 400,
              padding: "32px 28px 28px",
              outline: "none",
              animation: "am-content-in 0.2s ease both",
              textAlign: "center",
              position: "relative",
              fontFamily: "var(--font-geist-sans, ui-sans-serif, system-ui, -apple-system, sans-serif)",
            }}
          >
            {/* Close button */}
            <DP.Close
              style={{
                position: "absolute", top: 16, right: 16,
                width: 28, height: 28, borderRadius: 8,
                border: "none", background: "none", cursor: "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                color: "var(--ink-3)", transition: "background 0.14s, color 0.14s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-soft)"; e.currentTarget.style.color = "var(--ink-1)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--ink-3)"; }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="2" y1="2" x2="12" y2="12" /><line x1="12" y1="2" x2="2" y2="12" />
              </svg>
            </DP.Close>

            {/* Trash icon */}
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: "var(--danger-bg)",
              border: "1px solid var(--danger-bd)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              marginBottom: 18,
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3,6 21,6" />
                <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                <path d="M6 6l1 14h10l1-14" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </div>

            <DP.Title style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 700, color: "var(--ink-0)", letterSpacing: "-0.02em" }}>
              Delete this record?
            </DP.Title>

            <DP.Description asChild>
              <p style={{ margin: "0 0 24px", fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.6 }}>
                {label && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "3px 10px 3px 8px", borderRadius: 999,
                    border: "1px solid var(--line-strong)",
                    background: "var(--bg-soft)",
                    color: "var(--ink-1)", fontWeight: 500,
                    fontFamily: "var(--font-geist-mono, monospace)", fontSize: 12.5,
                    marginBottom: 4,
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#16a34a", flexShrink: 0 }} />
                    {label}
                  </span>
                )}
                {label && <br />}
                will be permanently deleted. This action cannot be undone.
              </p>
            </DP.Description>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={onCancel}
                style={{
                  flex: 1, height: 44, borderRadius: 12,
                  border: "1.5px solid var(--line-strong)", background: "var(--bg)",
                  fontSize: 14, fontWeight: 500, color: "var(--ink-1)",
                  cursor: "pointer", fontFamily: "inherit",
                  transition: "background 0.15s, border-color 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-soft)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "var(--bg)"; }}
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                style={{
                  flex: 1, height: 44, borderRadius: 12,
                  border: "none", background: "#9b2217",
                  fontSize: 14, fontWeight: 600, color: "#fff",
                  cursor: "pointer", fontFamily: "inherit",
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3,6 21,6" />
                  <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                  <path d="M6 6l1 14h10l1-14" />
                </svg>
                Delete record
              </button>
            </div>
          </DP.Content>
        </DP.Overlay>
      </DP.Portal>
    </DP.Root>
  );
}
