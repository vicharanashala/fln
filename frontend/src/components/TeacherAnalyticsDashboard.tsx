import * as React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    ScatterChart,
    Scatter,
    CartesianGrid,
    Cell,
} from 'recharts';
import { useStudentAnalytics } from '../hooks/useStudentAnalytics';
import './TeacherDashboard.css';

export const TeacherAnalyticsDashboard: React.FC = () => {
    const {
        students,
        selectedGrade,
        setSelectedGrade,
        selectedLevel,
        setSelectedLevel,
        distributionData,
        correlationData,
    } = useStudentAnalytics();

    // Filter students who need targeted intervention
    const interventionList = students.filter((s) => (s.scores?.[selectedLevel] ?? 0) < 50);

    return (
        <div className="dashboard-container">
            {/* Top Filter Header */}
            <header className="dashboard-header">
                <div>
                    <h2>📊 Teacher Diagnostic & Progress Tracker</h2>
                    <p>Analyze class baseline proficiency and identify targeted intervention groups.</p>
                </div>
                <div className="filters-bar">
                    <label>
                        Grade:{' '}
                        <select
                            value={selectedGrade}
                            onChange={(e) =>
                                setSelectedGrade(e.target.value === 'all' ? 'all' : Number(e.target.value))
                            }
                        >
                            <option value="all">All Grades</option>
                            <option value={1}>Grade 1</option>
                            <option value={2}>Grade 2</option>
                            <option value={3}>Grade 3</option>
                        </select>
                    </label>
                    <label>
                        Competency Level:{' '}
                        <select
                            value={selectedLevel}
                            onChange={(e) => setSelectedLevel(Number(e.target.value))}
                        >
                            <option value={10}>Level 10: Number Sense</option>
                            <option value={16}>Level 16: Basic Addition</option>
                            <option value={25}>Level 25: Place Value</option>
                            <option value={31}>Level 31: Time & Measurement</option>
                        </select>
                    </label>
                </div>
            </header>

            {/* Metric Cards Row */}
            <div className="metrics-grid">
                <div className="metric-card">
                    <h4>Total Assessed</h4>
                    <span className="metric-value">{students.length}</span>
                </div>
                <div className="metric-card alert">
                    <h4>Needs Intervention</h4>
                    <span className="metric-value">{distributionData[0]?.count ?? 0}</span>
                </div>
                <div className="metric-card success">
                    <h4>Proficient</h4>
                    <span className="metric-value">{distributionData[2]?.count ?? 0}</span>
                </div>
            </div>

            {/* Visual Charts Grid */}
            <div className="charts-grid">
                {/* Chart 1: Proficiency Distribution */}
                <div className="chart-card">
                    <h3>Proficiency Breakdown (Level {selectedLevel})</h3>
                    <div className="chart-wrapper">
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={distributionData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" />
                                <YAxis allowDecimals={false} />
                                <Tooltip
                                    cursor={{ fill: 'currentColor', opacity: 0.08 }}
                                    contentStyle={{
                                        borderRadius: '0.5rem',
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                                    }}
                                />
                                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                                    {distributionData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Chart 2: Attendance vs Score Correlation */}
                <div className="chart-card">
                    <h3>Attendance vs. Overall Performance</h3>
                    <div className="chart-wrapper">
                        <ResponsiveContainer width="100%" height={260}>
                            <ScatterChart>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="attendance"
                                    name="Attendance"
                                    unit="%"
                                    domain={[50, 100]}
                                />
                                <YAxis
                                    dataKey="avgScore"
                                    name="Avg Score"
                                    unit="%"
                                    domain={[0, 100]}
                                />
                                <Tooltip
                                    cursor={{ strokeDasharray: '3 3', stroke: '#64748b' }}
                                    contentStyle={{
                                        borderRadius: '0.5rem',
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                                    }}
                                />
                                <Scatter name="Students" data={correlationData} fill="#6366f1" />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Actionable Student Remediation Table */}
            <div className="table-card">
                <h3>🚨 Students Requiring Targeted Remediation (Level {selectedLevel})</h3>
                {interventionList.length > 0 ? (
                    <table className="remediation-table">
                        <thead>
                            <tr>
                                <th>Student ID</th>
                                <th>Name</th>
                                <th>Grade</th>
                                <th>Level {selectedLevel} Score</th>
                                <th>Action Recommended</th>
                            </tr>
                        </thead>
                        <tbody>
                            {interventionList.map((s) => (
                                <tr key={s.id}>
                                    <td>
                                        <code>{s.id}</code>
                                    </td>
                                    <td>
                                        <strong>{s.name}</strong>
                                    </td>
                                    <td>Grade {s.grade}</td>
                                    <td>
                                        <span className="badge-danger">
                                            {s.scores?.[selectedLevel] ?? 0}%
                                        </span>
                                    </td>
                                    <td>
                                        <button className="btn-action">
                                            Assign Level {selectedLevel} Worksheet
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="empty-state">
                        🎉 All students are performing at or above baseline proficiency for this level!
                    </p>
                )}
            </div>
        </div>
    );
};

export default TeacherAnalyticsDashboard;