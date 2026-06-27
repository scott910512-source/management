import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MapPage } from './pages/MapPage';
import { StatsPage } from './pages/StatsPage';
import { WishlistPage } from './pages/WishlistPage';
import { TimelinePage } from './pages/TimelinePage';
import { GalleryPage } from './pages/GalleryPage';
import { BadgesPage } from './pages/BadgesPage';
import { AdminPage } from './pages/AdminPage';
import { SettingsPage } from './pages/SettingsPage';

function FullscreenSpinner() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand/30 border-t-brand" />
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <FullscreenSpinner />;

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <DataProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/badges" element={<BadgesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          {user.role === 'ADMIN' && <Route path="/admin" element={<AdminPage />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </DataProvider>
  );
}
