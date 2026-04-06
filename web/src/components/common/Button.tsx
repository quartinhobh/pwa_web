import React from 'react';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className = '',
  ...rest
}) => {
  return (
    <button
      {...rest}
      className={[
        'inline-block',
        'font-body font-bold',
        'px-5 py-2',
        'border-4 border-zine-cream dark:border-zine-cream/30',
        'bg-zine-burntYellow text-zine-cream',
        'dark:bg-zine-burntYellow-bright dark:text-zine-surface-dark',
        'hover:bg-zine-burntOrange dark:hover:bg-zine-burntOrange-bright hover:wobble',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-zine-burntOrange',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        'transition-colors',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  );
};

export default Button;
