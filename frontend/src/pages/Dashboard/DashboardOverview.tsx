import { useState } from "react";
import {
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  MapPin, Building2, School, Users, GraduationCap, ClipboardCheck, FileText, Wand, Award, Activity, TrendingUp, ChevronRight, ArrowUp, ArrowDown,
} from "lucide-react";
import StatCard from "../../components/ui/StatCard";
import Card from "../../components/ui/Card";
import {
  NATIONAL, STATES, MONTHLY_ASSESSMENTS, LITERACY_VS_NUMERACY, CLASS_PERFORMANCE,
} from "../../mocks/data";
import { INDIA_MAP_POINTS, scoreColor } from "../../data/indiaMap";

export default function DashboardOverview() {
  const [selectedState, setSelectedState] = useState<string | null>(null);

  const topPerformers = [...STATES].sort((a, b) => b.averageScore - a.averageScore).slice(0, 5);
  const lowestPerformers = [...STATES].sort((a, b) => a.averageScore - b.averageScore).slice(0, 5);
  const districtPerformance = STATES.slice(0, 8).map((s) => ({
    name: s.name.split(" ")[0],
    avg: s.averageScore,
  }));

  const studentShareData = [
    { name: "Primary (1-5)", value: 52 },
    { name: "Upper Primary (6-8)", value: 28 },
    { name: "Secondary (9-10)", value: 15 },
    { name: "Higher Secondary", value: 5 },
  ];
  const COLORS = ["#2563EB", "#10B981", "#F59E0B", "#8B5CF6"];

  const radarData = [
    { metric: "Reading", score: 72 },
    { metric: "Writing", score: 68 },
    { metric: "Arithmetic", score: 65 },
    { metric: "Geometry", score: 58 },
    { metric: "Comprehension", score: 71 },
    { metric: "Vocabulary", score: 75 },
  ];

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">National Overview</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time analytics across {NATIONAL.totalStates} states and {NATIONAL.totalUTs} union territories
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input h-9 text-xs">
            <option>Academic Year 2025-26</option>
            <option>Academic Year 2024-25</option>
          </select>
          <button className="btn-secondary h-9 text-xs">Last 30 days ▾</button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        <StatCard title="States" value={NATIONAL.totalStates} icon={<MapPin className="w-5 h-5" />} iconTone="bg-blue-50 text-blue-600" />
        <StatCard title="Union Territories" value={NATIONAL.totalUTs} icon={<MapPin className="w-5 h-5" />} iconTone="bg-purple-50 text-purple-600" />
        <StatCard title="Districts" value={NATIONAL.totalDistricts.toLocaleString()} icon={<Building2 className="w-5 h-5" />} iconTone="bg-green-50 text-green-600" />
        <StatCard title="Blocks" value={NATIONAL.totalBlocks.toLocaleString()} icon={<Building2 className="w-5 h-5" />} iconTone="bg-orange-50 text-orange-600" />
        <StatCard title="Schools" value={(NATIONAL.totalSchools / 1000).toFixed(0) + "K"} icon={<School className="w-5 h-5" />} iconTone="bg-blue-50 text-blue-600" change="+1,243 this year" changeTone="up" />
        <StatCard title="Teachers" value={(NATIONAL.totalTeachers / 1000).toFixed(0) + "K"} icon={<Users className="w-5 h-5" />} iconTone="bg-indigo-50 text-indigo-600" change="+8,420" changeTone="up" />
        <StatCard title="Students" value={(NATIONAL.totalStudents / 1000000).toFixed(1) + "M"} icon={<GraduationCap className="w-5 h-5" />} iconTone="bg-pink-50 text-pink-600" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard title="Assessments" value={NATIONAL.totalAssessments.toLocaleString()} icon={<ClipboardCheck className="w-5 h-5" />} iconTone="bg-blue-50 text-blue-600" change="+128 this month" changeTone="up" />
        <StatCard title="Answer Scripts" value={(NATIONAL.totalScripts / 1000000).toFixed(2) + "M"} icon={<FileText className="w-5 h-5" />} iconTone="bg-green-50 text-green-600" />
        <StatCard title="AI Templates" value={NATIONAL.aiTemplates.toLocaleString()} icon={<Wand className="w-5 h-5" />} iconTone="bg-purple-50 text-purple-600" change="+42 this week" changeTone="up" />
        <StatCard title="Avg. National Score" value={NATIONAL.averageScore + "%"} icon={<Award className="w-5 h-5" />} iconTone="bg-yellow-50 text-yellow-600" change="+2.3% vs last year" changeTone="up" />
        <StatCard title="Completion Rate" value={NATIONAL.completionRate + "%"} icon={<Activity className="w-5 h-5" />} iconTone="bg-emerald-50 text-emerald-600" change="+4.1% MoM" changeTone="up" />
        <StatCard title="Active Sessions" value="3,247" icon={<TrendingUp className="w-5 h-5" />} iconTone="bg-rose-50 text-rose-600" change="Live" changeTone="neutral" />
      </div>

      {/* India Map + Top performers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="National Performance Map" subtitle="Click a state to drill down" className="lg:col-span-2">
          <div className="relative h-[400px] bg-gradient-to-br from-slate-50 to-blue-50/40 rounded-lg border border-slate-100 overflow-hidden">
            <svg viewBox="0 0 700 700" className="w-full h-full">
              {/* Simplified India outline */}
              <defs>
                <radialGradient id="mapGrad">
                  <stop offset="0%" stopColor="#E2E8F0" />
                  <stop offset="100%" stopColor="#CBD5E1" />
                </radialGradient>
              </defs>
              <path
                d="M 230 100 Q 250 70 310 80 L 400 100 Q 480 95 540 110 L 600 130 Q 640 160 650 220 L 660 280 Q 660 330 630 370 L 580 410 Q 550 440 510 470 L 470 510 Q 440 560 410 600 L 390 640 Q 360 670 320 660 L 280 620 Q 240 580 220 540 L 200 480 Q 180 440 190 400 L 210 360 Q 220 320 200 280 L 190 240 Q 200 200 220 160 Z"
                fill="url(#mapGrad)"
                stroke="#94A3B8"
                strokeWidth="1"
                opacity="0.5"
              />
              {/* State dots */}
              {Object.entries(INDIA_MAP_POINTS).map(([code, p]) => {
                const state = STATES.find((s) => s.id === code);
                if (!state) return null;
                const r = Math.max(8, Math.min(28, state.schoolCount / 8000));
                const color = scoreColor(state.averageScore);
                const isSelected = selectedState === code;
                return (
                  <g
                    key={code}
                    onClick={() => setSelectedState(code)}
                    className="cursor-pointer transition-all"
                  >
                    <circle
                      cx={p.x * 1.05 + 40}
                      cy={p.y * 1.05 + 30}
                      r={r}
                      fill={color}
                      fillOpacity={isSelected ? 0.9 : 0.6}
                      stroke={isSelected ? "#1E40AF" : "white"}
                      strokeWidth={isSelected ? 3 : 1.5}
                      className="hover:fill-opacity-90"
                    />
                    <text
                      x={p.x * 1.05 + 40}
                      y={p.y * 1.05 + 33}
                      textAnchor="middle"
                      className="text-[9px] font-bold pointer-events-none"
                      fill="white"
                    >
                      {state.averageScore}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Legend */}
            <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur rounded-lg p-2.5 border border-slate-200 shadow-sm">
              <p className="text-[10px] font-semibold text-slate-600 mb-1.5">Average Score</p>
              <div className="flex items-center gap-2 text-[10px] text-slate-600">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> &lt;45</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> 45-54</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> 55-64</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> 65-74</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> 75+</span>
              </div>
            </div>
          </div>

          {selectedState && (() => {
            const s = STATES.find((x) => x.id === selectedState);
            if (!s) return null;
            return (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-blue-900">{s.name}</p>
                    <p className="text-[10px] text-blue-700">
                      {s.districtCount} districts · {s.schoolCount.toLocaleString()} schools · {s.studentCount.toLocaleString()} students
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-600">Avg: <b className="text-slate-900">{s.averageScore}%</b></span>
                    <span className="text-slate-600">Literacy: <b className="text-slate-900">{s.literacyScore}%</b></span>
                    <span className="text-slate-600">Numeracy: <b className="text-slate-900">{s.numeracyScore}%</b></span>
                    <button className="text-blue-600 font-medium text-[11px]">Drill down →</button>
                  </div>
                </div>
              </div>
            );
          })()}
        </Card>

        <Card title="Top Performing States">
          <div className="space-y-2.5">
            {topPerformers.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold text-white ${
                  i === 0 ? "bg-yellow-500" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-orange-600" : "bg-slate-300"
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-900 truncate">{s.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: `${s.averageScore}%` }} />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-700">{s.averageScore}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card title="Students by State" subtitle="Top 10 by enrollment" action={<button className="text-[11px] text-blue-600 font-medium">View all</button>}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={[...STATES].sort((a, b) => b.studentCount - a.studentCount).slice(0, 10).map((s) => ({ name: s.name.split(" ")[0], students: s.studentCount / 1000000 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="students" fill="#2563EB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Schools by State" subtitle="Top 10 by school count" action={<button className="text-[11px] text-blue-600 font-medium">View all</button>}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={[...STATES].sort((a, b) => b.schoolCount - a.schoolCount).slice(0, 10).map((s) => ({ name: s.name.split(" ")[0], schools: s.schoolCount / 1000 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="schools" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Assessments per Month" subtitle="Academic Year 2025-26">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={MONTHLY_ASSESSMENTS}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#8B5CF6" fill="url(#g1)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card title="Average FLN Score" subtitle="National trend, last 12 months">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={MONTHLY_ASSESSMENTS.map((m, i) => ({ month: m.month, score: 58 + i * 0.6 + (Math.sin(i) * 2) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis domain={[55, 70]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Literacy vs Numeracy" subtitle="By grade level">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={LITERACY_VS_NUMERACY}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="literacy" fill="#2563EB" radius={[4, 4, 0, 0]} />
              <Bar dataKey="numeracy" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Class-wise Performance" subtitle="Average score by grade">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={CLASS_PERFORMANCE}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="literacy" stroke="#10B981" strokeWidth={2} />
              <Line type="monotone" dataKey="numeracy" stroke="#F97316" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Charts row 3 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card title="District Performance" subtitle="Top 8 states by avg district score">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={districtPerformance} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={70} />
              <Tooltip />
              <Bar dataKey="avg" fill="#06B6D4" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Skill Radar" subtitle="National competency profile">
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#E2E8F0" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
              <PolarRadiusAxis tick={{ fontSize: 9 }} />
              <Radar dataKey="score" stroke="#2563EB" fill="#2563EB" fillOpacity={0.4} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Student Distribution" subtitle="By education level">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={studentShareData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
                {studentShareData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Bottom: Lowest + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Lowest Performing States" className="lg:col-span-1">
          <div className="space-y-2.5">
            {lowestPerformers.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold text-white ${
                  i === 0 ? "bg-red-500" : "bg-slate-400"
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-900 truncate">{s.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500" style={{ width: `${s.averageScore}%` }} />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-700">{s.averageScore}%</span>
                  </div>
                </div>
                <button className="text-[10px] text-blue-600 font-medium flex items-center gap-0.5">
                  Help <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card title="National Trends" subtitle="Year-over-year comparison" className="lg:col-span-2">
          <div className="grid grid-cols-3 gap-4">
            <TrendCard label="Literacy Rate" current="68.4%" change="+3.2%" up icon={<ArrowUp className="w-3 h-3" />} />
            <TrendCard label="Numeracy Rate" current="65.7%" change="+2.8%" up icon={<ArrowUp className="w-3 h-3" />} />
            <TrendCard label="Dropout Rate" current="4.2%" change="-1.1%" up icon={<ArrowDown className="w-3 h-3" />} />
            <TrendCard label="Avg Attendance" current="87.3%" change="+5.4%" up icon={<ArrowUp className="w-3 h-3" />} />
            <TrendCard label="Schools w/ Internet" current="68%" change="+12%" up icon={<ArrowUp className="w-3 h-3" />} />
            <TrendCard label="Female Enrollment" current="48.7%" change="+1.2%" up icon={<ArrowUp className="w-3 h-3" />} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function TrendCard({ label, current, change, up, icon }: { label: string; current: string; change: string; up: boolean; icon: React.ReactNode }) {
  return (
    <div className="border border-slate-100 rounded-lg p-3 hover:border-blue-200 transition">
      <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-slate-900 mt-1">{current}</p>
      <p className={`text-[10px] font-medium mt-1 inline-flex items-center gap-1 ${up ? "text-green-600" : "text-red-600"}`}>
        {icon} {change} vs last year
      </p>
    </div>
  );
}