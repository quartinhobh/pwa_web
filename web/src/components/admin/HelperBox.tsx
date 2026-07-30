import React from 'react';
import { useHelper } from './HelperContext';

const HelperBox: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { helperOn } = useHelper();
  if (!helperOn) return null;

  return (
    <div className="flex items-start gap-2 rounded border border-zine-burntYellow/50 bg-zine-burntYellow/10 p-3 mb-3">
      <span className="text-xl leading-none mt-0.5" aria-hidden>💡</span>
      <p className="font-body text-sm text-zine-burntOrange/90 leading-relaxed">{children}</p>
    </div>
  );
};

export type NoticeKind = 'error' | 'ok';

export interface NoticeBannerProps {
  kind: NoticeKind;
  message: string | null;
  onDismiss?: () => void;
}

/**
 * NoticeBanner — in-page replacement for native alert()/confirm() in the
 * admin panels. Renders with role='alert' for errors or role='status' for
 * success, sits at the top of the panel, and can be dismissed by the user.
 * The whole helper-box visual chrome (per the FIX_PLAN) is intentionally
 * unchanged.
 */
export const NoticeBanner: React.FC<NoticeBannerProps> = ({ kind, message, onDismiss }) => {
  if (!message) return null;
  const isError = kind === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className="flex items-start gap-2 rounded border border-zine-burntYellow/50 bg-zine-burntYellow/10 p-3 mb-3"
    >
      <span className="text-xl leading-none mt-0.5" aria-hidden>{isError ? '⚠️' : '✅'}</span>
      <p className="font-body text-sm text-zine-burntOrange/90 leading-relaxed flex-1">
        {message}
      </p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="fechar aviso"
          className="font-body text-xs text-zine-burntOrange/60 hover:text-zine-burntOrange underline shrink-0"
        >
          fechar
        </button>
      )}
    </div>
  );
};

export default HelperBox;
