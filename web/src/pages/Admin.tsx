import React from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import AdminPanel from '@/components/admin/AdminPanel';
import { useSessionStore } from '@/store/sessionStore';

export interface AdminPageProps {
  idToken: string | null;
}

/**
 * Admin page — role-gated wrapper around AdminPanel.
 * Non-admins see an "Acesso negado" card inside a periwinkle ZineFrame.
 */
export const Admin: React.FC<AdminPageProps> = ({ idToken }) => {
  const role = useSessionStore((s) => s.role);
  const firebaseUid = useSessionStore((s) => s.firebaseUid);

  if (!firebaseUid || role !== 'admin') {
    return (
      <ZineFrame bg="periwinkle">
        <h1 className="font-display text-3xl text-zine-burntOrange">
          Acesso negado
        </h1>
        <p className="font-body text-zine-burntOrange mt-2">
          Esta área é reservada a administradores.
        </p>
      </ZineFrame>
    );
  }

  return <AdminPanel idToken={idToken} />;
};

export default Admin;
