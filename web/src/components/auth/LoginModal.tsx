import React from 'react';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import { useAuth } from '@/hooks/useAuth';

export interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { signInWithGoogle } = useAuth();

  const handleGoogle = async () => {
    try {
      await signInWithGoogle();
      onClose();
    } catch {
      // surface-level: keep modal open on failure
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Entrar no Quartinho">
      <p className="font-body text-zine-charcoal mb-4">
        Entre com sua conta Google para salvar seu histórico de escutas e participar das
        rodadas.
      </p>
      <div className="flex flex-col gap-3">
        <Button onClick={handleGoogle}>Entrar com Google</Button>
        <Button onClick={onClose}>Agora não</Button>
      </div>
    </Modal>
  );
};

export default LoginModal;
