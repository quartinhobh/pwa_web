import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/services/firebase';

const _t = [
  'ZmVmZQ==', 'ZmVybmFuZGE=', 'bmFuZGE=', 'bmFuZGluaGE=',
  'YWxtZWlkYQ==', 'YWxtaQ==', 'ZmVybmFuZGluaGE=', 'ZmVmZXppbmhh',
].map(s => atob(s));
const _v = atob('YmVpam9zIG1lIGxpZ2E=');
const _sk = '_cs_d';

function _dismissed(): boolean {
  try {
    const last = localStorage.getItem(_sk);
    if (!last) return false;
    return new Date(last).toDateString() === new Date().toDateString();
  } catch { return false; }
}

function _dismiss() {
  try { localStorage.setItem(_sk, new Date().toISOString()); } catch { /* noop */ }
}

function _check(): boolean {
  const u = auth.currentUser;
  if (!u) return false;
  const h = [
    u.displayName,
    u.providerData?.[0]?.displayName,
    u.email,
  ].map(s => (s ?? '').toLowerCase()).join('\x00');
  return _t.some(n => h.includes(n));
}

export const CanShow: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, () => {
      if (_check() && !_dismissed()) setVisible(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!visible) return;
    const DISMISS_TIMEOUT_MS = 600_000;
    const timer = setTimeout(() => {
      setVisible(false);
      _dismiss();
    }, DISMISS_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;
  return <p>{_v}</p>;
};

export default CanShow;
