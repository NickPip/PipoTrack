import { Badge } from "@/components/ui/badge";

const ROLE_STYLES: Record<string, string> = {
  ADMIN: "bg-black text-white hover:bg-black",
  DISPATCHER: "bg-black text-white hover:bg-black",
  RECRUITING: "border border-gray-300 text-gray-700 bg-white hover:bg-white",
  OPERATIONS: "border border-gray-300 text-gray-700 bg-white hover:bg-white",
  ACCOUNTING: "border border-gray-300 text-gray-700 bg-white hover:bg-white",
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  DISPATCHER: "Dispatcher",
  RECRUITING: "Recruiting",
  OPERATIONS: "Operations",
  ACCOUNTING: "Accounting",
};

export default function StatusBadge({ value }: { value: string }) {
  return (
    <Badge className={`text-xs font-medium ${ROLE_STYLES[value] ?? "bg-gray-100 text-gray-600"}`}>
      {ROLE_LABELS[value] ?? value}
    </Badge>
  );
}
