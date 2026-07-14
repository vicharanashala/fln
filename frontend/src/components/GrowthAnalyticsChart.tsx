import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { TrendingUp, Users } from 'lucide-react';

interface GrowthHistory {
  phase: string;
  evaluationDate: string;
  literacyScore: number;
  numeracyScore: number;
  combinedLVI: number;
}

interface StudentGrowth {
  studentId: string;
  childName: string;
  classLevel: string;
  history: GrowthHistory[];
}

interface GrowthAnalyticsChartProps {
  classId: string;
  token: string;
}

const COLORS = [
  '#4F46E5', '#10B981', '#F59E0B', '#EF4444', 
  '#8B5CF6', '#EC4899', '#06B6D4', '#EAB308',
  '#6366F1', '#14B8A6'
];

export const GrowthAnalyticsChart: React.FC<GrowthAnalyticsChartProps> = ({ classId, token }) => {
  const [data, setData] = useState<StudentGrowth[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [metricView, setMetricView] = useState<'combinedLVI' | 'literacyScore' | 'numeracyScore'>('combinedLVI');

  useEffect(() => {
    const fetchGrowth = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/classes/${classId}/growth`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const resData: StudentGrowth[] = await res.json();
          setData(resData);
          // Default select up to 5 students to keep the chart clean initially
          if (resData.length > 0) {
            setSelectedStudents(resData.slice(0, 5).map(s => s.studentId));
          }
        } else {
          console.error('Failed to load growth analytics');
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    if (classId && token) {
      fetchGrowth();
    }
  }, [classId, token]);

  const toggleStudent = (id: string) => {
    setSelectedStudents(prev => 
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const chartData = useMemo(() => {
    const phasesSet = new Set<string>();
    const selectedData = data.filter(s => selectedStudents.includes(s.studentId));
    
    selectedData.forEach(s => s.history.forEach(h => phasesSet.add(h.phase)));
    const phases = Array.from(phasesSet).sort();

    return phases.map(phase => {
      const point: any = { name: phase };
      selectedData.forEach(student => {
        const h = student.history.find(x => x.phase === phase);
        if (h) {
          point[student.childName] = h[metricView];
        }
      });
      return point;
    });
  }, [data, selectedStudents, metricView]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-12 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
        <p className="text-sm font-mono text-zinc-500 animate-pulse">Aggregating Growth Analytics...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col w-full mt-6">
      {/* Header & Controls */}
      <div className="p-5 border-b border-zinc-100 bg-zinc-50/50 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-display font-semibold text-zinc-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            Performance Growth Analytics
          </h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-md leading-relaxed">
            Track multi-phase learning velocity across students. Toggle between combined LVI or subject-specific trajectories to spot anomalies.
          </p>
        </div>

        <div className="flex flex-col gap-3 min-w-[200px]">
          {/* Metric Toggle */}
          <div className="flex p-1 bg-zinc-200/60 rounded-lg">
             <button 
               onClick={() => setMetricView('combinedLVI')} 
               className={`flex-1 text-[10px] font-bold uppercase rounded py-1.5 transition-colors ${metricView === 'combinedLVI' ? 'bg-white shadow-sm text-indigo-700' : 'text-zinc-500 hover:text-zinc-700'}`}
             >
               Combined LVI
             </button>
             <button 
               onClick={() => setMetricView('literacyScore')} 
               className={`flex-1 text-[10px] font-bold uppercase rounded py-1.5 transition-colors ${metricView === 'literacyScore' ? 'bg-white shadow-sm text-emerald-700' : 'text-zinc-500 hover:text-zinc-700'}`}
             >
               Literacy
             </button>
             <button 
               onClick={() => setMetricView('numeracyScore')} 
               className={`flex-1 text-[10px] font-bold uppercase rounded py-1.5 transition-colors ${metricView === 'numeracyScore' ? 'bg-white shadow-sm text-amber-700' : 'text-zinc-500 hover:text-zinc-700'}`}
             >
               Numeracy
             </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 min-h-[350px]">
        {/* Chart Area */}
        <div className="lg:col-span-3 p-5 pt-8 relative">
          {selectedStudents.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm font-mono text-zinc-400">
              Select at least one student to view growth trajectories.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: '#6B7280' }} 
                  axisLine={false} 
                  tickLine={false} 
                  dy={10} 
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#6B7280' }} 
                  axisLine={false} 
                  tickLine={false} 
                  domain={[0, 100]} 
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', 
                    fontSize: '12px', 
                    fontWeight: 'bold',
                    backgroundColor: '#fff'
                  }}
                  itemStyle={{ fontSize: '12px', fontWeight: 600 }}
                  labelStyle={{ color: '#6B7280', marginBottom: '8px', fontSize: '11px', textTransform: 'uppercase' }}
                />
                <Legend 
                  iconType="circle" 
                  wrapperStyle={{ fontSize: '11px', fontWeight: 600, paddingTop: '20px' }} 
                />
                
                {data.filter(s => selectedStudents.includes(s.studentId)).map((student, idx) => (
                  <Line 
                    key={student.studentId}
                    type="monotone" 
                    dataKey={student.childName} 
                    stroke={COLORS[selectedStudents.indexOf(student.studentId) % COLORS.length]} 
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    animationDuration={1500}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Student Selector */}
        <div className="lg:col-span-1 border-t lg:border-t-0 lg:border-l border-zinc-100 bg-zinc-50/30 p-4 max-h-[400px] overflow-y-auto">
          <h4 className="text-xs font-mono font-bold text-zinc-500 uppercase mb-3 flex items-center gap-2">
            <Users className="w-3.5 h-3.5" /> Compare Students
          </h4>
          <div className="flex flex-col gap-1.5">
            {data.map((student) => {
              const isSelected = selectedStudents.includes(student.studentId);
              const colorIndex = selectedStudents.indexOf(student.studentId);
              
              return (
                <button
                  key={student.studentId}
                  onClick={() => toggleStudent(student.studentId)}
                  className={`text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between border transition-all ${
                    isSelected 
                      ? 'bg-white border-indigo-200 text-indigo-900 shadow-sm' 
                      : 'bg-transparent border-transparent text-zinc-500 hover:bg-zinc-200/50'
                  }`}
                >
                  <span className="truncate">{student.childName}</span>
                  {isSelected && (
                    <div 
                      className="w-2.5 h-2.5 rounded-full shadow-sm" 
                      style={{ backgroundColor: COLORS[colorIndex % COLORS.length] }} 
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
