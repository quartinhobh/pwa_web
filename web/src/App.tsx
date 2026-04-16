import { lazy, Suspense, useEffect, useState } from 'react';
import { LoadingState } from '@/components/common/LoadingState';
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useParams,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '@/services/firebase';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import InstallPrompt from '@/components/common/InstallPrompt';
import UpdatePrompt from '@/components/common/UpdatePrompt';
import StickerLayer from '@/components/common/StickerLayer';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { GuestUpsellProvider } from '@/contexts/GuestUpsellContext';

// P7-S1 — lazy-load pages so the initial bundle ships only the shell
// (Header/Footer/TabNav/InstallPrompt) + router. Each page becomes its
// own chunk loaded on first navigation.
const Listen = lazy(() => import('@/pages/Listen'));
const Archive = lazy(() => import('@/pages/Archive'));
const EventDetail = lazy(() => import('@/pages/EventDetail'));
const LiveChat = lazy(() => import('@/pages/LiveChat'));
const Admin = lazy(() => import('@/pages/Admin'));
// Dev-login is DEV-only; importing it unconditionally is fine because the
// component bails out to Navigate when import.meta.env.DEV is false, and the
// tree-shaker drops the whole chunk in production builds that set DEV=false.
const Shop = lazy(() => import('@/pages/Shop'));
const Profile = lazy(() => import('@/pages/Profile'));
const PublicProfile = lazy(() => import('@/pages/PublicProfile'));
const Links = lazy(() => import('@/pages/Links'));
const UserRedirect = lazy(() => import('@/pages/UserRedirect'));
const DevLogin = lazy(() => import('@/pages/DevLogin'));
const AdminLogin = lazy(() => import('@/pages/AdminLogin'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const BannerDisplay = lazy(() => import('@/components/layout/BannerDisplay'));

/** Reads :eventId from the route and forwards to EventDetail. */
function EventDetailRoute() {
  const { eventId } = useParams<{ eventId: string }>();
  if (!eventId) return <Navigate to="/archive" replace />;
  return <EventDetail eventId={eventId} />;
}

/** Wraps Archive's callback into route navigation. */
function ArchiveRoute() {
  const navigate = useNavigate();
  return <Archive onOpenEvent={(id) => navigate(`/event/${id}`)} />;
}

function PageFallback() {
  return <LoadingState />;
}

/** Main content wrapper that adapts width based on route */
function MainContent({ idToken }: { idToken: string | null }) {
  const location = useLocation();
  const isAdmin = location.pathname === '/admin';

  return (
    <main className={`flex-1 mx-auto w-full px-4 py-3 ${
      isAdmin
        ? 'max-w-[640px] md:max-w-[1240px]'
        : 'max-w-[640px]'
    }`}>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Listen />} />
          <Route path="/archive" element={<ArchiveRoute />} />
          <Route path="/event/:eventId" element={<EventDetailRoute />} />
          <Route path="/chat/:eventId" element={<LiveChat />} />
          <Route path="/chat" element={<LiveChat />} />
          <Route path="/lojinha" element={<Shop />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/links" element={<Links />} />
          <Route path="/u/:username" element={<PublicProfile />} />
          <Route path="/user/:id" element={<UserRedirect />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/admin" element={<Admin idToken={idToken} />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          {import.meta.env.DEV && (
            <Route path="/__dev-login" element={<DevLogin />} />
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </main>
  );
}

export default function App() {
  const [idToken, setIdToken] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, async (user) => {
      setIdToken(user ? await user.getIdToken() : null);
    });
    return unsub;
  }, []);

  // Sincroniza votos pendentes quando volta online
  useOfflineSync(idToken);

  return (
    <BrowserRouter>
      <GuestUpsellProvider>
        <div className="min-h-screen flex flex-col font-body text-zine-burntOrange overflow-x-hidden">
          <Header />
          <Suspense fallback={null}><BannerDisplay /></Suspense>
          <MainContent idToken={idToken} />
          <Footer />
          <InstallPrompt />
          <UpdatePrompt />
          <StickerLayer />
        </div>
      </GuestUpsellProvider>
    </BrowserRouter>
  );
}
