import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSessionStore } from '@/store/sessionStore';
import LoginModal from '@/components/auth/LoginModal';

export const AdminLogin: React.FC = () => {
  const { user } = useAuth();
  const { role } = useSessionStore();
  const [loginOpen, setLoginOpen] = useState(true);

  if (user && role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  function handleClose() {
    setLoginOpen(false);
  }

  if (!loginOpen) {
    return <Navigate to="/" replace />;
  }

  return (
    <LoginModal isOpen={loginOpen} onClose={handleClose} />
  );
};

export default AdminLogin;