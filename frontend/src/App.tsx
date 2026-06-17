import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { AlertsPage } from './pages/AlertsPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { EndpointsPage } from './pages/EndpointsPage';
import { ThreatsPage } from './pages/ThreatsPage';
import { AnalystsPage } from './pages/AnalystsPage';
import { SettingsPage } from './pages/SettingsPage';
import { WallboardPage } from './pages/WallboardPage';
import { useAuthStore } from './stores/authStore';

function WallboardRoute() {
  return (
    <ProtectedRoute>
      <WallboardPage />
    </ProtectedRoute>
  );
}

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/wallboard" element={<WallboardRoute />} />
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/incidents" element={<IncidentsPage />} />
        <Route path="/endpoints" element={<EndpointsPage />} />
        <Route path="/threats" element={<ThreatsPage />} />
        <Route path="/analysts" element={<AnalystsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
