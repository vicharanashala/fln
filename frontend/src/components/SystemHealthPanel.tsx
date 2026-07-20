import React, { useState, useEffect } from 'react';
import { Activity, Database, Users, School, Server, Clock, RefreshCw, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface HealthData {
  status: string;
  timestamp: string;
  uptime: number;
}

interface StatsData {
  totalStates: number;
  totalDistricts: number;
  totalSchools: number;
  totalStudents: number;
  totalUsers: number;
  totalAssessments: number;
  avgFlnLevel: number;
  certifiedCount: number;
  certifiedPercent: number;
}

interface SystemHealthPanelProps {
  token: string;
}

export const SystemHealthPanel: React.FC<SystemHealthPanelProps> = ({ token }) => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [apiLatency, setApiLatency] = useState<number>(0);

  const fetchData = async () => {
    setLoading(true);
    const start = Date.now();
    try {
      const [healthRes, statsRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/stats', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const latency = Date.now() - start;
      setApiLatency(latency);
      if (healthRes.ok) setHealth(await healthRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      setLastRefresh(new Date());
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [token]);
  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const apiStatus = health?.status === 'ok' ? 'healthy' : 'down';
  const dbStatus = stats !== null ? 'connected' : 'unknown';
  const latencyStatus = apiLatency < 200 ? 'fast' : apiLatency < 1000 ? 'moderate' : 'slow';

  const StatusBadge = ({ status }: { status: string }) => {
    const colors = {
      healthy: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800',
      connected: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800',
      fast: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800',
      moderate: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800',
      slow: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800',
      down: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800',
      unknown: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    };
    const icons = {
      healthy: <CheckCircle2 className="h-3 w-3" />,
      connected: <Database className="h-3 w-3" />,
      fast: <CheckCircle2 className="h-3 w-3" />,
      moderate: <AlertTriangle className="h-3 w-3" />,
      slow: <XCircle className="h-3 w-3" />,
      down: <XCircle className="h-3 w-3" />,
      unknown: <AlertTriangle className="h-3 w-3" />,
    };
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${colors[status as keyof typeof colors] || colors.unknown}`}>
        {icons[status as keyof typeof icons]}
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">System Health</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Real-time platform monitoring dashboard</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Service Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">API Server</span>
            </div>
            <StatusBadge status={apiStatus} />
          </div>
          <div className="space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex justify-between"><span>Port</span><span className="font-mono font-bold">3000</span></div>
            <div className="flex justify-between"><span>Uptime</span><span className="font-mono font-bold">{health ? formatUptime(health.uptime) : '—'}</span></div>
            <div className="flex justify-between"><span>Latency</span><span className="font-mono font-bold">{apiLatency}ms</span></div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">MongoDB</span>
            </div>
            <StatusBadge status={dbStatus} />
          </div>
          <div className="space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex justify-between"><span>Database</span><span className="font-mono font-bold">fln</span></div>
            <div className="flex justify-between"><span>Collections</span><span className="font-mono font-bold">14</span></div>
            <div className="flex justify-between"><span>Replica Set</span><span className="font-mono font-bold">Single</span></div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">API Latency</span>
            </div>
            <StatusBadge status={latencyStatus} />
          </div>
          <div className="space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex justify-between"><span>Current</span><span className="font-mono font-bold">{apiLatency}ms</span></div>
            <div className="flex justify-between"><span>Threshold</span><span className="font-mono font-bold">&lt;200ms</span></div>
            <div className="flex justify-between"><span>Last Check</span><span className="font-mono font-bold">{lastRefresh.toLocaleTimeString()}</span></div>
          </div>
        </div>
      </div>

      {/* Data Overview */}
      {stats && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest mb-4">Data Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { icon: School, value: stats.totalSchools.toLocaleString(), label: 'Schools', color: 'text-blue-600 dark:text-blue-400' },
              { icon: Users, value: stats.totalStudents.toLocaleString(), label: 'Students', color: 'text-indigo-600 dark:text-indigo-400' },
              { icon: Users, value: stats.totalUsers.toLocaleString(), label: 'Users', color: 'text-purple-600 dark:text-purple-400' },
              { icon: Activity, value: stats.totalAssessments.toLocaleString(), label: 'Assessments', color: 'text-amber-600 dark:text-amber-400' },
              { icon: CheckCircle2, value: `${stats.certifiedPercent}%`, label: 'Certified', color: 'text-emerald-600 dark:text-emerald-400' },
            ].map(m => (
              <div key={m.label} className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                <m.icon className={`h-5 w-5 mx-auto mb-1 ${m.color}`} />
                <div className="text-xl font-extrabold text-slate-900 dark:text-white">{m.value}</div>
                <div className="text-[9px] font-mono text-slate-400 uppercase tracking-wider mt-0.5">{m.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-4 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex justify-between"><span>States covered</span><span className="font-mono font-bold">{stats.totalStates}</span></div>
            <div className="flex justify-between"><span>Districts covered</span><span className="font-mono font-bold">{stats.totalDistricts}</span></div>
            <div className="flex justify-between"><span>Avg FLN Level</span><span className="font-mono font-bold">L{stats.avgFlnLevel}</span></div>
          </div>
        </div>
      )}

      <div className="text-center text-[10px] text-slate-400 dark:text-slate-500">
        Auto-refreshes every 30 seconds &middot; Last updated {lastRefresh.toLocaleTimeString()}
      </div>
    </div>
  );
};
