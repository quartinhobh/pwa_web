import React, { useState } from 'react';
import Button from '@/components/common/Button';
import LoginModal from './LoginModal';
import { useSession } from '@/hooks/useSession';

export const GuestWelcome: React.FC = () => {
  const { guestName, loading } = useSession();
  const [modalOpen, setModalOpen] = useState(false);

  if (loading) {
    return <p className="font-body text-zine-charcoal">Preparando seu quartinho…</p>;
  }

  return (
    <div className="flex items-center gap-3">
      <span className="font-display text-zine-charcoal">
        Olá, {guestName ?? 'visitante'}!
      </span>
      <Button onClick={() => setModalOpen(true)}>Entrar</Button>
      <LoginModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
};

export default GuestWelcome;
