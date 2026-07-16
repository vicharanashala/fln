import { UserPlus, MoreVertical, Mail, Lock, Power, Edit } from "lucide-react";
import { USERS } from "../../mocks/data";
import type { User } from "../../types";
import { Column } from "../../components/tables/DataTable";
import PageHeader from "../../components/ui/PageHeader";
import Card from "../../components/ui/Card";
import DataTable from "../../components/tables/DataTable";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";

const ROLE_TONE: Record<string, "purple" | "blue" | "green" | "orange" | "slate"> = {
  superadmin: "purple",
  state_admin: "blue",
  district_admin: "green",
  block_admin: "orange",
  school: "orange",
  teacher: "slate",
  volunteer: "slate",
};

export default function UsersPage() {
  const columns: Column<User>[] = [
    { key: "name", header: "Name", sortable: true, render: (r) => (
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 grid place-items-center text-[10px] font-bold">
          {r.firstName[0]}{r.lastName[0]}
        </div>
        <div>
          <p className="font-medium text-slate-900 text-xs">{r.firstName} {r.lastName}</p>
          <p className="text-[10px] text-slate-500">{r.email}</p>
        </div>
      </div>
    )},
    { key: "role", header: "Role", sortable: true, render: (r) => <Badge tone={ROLE_TONE[r.role]}>{r.role.replace("_", " ")}</Badge> },
    { key: "phone", header: "Phone", render: (r) => <span className="font-mono text-xs">{r.phone || "—"}</span> },
    { key: "isActive", header: "Status", render: (r) => <Badge tone={r.isActive ? "green" : "red"} withDot>{r.isActive ? "Active" : "Inactive"}</Badge> },
    { key: "createdAt", header: "Created", sortable: true, render: (r) => <span className="text-xs text-slate-600">{new Date(r.createdAt).toLocaleDateString()}</span> },
    { key: "id", header: "Actions", width: "180px", render: () => (
      <div className="flex items-center gap-1">
        <button className="text-blue-600 hover:text-blue-700 p-1" title="Edit"><Edit className="w-3.5 h-3.5" /></button>
        <button className="text-slate-500 hover:text-slate-700 p-1" title="Email"><Mail className="w-3.5 h-3.5" /></button>
        <button className="text-orange-500 hover:text-orange-700 p-1" title="Reset password"><Lock className="w-3.5 h-3.5" /></button>
        <button className="text-slate-500 hover:text-slate-700 p-1" title="Activate/Deactivate"><Power className="w-3.5 h-3.5" /></button>
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="User Management"
        subtitle={`${USERS.length} users across all roles`}
        actions={
          <>
            <Button variant="secondary">Import CSV</Button>
            <Button><UserPlus className="w-4 h-4" /> Create User</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {["superadmin", "state_admin", "district_admin", "school", "teacher"].map((role) => {
          const count = USERS.filter((u) => u.role === role).length;
          return (
            <div key={role} className="card p-4">
              <p className="text-xs text-slate-500 capitalize">{role.replace("_", " ")}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{count}</p>
            </div>
          );
        })}
      </div>

      <Card noPadding>
        <DataTable columns={columns} data={USERS} searchable searchPlaceholder="Search users by name, email…" pageSize={15} />
      </Card>
    </div>
  );
}