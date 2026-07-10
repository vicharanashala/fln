import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './services/api';
import { AuthContext } from './context/AuthContext';
import HomePage from './pages/home/HomePage';
import LoginPage from './pages/login/LoginPage';
import TeacherDashboard from './pages/dashboards/TeacherDashboard';
import GenerateQuestionPaper from './pages/dashboards/GenerateQuestionPaper';
import SuperadminDashboard from './pages/dashboards/SuperadminDashboard';
import AdminDashboard from './pages/dashboards/AdminDashboard';
import DistrictAdminDashboard from './pages/dashboards/DistrictAdminDashboard';
import BlockAdminDashboard from './pages/dashboards/BlockAdminDashboard';
import SchoolDashboard from './pages/dashboards/SchoolDashboard';
import VolunteerDashboard from './pages/dashboards/VolunteerDashboard';
import Layout from './components/Layout';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    try {
      const res = await auth.getMe();
      setUser(res.data.user);
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = async (email, password) => {
    const res = await auth.login({ email, password });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard/*" element={
          user ? (
            <DashboardRouter user={user} />
          ) : (
            <Navigate to="/login" />
          )
        } />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AuthContext.Provider>
  );
}

function DashboardRouter({ user }) {
  const role = user.role;
  
  if (role === 'superadmin') return <SuperadminDashboard />;
  if (role === 'admin') return <AdminDashboard />;
  if (role === 'district_admin') return <DistrictAdminDashboard />;
  if (role === 'block_admin') return <BlockAdminDashboard />;
  if (role === 'school') return <SchoolDashboard />;
  if (role === 'teacher') return <TeacherDashboard />;
  if (role === 'volunteer') return <VolunteerDashboard />;
  
  return <Navigate to="/login" />;
}

export default App;
