"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useRef, useState, useCallback, useEffect } from "react";
import type { Role } from "@/generated/prisma/enums";
import { canAccess } from "@/lib/rbac";

type DropdownChild = { title: string; description: string; href: string };
type NavItem =
  | { label: string; href: string; module?: string }
  | { label: string; module: string; children: DropdownChild[] };

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/" },
  {
    label: "Dispatch",
    module: "dispatch",
    children: [
      { title: "Bot", description: "Automated driver bidding via Telegram", href: "/dispatch/bot" },
      { title: "Live Map", description: "Real-time driver locations", href: "/dispatch/map" },
      { title: "Availabilities", description: "Driver schedules & hours", href: "/dispatch/availabilities" },
    ],
  },
  {
    label: "Operations",
    module: "operations",
    children: [
      { title: "Active Loads", description: "In-progress shipments", href: "/operations/active" },
      { title: "Delivered", description: "Completed deliveries", href: "/operations/delivered" },
      { title: "All Loads", description: "Full load history & details", href: "/operations/loads" },
    ],
  },
  {
    label: "Recruiting",
    module: "recruiting",
    children: [
      { title: "Units", description: "Fleet unit registry", href: "/recruiting/units" },
      { title: "Drivers", description: "Roster, assignments & details", href: "/recruiting/drivers" },
      { title: "Owners", description: "Owner-operator records", href: "/recruiting/owners" },
    ],
  },
  { label: "Accounting", href: "/accounting", module: "accounting" },
  { label: "Users", href: "/users", module: "users" },
];

function NavDropdownItem({
  label,
  items,
  isActive,
}: {
  label: string;
  items: DropdownChild[];
  isActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    openTimerRef.current = setTimeout(() => setOpen(true), 60);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    closeTimerRef.current = setTimeout(() => setOpen(false), 140);
  }, []);

  return (
    <li
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        aria-haspopup="menu"
        aria-expanded={open}
        className={`nav-link inline-flex items-center gap-[6px] px-[10px] py-[8px] rounded-[8px] text-[13.5px] font-medium whitespace-nowrap relative transition-colors duration-150${isActive ? " active" : ""}`}
        style={{ letterSpacing: "-0.005em" }}
      >
        {label}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{
            opacity: 0.6,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.18s ease",
            flexShrink: 0,
          }}
        >
          <path d="M3 4.5L6 7.5L9 4.5" />
        </svg>
      </button>

      <div
        role="menu"
        className="nav-dropdown absolute left-0 min-w-[260px] rounded-[14px] p-[6px] z-50"
        style={{
          top: "calc(100% + 6px)",
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0)" : "translateY(-4px)",
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.14s ease, transform 0.14s ease",
        }}
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            role="menuitem"
            className="nav-dropdown-item px-[10px] py-[9px] rounded-[8px] transition-colors duration-[120ms]"
            style={{ border: "none" }}
          >
            <div
              className="nav-dropdown-title text-[13.5px] font-medium"
              style={{ letterSpacing: "-0.005em" }}
            >
              {item.title}
            </div>
            <div className="nav-dropdown-desc text-[12px] leading-[1.35] mt-[2px]">
              {item.description}
            </div>
          </Link>
        ))}
      </div>
    </li>
  );
}

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const role = session?.user?.role as Role | undefined;

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const initials =
    (session?.user?.name ?? "")
      .split(" ")
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "?";

  function isItemActive(item: NavItem): boolean {
    if ("children" in item) return item.children.some((c) => pathname.startsWith(c.href));
    return item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
  }

  return (
    <header
      className="nav"
      style={{
        height: 56,
        borderBottom: "1px solid var(--nav-line)",
        background: "var(--nav-bg)",
        display: "flex",
        alignItems: "center",
        paddingLeft: 24,
        paddingRight: 24,
        gap: 18,
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        isolation: "isolate",
        flexShrink: 0,
      }}
    >
      {/* Brand */}
      <Link
        href="/"
        style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", flexShrink: 0 }}
      >
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: "var(--nav-fg)",
            color: "var(--nav-bg)",
            display: "grid",
            placeItems: "center",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            userSelect: "none",
            flexShrink: 0,
          }}
        >
          N
        </span>
        <span
          style={{
            fontSize: 14.5,
            fontWeight: 600,
            letterSpacing: "-0.015em",
            color: "var(--nav-fg)",
            whiteSpace: "nowrap",
          }}
        >
          PipoTrack
        </span>
      </Link>

      {/* Vertical divider */}
      <span
        aria-hidden="true"
        style={{
          width: 1,
          height: 20,
          background: "var(--nav-line-strong)",
          flexShrink: 0,
        }}
      />

      {/* Nav list */}
      <ul
        style={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          listStyle: "none",
          margin: 0,
          padding: 0,
        }}
      >
        {NAV_ITEMS.map((item) => {
          if ("children" in item) {
            if (role && !canAccess(role, item.module as Parameters<typeof canAccess>[1])) return null;
            return (
              <NavDropdownItem
                key={item.label}
                label={item.label}
                items={item.children}
                isActive={isItemActive(item)}
              />
            );
          }

          if (item.module && role && !canAccess(role, item.module as Parameters<typeof canAccess>[1])) return null;

          const active = isItemActive(item);
          return (
            <li key={item.href} className="relative">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`nav-link inline-flex items-center px-[10px] py-[8px] rounded-[8px] text-[13.5px] font-medium whitespace-nowrap relative transition-colors duration-150${active ? " active" : ""}`}
                style={{ letterSpacing: "-0.005em" }}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Avatar + user menu */}
      <div ref={userMenuRef} className="relative" style={{ flexShrink: 0 }}>
        <button
          onClick={() => setUserMenuOpen((v) => !v)}
          title={session?.user?.name ?? "User menu"}
          style={{
            width: 32,
            height: 32,
            borderRadius: "999px",
            background: "var(--nav-fg)",
            color: "var(--nav-bg)",
            display: "grid",
            placeItems: "center",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.02em",
            userSelect: "none",
            border: "none",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {initials}
        </button>

        {userMenuOpen && (
          <div
            className="nav-dropdown absolute right-0 min-w-[220px] rounded-[14px] p-[6px] z-50"
            style={{ top: "calc(100% + 6px)" }}
          >
            <div
              style={{
                padding: "9px 10px 11px",
                borderBottom: "1px solid var(--nav-line)",
                marginBottom: 4,
              }}
            >
              <p
                className="nav-dropdown-title text-[13.5px] font-medium truncate"
                style={{ letterSpacing: "-0.005em" }}
              >
                {session?.user?.name}
              </p>
              <p className="nav-dropdown-desc text-[12px] leading-[1.35] mt-[2px] truncate">
                {session?.user?.email}
              </p>
              {role && (
                <span
                  className="nav-dropdown-desc inline-block mt-[6px] text-[11px]"
                  style={{
                    padding: "2px 7px",
                    borderRadius: 999,
                    border: "1px solid var(--nav-line-strong)",
                    fontSize: 11,
                  }}
                >
                  {role.charAt(0) + role.slice(1).toLowerCase()}
                </span>
              )}
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="nav-dropdown-item nav-dropdown-title w-full text-left px-[10px] py-[9px] rounded-[8px] text-[13.5px] font-medium transition-colors duration-[120ms]"
              style={{
                letterSpacing: "-0.005em",
                background: "none",
                border: "none",
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
