import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { SuperAdminDashboard } from './pages/SuperAdminDashboard';
import { TeacherDashboard } from './pages/TeacherDashboard';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Loading…</div>;
  }
  if (!user) return <LoginPage />;

  return (
    <Layout>
      {user.role === 'superadmin' ? <SuperAdminDashboard /> : <TeacherDashboard />}
    </Layout>
  );
}
