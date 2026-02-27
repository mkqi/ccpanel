import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useMonitorWs } from './hooks/useMonitorWs';
import { useDataBootstrap } from './hooks/useDataBootstrap';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import InstanceHub from './pages/InstanceHub';
import Console from './pages/Console';
import InstanceOverview from './pages/InstanceOverview';
import NodeManagement from './pages/NodeManagement';
import AuditLogs from './pages/AuditLogs';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function AppShell() {
  // Bootstrap global store data
  useDataBootstrap();
  // Bootstrap WebSocket when authenticated
  useMonitorWs();

  // Listen for 401 Unauthorized API responses globally
  React.useEffect(() => {
    const handleUnauthorized = () => {
      useAuthStore.getState().logout();
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  return <Layout />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/" element={
          <AuthGuard>
            <AppShell />
          </AuthGuard>
        }>
          <Route index element={<Dashboard />} />
          <Route path="instance/:id" element={<InstanceHub />}>
            <Route index element={<InstanceOverview />} />
            <Route path="console" element={<Console />} />
            <Route path="files" element={<div className="text-gray-400 p-8 text-center">File Manager Coming Soon</div>} />
            <Route path="settings" element={<div className="text-gray-400 p-8 text-center">Settings Coming Soon</div>} />
          </Route>

          <Route path="nodes" element={<NodeManagement />} />
          <Route path="users" element={<div className="text-gray-400 p-8 text-center">User Management Coming Soon</div>} />
          <Route path="logs" element={<AuditLogs />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
