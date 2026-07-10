import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { analytics } from '../../services/api';

function HomePage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    states: 0, districts: 0, schools: 0,
    students: 0, assessments: 0, flnScore: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await analytics.national();
        setStats({
          states: 10, districts: 50, schools: 1000,
          students: res.data.totalStudents || 50000,
          assessments: res.data.totalAssessments || 150000,
          flnScore: res.data.nationalFLNScore || 65
        });
      } catch {
        setStats({ states: 10, districts: 50, schools: 1000, students: 50000, assessments: 150000, flnScore: 65 });
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="home-page">
      <header style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
        <button className="btn btn-primary" onClick={() => navigate('/login')}>Login</button>
      </header>

      <section className="home-hero">
        <h1>Foundational Literacy & Numeracy</h1>
        <p>Assessment for Every Child, at Their Level — An AI-driven platform supporting India's FLN mission through personalized assessments and targeted learning interventions.</p>
        <button className="btn btn-primary" onClick={() => navigate('/login')}>
          Get Started →
        </button>
      </section>

      <div className="home-stats">
        <div className="home-stat-card">
          <div className="value">{stats.states}</div>
          <div className="label">States</div>
        </div>
        <div className="home-stat-card">
          <div className="value">{stats.districts}</div>
          <div className="label">Districts</div>
        </div>
        <div className="home-stat-card">
          <div className="value">{stats.schools.toLocaleString()}</div>
          <div className="label">Schools</div>
        </div>
        <div className="home-stat-card">
          <div className="value">{stats.students.toLocaleString()}+</div>
          <div className="label">Students</div>
        </div>
        <div className="home-stat-card">
          <div className="value">{stats.assessments.toLocaleString()}+</div>
          <div className="label">Assessments</div>
        </div>
        <div className="home-stat-card">
          <div className="value">{stats.flnScore}%</div>
          <div className="label">National FLN Score</div>
        </div>
      </div>

      <section className="home-section">
        <h2>Our Vision & Mission</h2>
        <p>To ensure every child in India achieves foundational literacy and numeracy by 2026-2027 through data-driven, personalized assessment and learning interventions. The platform supports three assessment cycles per academic year — Baseline, Mid-Year, and End-Year — enabling continuous tracking and targeted support for every student.</p>
      </section>

      <section className="home-section">
        <h2>How It Works</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
          <div className="card">
            <h3>📝 Assess</h3>
            <p>Three fixed cycles per year: Baseline (diagnostic), Mid-Year, and End-Year assessments.</p>
          </div>
          <div className="card">
            <h3>🤖 AI Evaluation</h3>
            <p>Intelligent evaluation after every assessment updates each student's FLN level automatically.</p>
          </div>
          <div className="card">
            <h3>📄 Personalized Worksheets</h3>
            <p>AI generates worksheets at each student's current FLN level, adapted to their unique learning needs.</p>
          </div>
          <div className="card">
            <h3>📊 Track Progress</h3>
            <p>National-to-student level analytics with certification when competency requirements are met.</p>
          </div>
        </div>
      </section>

      <footer style={{ textAlign: 'center', padding: '2rem', color: '#6b7280', borderTop: '1px solid #e5e7eb', marginTop: '3rem' }}>
        <p>About · Contact · Privacy Policy</p>
        <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>© {new Date().getFullYear()} FLN Assessment Platform</p>
      </footer>
    </div>
  );
}

export default HomePage;
