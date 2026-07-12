import { useState } from "react";
import { Save, RefreshCw, Database, Mail, Cpu, Shield, BookOpen } from "lucide-react";
import toast from "react-hot-toast";
import { ACADEMIC_YEARS, GRADES, SUBJECTS, LANGUAGES, ASSESSMENT_TYPES } from "../../mocks/data";
import PageHeader from "../../components/ui/PageHeader";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Badge from "../../components/ui/Badge";

const SECTIONS = [
  { key: "academic", label: "Academic", icon: BookOpen },
  { key: "ai", label: "AI Settings", icon: Cpu },
  { key: "email", label: "Email", icon: Mail },
  { key: "storage", label: "Storage", icon: Database },
  { key: "security", label: "Security", icon: Shield },
];

export default function SettingsPage() {
  const [section, setSection] = useState("academic");

  function save() {
    toast.success("Settings saved");
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="System Settings"
        subtitle="Configure academic, AI, communication, and security settings"
        actions={
          <>
            <Button variant="secondary"><RefreshCw className="w-4 h-4" /> Reset</Button>
            <Button onClick={save}><Save className="w-4 h-4" /> Save Changes</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1">
          <Card noPadding>
            <div className="p-1.5 space-y-0.5">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.key}
                    onClick={() => setSection(s.key)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition ${
                      section === s.key ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-4">
          {section === "academic" && (
            <>
              <Card title="Academic Years">
                <div className="space-y-2">
                  {ACADEMIC_YEARS.map((y) => (
                    <div key={y} className="flex items-center justify-between p-2.5 border border-slate-100 rounded-lg">
                      <div>
                        <p className="text-xs font-medium">Academic Year {y}</p>
                        <p className="text-[10px] text-slate-500">{y === "2025-26" ? "Active" : "Archived"}</p>
                      </div>
                      <Badge tone={y === "2025-26" ? "green" : "slate"}>{y === "2025-26" ? "Active" : "Inactive"}</Badge>
                    </div>
                  ))}
                  <Button variant="secondary" size="sm">+ Add Academic Year</Button>
                </div>
              </Card>

              <Card title="Grades" subtitle="Grade levels supported in the platform">
                <div className="grid grid-cols-4 gap-2">
                  {GRADES.map((g) => (
                    <div key={g} className="border border-slate-200 rounded-lg p-2.5 text-center">
                      <p className="text-xs font-medium">{g}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Subjects & Languages">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Subjects</label>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {SUBJECTS.map((s) => <Badge key={s} tone="blue">{s}</Badge>)}
                    </div>
                  </div>
                  <div>
                    <label className="label">Languages</label>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {LANGUAGES.map((l) => <Badge key={l} tone="purple">{l}</Badge>)}
                    </div>
                  </div>
                </div>
              </Card>

              <Card title="Question Types & Assessment Types">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Question Types</label>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {["MCQ", "True/False", "Fill in Blanks", "Short Answer", "Long Answer", "Match", "Drawing", "Trace"].map((q) => (
                        <Badge key={q} tone="orange">{q}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label">Assessment Types</label>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {ASSESSMENT_TYPES.map((a) => <Badge key={a} tone="green">{a}</Badge>)}
                    </div>
                  </div>
                </div>
              </Card>
            </>
          )}

          {section === "ai" && (
            <Card title="AI Configuration" subtitle="Configure Gemini and OCR providers">
              <div className="space-y-3">
                <Input label="Gemini API Key" type="password" placeholder="••••••••••••••••" />
                <Input label="Gemini Model" defaultValue="gemini-2.0-flash" />
                <Input label="OCR Language (default)" defaultValue="eng+hin" hint="Tesseract language codes" />
                <div className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded" id="hf" />
                  <label htmlFor="hf" className="text-xs">Enable Hugging Face fallback</label>
                </div>
                <Input label="Hugging Face API Key" type="password" placeholder="hf_••••" />
              </div>
            </Card>
          )}

          {section === "email" && (
            <Card title="Email Settings">
              <div className="grid grid-cols-2 gap-3">
                <Input label="SMTP Host" defaultValue="smtp.gmail.com" />
                <Input label="SMTP Port" type="number" defaultValue={587} />
                <Input label="Username" />
                <Input label="Password" type="password" />
                <Input label="From Name" defaultValue="FLN Platform" />
                <Input label="From Email" defaultValue="noreply@fln.org" />
              </div>
            </Card>
          )}

          {section === "storage" && (
            <Card title="Storage Configuration">
              <div className="space-y-3">
                <div>
                  <label className="label">Storage Provider</label>
                  <select className="input mt-1">
                    <option>AWS S3</option><option>Google Cloud Storage</option><option>Local</option>
                  </select>
                </div>
                <Input label="Bucket / Path" defaultValue="fln-prod-storage" />
                <Input label="Max Upload Size (MB)" type="number" defaultValue={50} />
                <Input label="CDN URL" defaultValue="https://cdn.fln.org" />
              </div>
            </Card>
          )}

          {section === "security" && (
            <Card title="Security & Permissions">
              <div className="space-y-3">
                <Input label="JWT Secret" type="password" defaultValue="••••••••••••••••" />
                <Input label="JWT Expiry (days)" type="number" defaultValue={7} />
                <div className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded" id="2fa" />
                  <label htmlFor="2fa" className="text-xs">Require 2FA for super admins</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded" id="audit" />
                  <label htmlFor="audit" className="text-xs">Enable audit log on all write operations</label>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}