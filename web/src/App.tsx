import { lazy, Suspense, useEffect, useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useParams,
  Navigate,
} from 'react-router-dom';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '@/services/firebase';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import InstallPrompt from '@/components/common/InstallPrompt';

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
const DevLogin = lazy(() => import('@/pages/DevLogin'));

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
  return (
    <div className="py-10 text-center font-body text-zine-burntOrange">
      carregando…
    </div>
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

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col font-body text-zine-burntOrange overflow-x-hidden">
        <Header />
        <main className="flex-1 mx-auto w-full max-w-[640px] px-4 py-6">
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Listen />} />
              <Route path="/archive" element={<ArchiveRoute />} />
              <Route path="/event/:eventId" element={<EventDetailRoute />} />
              <Route path="/chat/:eventId" element={<LiveChat />} />
              <Route path="/lojinha" element={<Shop />} />
              <Route path="/admin" element={<Admin idToken={idToken} />} />
              {import.meta.env.DEV && (
                <Route path="/__dev-login" element={<DevLogin />} />
              )}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
        <Footer />
        <InstallPrompt />
      </div>
    </BrowserRouter>
  );
}
