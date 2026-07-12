type Status = "Active" | "Inactive" | "On Leave" | "Draft" | "Scheduled" | "Active" | "Completed" | "Archived" | "Processing" | "Approved" | string;

const map: Record<string, { tone: "green" | "red" | "orange" | "slate" | "blue" | "purple"; label: string }> = {
  Active: { tone: "green", label: "Active" },
  Inactive: { tone: "red", label: "Inactive" },
  "On Leave": { tone: "orange", label: "On Leave" },
  Draft: { tone: "slate", label: "Draft" },
  Scheduled: { tone: "blue", label: "Scheduled" },
  Completed: { tone: "green", label: "Completed" },
  Archived: { tone: "slate", label: "Archived" },
  Processing: { tone: "orange", label: "Processing" },
  Approved: { tone: "purple", label: "Approved" },
  "Not Generated": { tone: "slate", label: "Not Generated" },
};

import Badge from "./Badge";

export default function StatusChip({ status }: { status: string }) {
  const cfg = map[status] ?? { tone: "slate" as const, label: status };
  return <Badge tone={cfg.tone} withDot>{cfg.label}</Badge>;
}