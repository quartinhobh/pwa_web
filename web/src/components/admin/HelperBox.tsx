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

export default HelperBox;
