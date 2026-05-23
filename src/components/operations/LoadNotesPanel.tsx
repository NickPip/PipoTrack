"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type LoadSummary = {
  id: string;
  loadNumber: number;
  broker: string;
  trackingName?: string | null;
  dispatcherName?: string | null;
  pickupAddress?: string | null;
  pickupDate?: string | null;
  deliveryAddress?: string | null;
  deliveryDate?: string | null;
};

type Note = {
  id: string;
  userId: string;
  userName: string;
  body: string;
  createdAt: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function formatNoteTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const hhmm = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  if (isToday) return `Today · ${hhmm}`;
  if (isYesterday) return `Yesterday · ${hhmm}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${hhmm}`;
}

function formatMetaDate(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${min}`;
}

async function fetchNotes(loadId: string): Promise<Note[]> {
  const res = await fetch(`/api/loads/${loadId}/notes`);
  if (!res.ok) throw new Error("Failed to fetch notes");
  return res.json();
}

async function postNote(loadId: string, body: string): Promise<Note> {
  const res = await fetch(`/api/loads/${loadId}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error("Failed to post note");
  return res.json();
}

// ── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonNote() {
  return (
    <div style={{ display: "flex", gap: 12, padding: "14px 0 14px 22px", borderTop: "1px solid var(--line)" }}>
      <div style={{ width: 22, height: 22, borderRadius: 999, background: "var(--bg-soft)", flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ height: 11, width: 80, borderRadius: 4, background: "var(--bg-soft)" }} />
        <div style={{ height: 11, width: "100%", borderRadius: 4, background: "var(--bg-soft)" }} />
        <div style={{ height: 11, width: "65%", borderRadius: 4, background: "var(--bg-soft)" }} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LoadNotesPanel({
  load,
  onClose,
}: {
  load: LoadSummary;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const [text, setText] = useState("");
  const [postError, setPostError] = useState<string | null>(null);

  // Slide-in / slide-out animation phase
  const [phase, setPhase] = useState<"entering" | "open" | "leaving">("entering");

  useEffect(() => {
    const raf = requestAnimationFrame(() => setPhase("open"));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  function handleClose() {
    setPhase("leaving");
    setTimeout(onClose, 300);
  }

  // Esc to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus textarea on open
  useEffect(() => {
    if (phase === "open") {
      const t = setTimeout(() => textareaRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["load-notes", load.id],
    queryFn: () => fetchNotes(load.id),
  });

  const mutation = useMutation({
    mutationFn: (body: string) => postNote(load.id, body),
    onSuccess: (newNote) => {
      qc.setQueryData<Note[]>(["load-notes", load.id], (prev = []) => [...prev, newNote]);
      setText("");
      setPostError(null);
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 50);
    },
    onError: () => setPostError("Failed to post note. Please try again."),
  });

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || mutation.isPending) return;
    mutation.mutate(trimmed);
  }, [text, mutation]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Scroll to bottom when notes load
  useEffect(() => {
    if (!isLoading && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isLoading]);

  const isOpen = phase === "open";
  const pickupFmt = formatMetaDate(load.pickupDate);
  const deliveryFmt = formatMetaDate(load.deliveryDate);

  return (
    <>
      {/* Scrim */}
      <div
        onClick={handleClose}
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 56,
          right: 0,
          bottom: 0,
          left: 0,
          background: "rgba(11,11,12,0.32)",
          zIndex: 40,
          opacity: isOpen ? 1 : 0,
          transition: "opacity 0.2s ease",
          pointerEvents: phase === "leaving" ? "none" : "auto",
        }}
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        aria-describedby="drawer-subtitle"
        style={{
          position: "fixed",
          top: 56,
          right: 0,
          bottom: 0,
          width: 460,
          maxWidth: "100vw",
          background: "var(--bg)",
          borderLeft: "1px solid var(--line)",
          boxShadow: "-24px 0 60px -20px rgba(0,0,0,0.18), -8px 0 18px -8px rgba(0,0,0,0.08)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(.2,.7,.2,1)",
          fontFamily: "var(--font-geist-sans, ui-sans-serif, system-ui, -apple-system, sans-serif)",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              id="drawer-title"
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 600,
                lineHeight: 1.2,
                letterSpacing: "-0.02em",
                color: "var(--ink-1)",
              }}
            >
              Load notes · #{load.loadNumber}
            </h2>
            <div
              id="drawer-subtitle"
              style={{
                marginTop: 4,
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12.5,
                color: "var(--ink-3)",
              }}
            >
              <span>{load.broker}</span>
              {load.trackingName && (
                <>
                  <span
                    style={{
                      width: 3,
                      height: 3,
                      borderRadius: 999,
                      background: "var(--ink-4)",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontFamily: "var(--font-geist-mono, monospace)", fontSize: 12 }}>
                    {load.trackingName}
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            ref={closeBtnRef}
            onClick={handleClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ink-2)",
              flexShrink: 0,
              transition: "background 0.12s ease, color 0.12s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-soft)";
              e.currentTarget.style.color = "var(--ink-1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--ink-2)";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </button>
        </div>

        {/* ── Meta strip ── */}
        <div
          style={{
            padding: "14px 24px",
            borderBottom: "1px solid var(--line)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px 18px",
            flexShrink: 0,
          }}
        >
          {[
            { key: "Dispatcher", value: load.dispatcherName ?? "—" },
            { key: "Driver", value: "—" },
            {
              key: "Origin",
              value: load.pickupAddress ?? "—",
              suffix: pickupFmt,
            },
            {
              key: "Destination",
              value: load.deliveryAddress ?? "—",
              suffix: deliveryFmt,
            },
          ].map(({ key, value, suffix }) => (
            <div key={key}>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--ink-3)",
                }}
              >
                {key}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--ink-1)",
                  marginTop: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {value}
                {suffix && (
                  <span style={{ color: "var(--ink-3)", fontWeight: 400, marginLeft: 4 }}>
                    · {suffix}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Body ── */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Loading skeleton */}
          {isLoading && (
            <div style={{ padding: "6px 24px 16px" }}>
              <SkeletonNote />
              <SkeletonNote />
              <SkeletonNote />
            </div>
          )}

          {/* Empty state */}
          {!isLoading && notes.length === 0 && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "48px 24px",
                textAlign: "center",
                gap: 14,
              }}
            >
              <button
                onClick={() => textareaRef.current?.focus()}
                aria-label="Add first note"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 999,
                  background: "var(--bg-soft)",
                  boxShadow: "inset 0 0 0 1px var(--line)",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--ink-3)",
                  flexShrink: 0,
                }}
              >
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="11" y1="4" x2="11" y2="18" />
                  <line x1="4" y1="11" x2="18" y2="11" />
                </svg>
              </button>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--ink-1)" }}>
                  No notes yet
                </p>
                <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 400, lineHeight: 1.5, color: "var(--ink-3)", maxWidth: 240 }}>
                  Add the first note for this load — pickups, broker messages, delays, anything the team should know.
                </p>
              </div>
            </div>
          )}

          {/* Notes timeline */}
          {!isLoading && notes.length > 0 && (
            <div style={{ padding: "6px 24px 16px", display: "flex", flexDirection: "column" }}>
              {notes.map((note) => (
                <div key={note.id} className="note-item">
                  {/* Note header row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div
                      aria-hidden="true"
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        background: "var(--ink-1)",
                        color: "var(--bg)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 9.5,
                        fontWeight: 600,
                        letterSpacing: "0.02em",
                        flexShrink: 0,
                        userSelect: "none",
                        boxShadow: "0 0 0 2px var(--bg)",
                      }}
                    >
                      {getInitials(note.userName)}
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-1)" }}>
                      {note.userName}
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 400, color: "var(--ink-3)", marginLeft: "auto" }}>
                      {formatNoteTime(note.createdAt)}
                    </span>
                  </div>
                  {/* Note body */}
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13.5,
                      fontWeight: 400,
                      lineHeight: 1.55,
                      letterSpacing: "-0.003em",
                      color: "var(--ink-1)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {note.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Composer ── */}
        <div
          style={{
            borderTop: "1px solid var(--line)",
            padding: "14px 20px 16px",
            background: "var(--bg)",
            flexShrink: 0,
          }}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={mutation.isPending}
            placeholder="Write a note…"
            rows={3}
            style={{
              width: "100%",
              minHeight: 84,
              maxHeight: 200,
              resize: "none",
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid var(--line)",
              background: "var(--paper)",
              fontSize: 13.5,
              fontWeight: 400,
              lineHeight: 1.5,
              color: "var(--ink-1)",
              fontFamily: "inherit",
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color 0.15s ease, background 0.15s ease",
              display: "block",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--ink-3)";
              e.currentTarget.style.background = "var(--bg)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--line)";
              e.currentTarget.style.background = "var(--paper)";
            }}
          />

          {/* Error row */}
          {postError && (
            <p style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 500, color: "#b3261e" }}>
              {postError}
            </p>
          )}

          {/* Action row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            {/* Keyboard hint */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {["⌘", "↵"].map((key) => (
                <kbd
                  key={key}
                  style={{
                    padding: "1px 6px",
                    border: "1px solid var(--line-strong)",
                    borderBottomWidth: 2,
                    borderRadius: 5,
                    fontSize: 10.5,
                    fontWeight: 500,
                    fontFamily: "var(--font-geist-mono, monospace)",
                    color: "var(--ink-2)",
                    background: "var(--bg)",
                    lineHeight: 1.6,
                  }}
                >
                  {key}
                </kbd>
              ))}
              <span style={{ fontSize: 11.5, fontWeight: 400, color: "var(--ink-3)" }}>
                to post
              </span>
            </div>

            {/* Add note button */}
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || mutation.isPending}
              style={{
                marginLeft: "auto",
                height: 36,
                padding: "0 14px",
                borderRadius: 10,
                border: "1px solid var(--ink-1)",
                background: "var(--ink-1)",
                color: "var(--bg)",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "-0.005em",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "inherit",
                opacity: !text.trim() || mutation.isPending ? 0.5 : 1,
                pointerEvents: !text.trim() || mutation.isPending ? "none" : "auto",
                transition: "background 0.12s ease",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                if (!(!text.trim() || mutation.isPending)) {
                  e.currentTarget.style.background = "var(--ink-0)";
                  e.currentTarget.style.borderColor = "var(--ink-0)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--ink-1)";
                e.currentTarget.style.borderColor = "var(--ink-1)";
              }}
              onMouseDown={(e) => { e.currentTarget.style.transform = "translateY(1px)"; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="7" y1="2" x2="7" y2="12" />
                <line x1="2" y1="7" x2="12" y2="7" />
              </svg>
              {mutation.isPending ? "Adding…" : "Add note"}
            </button>
          </div>
        </div>
      </div>

      {/* Help FAB */}
      <div
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 60,
          width: 36,
          height: 36,
          borderRadius: 999,
          background: "var(--bg)",
          border: "1px solid var(--line-strong)",
          boxShadow: "0 6px 16px -6px rgba(0,0,0,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          fontWeight: 600,
          color: "var(--ink-2)",
          cursor: "pointer",
          userSelect: "none",
        }}
        title="Help"
      >
        ?
      </div>
    </>
  );
}
