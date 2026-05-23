import Navbar from "@/components/layout/Navbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 px-6 py-8" style={{ paddingTop: "calc(56px + 2rem)" }}>{children}</main>
    </div>
  );
}
