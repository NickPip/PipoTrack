"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import type { Role } from "@/generated/prisma/enums";
import { canAccess } from "@/lib/rbac";

type NavItem =
  | { label: string; href: string; module?: string }
  | { label: string; module: string; children: { label: string; href: string }[] };

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/" },
  {
    label: "Dispatch",
    module: "dispatch",
    children: [
      { label: "Bot", href: "/dispatch/bot" },
      { label: "Map", href: "/dispatch/map" },
      { label: "Availabilities", href: "/dispatch/availabilities" },
    ],
  },
  {
    label: "Operations",
    module: "operations",
    children: [
      { label: "Active Loads", href: "/operations/active" },
      { label: "Delivered", href: "/operations/delivered" },
      { label: "All Loads", href: "/operations/loads" },
    ],
  },
  {
    label: "Recruiting",
    module: "recruiting",
    children: [
      { label: "Units", href: "/recruiting/units" },
      { label: "Drivers", href: "/recruiting/drivers" },
      { label: "Owners", href: "/recruiting/owners" },
    ],
  },
  { label: "Accounting", href: "/accounting", module: "accounting" },
  { label: "Users", href: "/users", module: "users" },
];

function DropdownMenu({
  label,
  children,
}: {
  label: string;
  children: { label: string; href: string }[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActive = children.some((c) => pathname.startsWith(c.href));

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
          isActive ? "bg-black text-white" : "text-gray-600 hover:text-gray-900"
        }`}
      >
        {label}
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-44 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-50">
          {children.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`block px-4 py-2 text-sm transition-colors ${
                pathname.startsWith(item.href)
                  ? "text-black font-medium"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const role = session?.user?.role as Role | undefined;

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="h-14 border-b border-gray-100 bg-white flex items-center px-6 gap-6 shrink-0">
      <Link href="/" className="flex items-center justify-center w-8 h-8 rounded-lg bg-black text-white text-sm font-bold">
        N
      </Link>

      <nav className="flex items-center gap-1 flex-1">
        {NAV_ITEMS.map((item) => {
          if ("children" in item) {
            if (role && !canAccess(role, item.module as Parameters<typeof canAccess>[1])) return null;
            return <DropdownMenu key={item.label} label={item.label} children={item.children} />;
          }

          if (item.module && role && !canAccess(role, item.module as Parameters<typeof canAccess>[1])) return null;

          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isActive ? "bg-black text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div ref={userMenuRef} className="relative">
        <button
          onClick={() => setUserMenuOpen((v) => !v)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-700">
            {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
          </div>
        </button>
        {userMenuOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-50">
            <div className="px-4 py-2 border-b border-gray-50">
              <p className="text-sm font-medium text-gray-900 truncate">{session?.user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{session?.user?.email}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
