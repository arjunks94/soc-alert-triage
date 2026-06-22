import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { WallboardSessionKeepalive } from './components/WallboardSessionKeepalive';
import { LoginPage } from './pages/LoginPage';
import { WallboardLoginPage } from './pages/WallboardLoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { AlertsPage } from './pages/AlertsPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { EndpointsPage } from './pages/EndpointsPage';
import { ThreatsPage } from './pages/ThreatsPage';
import { AnalystsPage } from './pages/AnalystsPage';
import { SettingsPage } from './pages/SettingsPage';
import { WallboardPage } from './pages/WallboardPage';
import { EventsPage } from './pages/EventsPage';
import { useAuthStore } from './stores/authStore';
import { useWallboardAuthStore } from './stores/wallboardAuthStore';
import { isWallboardHost } from './utils/wallboard';

function WallboardApp() {
  const isAuthenticated = useWallboardAuthStore((s) => s.isAuthenticated());

  return (
    <>
      <WallboardSessionKeepalive />
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <WallboardLoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <WallboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function MainApp() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/wallboard" element={<ProtectedRoute><WallboardPage /></ProtectedRoute>} />
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
        <Route path="/events" element={<EventsPage />} />
        <Route path="/threats" element={<ThreatsPage />} />
        <Route path="/analysts" element={<AnalystsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return isWallboardHost() ? <WallboardApp /> : <MainApp />;
}
