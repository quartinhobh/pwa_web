import React, { useEffect } from 'react';
import ZineFrame from './ZineFrame';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

/**
 * Modal — composes ZineFrame(bg=cream) on a dimmed #1A1A1A/60 backdrop.
 * Closes on ESC or backdrop click. Never pure black.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      className="fixed inset-0 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(26, 26, 26, 0.7)', zIndex: 9999 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md paper-in"
      >
        <ZineFrame bg="cream">
          {title && (
            <h2 className="font-display text-2xl mb-3 text-zine-burntOrange">
              {title}
            </h2>
          )}
          {children}
        </ZineFrame>
      </div>
    </div>
  );
};

export default Modal;
