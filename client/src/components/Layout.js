import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = {
  superadmin: [
    { to: '/dashboard', label: 'Overview', icon: '📊' },
    { to: '/dashboard/states', label: 'State Analysis', icon: '🗺️' },
    { to: '/dashboard/announcements', label: 'Announcements', icon: '📢' },
    { to: '/dashboard/tickets', label: 'Ticket Queue', icon: '🎫' },
    { to: '/dashboard/logbook', label: 'Audit Log', icon: '📋' },
  ],
  admin: [
    { to: '/dashboard', label: 'State Overview', icon: '📊' },
    { to: '/dashboard/districts', label: 'Districts', icon: '🏛️' },
    { to: '/dashboard/schools', label: 'Schools', icon: '🏫' },
    { to: '/dashboard/tickets', label: 'Tickets', icon: '🎫' },
    { to: '/dashboard/logbook', label: 'Audit Log', icon: '📋' },
  ],
  district_admin: [
    { to: '/dashboard', label: 'District Overview', icon: '📊' },
    { to: '/dashboard/blocks', label: 'Blocks', icon: '🏘️' },
    { to: '/dashboard/schools', label: 'Schools', icon: '🏫' },
    { to: '/dashboard/tickets', label: 'Tickets', icon: '🎫' },
    { to: '/dashboard/logbook', label: 'Audit Log', icon: '📋' },
  ],
  block_admin: [
    { to: '/dashboard', label: 'Block Overview', icon: '📊' },
    { to: '/dashboard/schools', label: 'Schools', icon: '🏫' },
    { to: '/dashboard/volunteers', label: 'Volunteers', icon: '🤝' },
    { to: '/dashboard/generate', label: 'Generate Paper', icon: '📄' },
    { to: '/dashboard/history', label: 'Worksheet History', icon: '📋' },
    { to: '/dashboard/tickets', label: 'Tickets', icon: '🎫' },
    { to: '/dashboard/logbook', label: 'Audit Log', icon: '📋' },
  ],
  school: [
    { to: '/dashboard', label: 'School Overview', icon: '📊' },
    { to: '/dashboard/classes', label: 'Classes', icon: '📚' },
    { to: '/dashboard/students', label: 'Students', icon: '👨‍🎓' },
    { to: '/dashboard/teachers', label: 'Teachers', icon: '👩‍🏫' },
    { to: '/dashboard/generate', label: 'Generate Paper', icon: '📄' },
    { to: '/dashboard/history', label: 'Worksheet History', icon: '📋' },
    { to: '/dashboard/tickets', label: 'Tickets', icon: '🎫' },
  ],
  teacher: [
    { to: '/dashboard', label: 'My Classes', icon: '📊' },
    { to: '/dashboard/students', label: 'Students', icon: '👨‍🎓' },
    { to: '/dashboard/generate', label: 'Generate Question Paper', icon: '📄' },
    { to: '/dashboard/history', label: 'Worksheet History', icon: '📋' },
    { to: '/dashboard/reports', label: 'Reports', icon: '📈' },
    { to: '/dashboard/tickets', label: 'Submit Feedback', icon: '💬' },
  ],
  volunteer: [
    { to: '/dashboard', label: 'Assigned Schools', icon: '📊' },
    { to: '/dashboard/generate', label: 'Generate Paper', icon: '📄' },
    { to: '/dashboard/scan', label: 'Scan & Upload', icon: '📷' },
    { to: '/dashboard/logbook', label: 'History', icon: '📋' },
    { to: '/dashboard/tickets', label: 'Submit Feedback', icon: '💬' },
  ],
};

function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const items = navItems[user?.role] || [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">FLN Platform</div>
        <nav className="sidebar-nav">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => isActive ? 'active' : ''}
              end={item.to === '/dashboard'}
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <strong>{user?.name}</strong>
            <span style={{ textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ')}</span>
          </div>
          <button onClick={handleLogout} className="logout-btn">🚪 Logout</button>
        </div>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

export default Layout;
