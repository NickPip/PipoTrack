"use client";

import dynamic from "next/dynamic";

const DriverMap = dynamic(() => import("@/components/dispatch/DriverMap"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--ink-3)", fontSize: 14 }}>
      Loading map…
    </div>
  ),
});

export default function MapPage() {
  return <DriverMap />;
}
