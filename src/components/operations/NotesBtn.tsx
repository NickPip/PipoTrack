"use client";

export default function NotesBtn({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 26, padding: "0 9px", borderRadius: 7,
        border: "1px solid var(--line)", background: "var(--bg)",
        fontSize: 12, fontWeight: 500, color: "var(--ink-1)", cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
        transition: "background 0.14s ease, border-color 0.14s ease",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-soft)"; e.currentTarget.style.borderColor = "var(--line-strong)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "var(--bg)"; e.currentTarget.style.borderColor = "var(--line)"; }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--ink-2)", flexShrink: 0 }}>
        <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" />
        <line x1="3.5" y1="4.5" x2="8.5" y2="4.5" />
        <line x1="3.5" y1="6.5" x2="6.5" y2="6.5" />
      </svg>
      Notes
      {count > 0 && (
        <span style={{ minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999, background: "var(--ink-1)", color: "var(--bg)", fontSize: 10, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          {count}
        </span>
      )}
    </button>
  );
}
