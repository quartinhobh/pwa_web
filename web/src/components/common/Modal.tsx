import React, { useEffect, useRef } from 'react';
import ZineFrame from './ZineFrame';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/**
 * Modal — composes ZineFrame(bg=cream) on a dimmed #1A1A1A/60 backdrop.
 * Closes on ESC or backdrop click. Traps Tab focus inside the dialog and
 * restores focus to the trigger on close. Never pure black.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Track body overflow + ESC handler. Effects that change isOpen also
  // take care of focus capture/restore.
  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      return;
    }
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = getFocusables(root);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Capture previous focus on open, restore on close. Only depends on isOpen
  // so re-renders with new onClose callbacks don't churn the effect.
  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = (document.activeElement as HTMLElement | null) ?? null;
    const root = dialogRef.current;
    if (!root) return;
    const focusables = getFocusables(root);
    if (focusables.length > 0) {
      focusables[0]!.focus();
    } else {
      root.focus();
    }
    return () => {
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

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
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md paper-in focus:outline-none"
        style={{ overscrollBehavior: 'contain' }}
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
