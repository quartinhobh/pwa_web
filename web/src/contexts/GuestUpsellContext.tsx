/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useContext, useCallback } from 'react';

// Context files legitimately export both components (provider) and hooks (useGuestUpsell).
// The hook has no separate implementation and must be in the same file for proper encapsulation.

export interface GuestUpsellModalData {
  email: string;
  displayName: string;
}

interface GuestUpsellContextValue {
  modalData: GuestUpsellModalData | null;
  openModal: (data: GuestUpsellModalData) => void;
  closeModal: () => void;
}

const GuestUpsellContext = createContext<GuestUpsellContextValue | undefined>(undefined);

export const GuestUpsellProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modalData, setModalData] = useState<GuestUpsellModalData | null>(null);

  const openModal = useCallback((data: GuestUpsellModalData) => {
    setModalData(data);
  }, []);

  const closeModal = useCallback(() => {
    setModalData(null);
  }, []);

  return (
    <GuestUpsellContext.Provider value={{ modalData, openModal, closeModal }}>
      {children}
    </GuestUpsellContext.Provider>
  );
};

export const useGuestUpsell = () => {
  const context = useContext(GuestUpsellContext);
  if (!context) {
    throw new Error('useGuestUpsell must be used within GuestUpsellProvider');
  }
  return context;
};
