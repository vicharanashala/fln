import { useAuth } from "../../contexts/AuthContext";
import { Mail, Phone, MapPin, Calendar, Shield, Edit, LogOut } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  return (
    <div className="space-y-5">
      <PageHeader title="My Profile" actions={<Button variant="secondary"><Edit className="w-4 h-4" /> Edit Profile</Button>} />

      <Card noPadding>
        <div className="h-28 bg-gradient-to-r from-blue-500 to-blue-600 rounded-t-xl" />
        <div className="px-6 pb-5 -mt-12">
          <div className="flex items-end gap-4">
            <div className="w-20 h-20 rounded-2xl bg-white p-1 shadow-md">
              <div className="w-full h-full rounded-xl bg-blue-600 text-white grid place-items-center text-2xl font-bold">
                SA
              </div>
            </div>
            <div className="flex-1 pt-12">
              <h2 className="text-lg font-semibold text-slate-900">{user?.firstName} {user?.lastName}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge tone="purple">Super Admin</Badge>
                <Badge tone="green" withDot>Active</Badge>
              </div>
            </div>
            <Button variant="danger" onClick={logout}><LogOut className="w-4 h-4" /> Logout</Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Contact Information">
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-slate-400" />
              <span>{user?.email}</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-slate-400" />
              <span>+91 98XXX XXXXX</span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span>New Delhi, India</span>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>Joined January 2024</span>
            </div>
          </div>
        </Card>

        <Card title="Permissions">
          <div className="space-y-2">
            {["Full system access", "User management", "All reports access", "AI template generation", "Audit log access", "System settings"].map((p) => (
              <div key={p} className="flex items-center gap-2 text-xs">
                <Shield className="w-3.5 h-3.5 text-green-600" />
                <span>{p}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Recent Activity">
        <div className="divide-y divide-slate-100">
          {[
            { action: "Logged in", module: "Authentication", time: "Just now" },
            { action: "Viewed National Dashboard", module: "Dashboard", time: "2 minutes ago" },
            { action: "Created Assessment", module: "Assessments", time: "1 hour ago" },
            { action: "Approved AI Template", module: "Templates", time: "Yesterday" },
          ].map((a, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <div className="flex-1">
                <p className="text-xs font-medium">{a.action}</p>
                <p className="text-[10px] text-slate-500">{a.module} · {a.time}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}