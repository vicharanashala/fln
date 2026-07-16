import { Calendar, Filter } from "lucide-react";
import { AUDIT_LOGS } from "../../mocks/data";
import type { AuditLog } from "../../types";
import { Column } from "../../components/tables/DataTable";
import PageHeader from "../../components/ui/PageHeader";
import Card from "../../components/ui/Card";
import DataTable from "../../components/tables/DataTable";
import Badge from "../../components/ui/Badge";

const MODULE_TONE: Record<string, "blue" | "green" | "orange" | "purple" | "slate"> = {
  Users: "purple",
  Schools: "blue",
  Assessments: "green",
  Templates: "orange",
  Reports: "slate",
};

const ACTION_TONE: Record<string, "blue" | "green" | "red" | "orange" | "slate"> = {
  Created: "green",
  Updated: "blue",
  Deleted: "red",
  Login: "slate",
  Export: "orange",
};

export default function AuditLogsPage() {
  const columns: Column<AuditLog>[] = [
    { key: "userName", header: "User", sortable: true, render: (r) => <span className="text-xs font-medium">{r.userName}</span> },
    { key: "module", header: "Module", render: (r) => <Badge tone={MODULE_TONE[r.module]}>{r.module}</Badge> },
    { key: "action", header: "Action", sortable: true, render: (r) => <Badge tone={ACTION_TONE[r.action]}>{r.action}</Badge> },
    { key: "timestamp", header: "Timestamp", sortable: true, render: (r) => <span className="text-xs text-slate-600">{new Date(r.timestamp).toLocaleString()}</span> },
    { key: "ipAddress", header: "IP Address", render: (r) => <span className="font-mono text-xs">{r.ipAddress}</span> },
    { key: "status", header: "Status", render: (r) => <Badge tone={r.status === "Success" ? "green" : "red"} withDot>{r.status}</Badge> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit Logs"
        subtitle={`${AUDIT_LOGS.length} recent system events`}
        actions={
          <>
            <button className="btn-secondary h-9 text-xs"><Calendar className="w-3.5 h-3.5" /> Date Range</button>
            <button className="btn-secondary h-9 text-xs"><Filter className="w-3.5 h-3.5" /> More Filters</button>
          </>
        }
      />
      <Card noPadding>
        <DataTable columns={columns} data={AUDIT_LOGS} searchable searchPlaceholder="Search logs…" pageSize={15} />
      </Card>
    </div>
  );
}