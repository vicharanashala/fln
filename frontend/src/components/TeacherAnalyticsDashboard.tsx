import * as React from 'react';
import { useStudentAnalytics } from '../hooks/useStudentAnalytics';
import './TeacherDashboard.css';

export const TeacherAnalyticsDashboard: React.FC = () => {
    const {
        classes,
        selectedClassId,
        setSelectedClassId,
        selectedCompetency,
        setSelectedCompetency,
        analytics,
        visibleCompetencies,
        loading,
        error,
    } = useStudentAnalytics();

    if (loading && !analytics) {
        return (
            <div className="dashboard-container">
                <div className="chart-card dashboard-status">Loading class analytics...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard-container">
                <div className="chart-card dashboard-status dashboard-error">
                    <h3>Unable to load teacher analytics</h3>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    if (!analytics) {
        return (
            <div className="dashboard-container">
                <div className="chart-card dashboard-status">
                    <h3>No class available</h3>
                    <p>There are no classes available for your account yet.</p>
                </div>
            </div>
        );
    }

    const competencyOptions = analytics.competencies;
    const priorityGaps = analytics.priorityGaps;

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div>
                    <h2>Teacher Learning Insights</h2>
                    <p>
                        Review class-level learning progress and prioritise competencies that need instructional support.
                    </p>
                </div>

                <div className="filters-bar">
                    <label>
                        Class:
                        <select
                            value={selectedClassId}
                            onChange={(event) => setSelectedClassId(event.target.value)}
                        >
                            {classes.map((cls) => (
                                <option key={cls.id} value={cls.id}>
                                    {cls.className} - Section {cls.section}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        Competency:
                        <select
                            value={selectedCompetency}
                            onChange={(event) => setSelectedCompetency(event.target.value)}
                        >
                            <option value="all">All Competencies</option>
                            {competencyOptions.map((competency) => (
                                <option key={competency.name} value={competency.name}>
                                    {competency.name}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </header>

            <div className="metrics-grid">
                <div className="metric-card">
                    <h4>Total Students</h4>
                    <span className="metric-value">{analytics.totalStudents}</span>
                </div>
                <div className="metric-card">
                    <h4>Students Assessed</h4>
                    <span className="metric-value">{analytics.totalAssessed}</span>
                </div>
                <div className="metric-card success">
                    <h4>Class Score</h4>
                    <span className="metric-value">{analytics.overallMastery}%</span>
                </div>
                <div className="metric-card alert">
                    <h4>Priority Gaps</h4>
                    <span className="metric-value">{priorityGaps.length}</span>
                </div>
            </div>

            <div className="charts-grid">
                <section className="chart-card">
                    <h3>Competency Performance</h3>

                    <div className="competency-list">
                        {visibleCompetencies.length === 0 ? (
                            <p className="empty-state">
                                No competency results are available for this selection.
                            </p>
                        ) : (
                            visibleCompetencies.map((competency) => (
                                <div className="competency-row" key={competency.name}>

                                    <div className="competency-heading">
                                        <strong>{competency.name}</strong>
                                        <span>{competency.assessedStudents} assessed</span>
                                    </div>

                                    {/* Segmented performance bar */}
                                    <div
                                        className="performance-bar"
                                        aria-label={`${competency.name}: ${competency.masteryPct}% strong, ${competency.satisfactoryPct}% satisfactory, ${competency.needsPracticePct}% need practice`}
                                    >
                                        {competency.masteryPct > 0 && (
                                            <div
                                                className="performance-segment strong-segment"
                                                style={{
                                                    width: `${competency.masteryPct}%`,
                                                }}
                                            />
                                        )}

                                        {competency.satisfactoryPct > 0 && (
                                            <div
                                                className="performance-segment satisfactory-segment"
                                                style={{
                                                    width: `${competency.satisfactoryPct}%`,
                                                }}
                                            />
                                        )}

                                        {competency.needsPracticePct > 0 && (
                                            <div
                                                className="performance-segment needs-practice-segment"
                                                style={{
                                                    width: `${competency.needsPracticePct}%`,
                                                }}
                                            />
                                        )}
                                    </div>

                                    {/* Color-coded values */}
                                    <div className="competency-values">
                                        <span className="metric-strong">
                                            <span className="metric-dot strong-dot"></span>
                                            {competency.masteryPct}% strong
                                        </span>

                                        <span className="metric-satisfactory">
                                            <span className="metric-dot satisfactory-dot"></span>
                                            {competency.satisfactoryPct}% satisfactory
                                        </span>

                                        <span className="metric-needs-practice">
                                            <span className="metric-dot needs-practice-dot"></span>
                                            {competency.needsPracticePct}% need practice
                                        </span>
                                    </div>

                                </div>
                            ))
                        )}
                    </div>
                </section>

                <section className="chart-card">
                    <h3>Progress Across Assessment Cycles</h3>

                    <div className="progress-list">
                        {analytics.progress.length === 0 ? (
                            <p className="empty-state">
                                No assessment-cycle history is available yet.
                            </p>
                        ) : (
                            analytics.progress.map((point) => (
                                <div className="progress-row" key={point.cycle}>
                                    <div>
                                        <strong>{point.cycle}</strong>
                                        <span> {point.assessedStudents} assessments</span>
                                    </div>

                                    <strong className="cycle-score">
                                        {point.masteryPct}%
                                    </strong>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </div>

            <section className="table-card">
                <h3>Priority Learning Gaps</h3>

                <p className="section-description">
                    These are class-level competencies with the highest share of
                    assessment results marked “Needs Practice”.
                </p>

                {priorityGaps.length === 0 ? (
                    <p className="empty-state">
                        No priority learning gaps detected from the available assessments.
                    </p>
                ) : (
                    <div className="gap-list">
                        {priorityGaps.map((gap) => (
                            <div className="gap-row" key={gap.name}>
                                <div>
                                    <strong>{gap.name}</strong>
                                    <span>{gap.assessedStudents} assessed</span>
                                </div>

                                <div className="gap-metrics">
                                    <span className="badge-danger">
                                        <span className="metric-dot needs-practice-dot"></span>
                                        {gap.needsPracticePct}% need practice
                                    </span>

                                    <span className="metric-strong">
                                        <span className="metric-dot strong-dot"></span>
                                        {gap.masteryPct}% strong
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default TeacherAnalyticsDashboard;
