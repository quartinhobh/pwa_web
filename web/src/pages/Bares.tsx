import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '@/store/sessionStore';
import { useIdToken } from '@/hooks/useIdToken';
import BarList from '@/components/bares/BarList';
import BaratonaIntro from '@/components/bares/BaratonaIntro';
import Button from '@/components/common/Button';
import LoginModal from '@/components/auth/LoginModal';

export default function Bares() {
  const firebaseUid = useSessionStore((s) => s.firebaseUid);
  const idToken = useIdToken();
  const navigate = useNavigate();
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-3xl text-zine-burntOrange">bares</h1>

      <BaratonaIntro variant="full" />

      <Button className="w-full" onClick={() => navigate('/novo-bar')}>
        indicar bar
      </Button>

      <BarList
        idToken={idToken}
        firebaseUid={firebaseUid}
        onRequestLogin={() => setLoginOpen(true)}
      />

      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
