import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useBarDetail } from '@/hooks/useBarDetail';
import { useSessionStore } from '@/store/sessionStore';
import { useIdToken } from '@/hooks/useIdToken';
import BarCard from '@/components/bares/BarCard';
import SuggestionComments from '@/components/bares/SuggestionComments';
import LoginModal from '@/components/auth/LoginModal';
import ZineFrame from '@/components/common/ZineFrame';
import { LoadingState } from '@/components/common/LoadingState';

export default function BarDetail() {
  const { id } = useParams<{ id: string }>();
  const { bar, loading, notFound } = useBarDetail(id ?? '');
  const firebaseUid = useSessionStore((s) => s.firebaseUid);
  const idToken = useIdToken();
  const [loginOpen, setLoginOpen] = useState(false);

  if (loading) return <LoadingState />;
  if (notFound || !bar) {
    return (
      <ZineFrame bg="periwinkle">
        <p className="font-body text-zine-burntOrange">bar nao encontrado</p>
      </ZineFrame>
    );
  }
  return (
    <main className="flex flex-col gap-4 p-4">
      <Link
        to="/bares"
        className="font-body text-sm text-zine-burntOrange/70 hover:text-zine-burntOrange"
      >
        ← bares
      </Link>
      <BarCard
        bar={bar}
        idToken={idToken}
        firebaseUid={firebaseUid}
        asDetail={true}
        onRequestLogin={() => setLoginOpen(true)}
      />
      <SuggestionComments
        barId={bar.id}
        idToken={idToken}
        firebaseUid={firebaseUid}
        onRequestLogin={() => setLoginOpen(true)}
      />
      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </main>
  );
}
