import React from 'react';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  /** Set to true to suppress the wobble filter on this button. */
  noWobble?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className = '',
  noWobble = false,
  style,
  ...rest
}) => {
  const wobbleStyle = noWobble ? style : { filter: 'url(#zine-wobble)', ...style };
  return (
    <button
      {...rest}
      style={wobbleStyle}
      className={[
        'inline-block',
        'font-body font-bold',
        'px-5 py-2',
        'border-4 border-zine-cream dark:border-zine-cream/30',
        'bg-zine-burntOrange text-zine-cream',
        'dark:bg-zine-burntOrange-bright dark:text-zine-surface-dark',
        'hover:bg-zine-periwinkle dark:hover:bg-zine-periwinkle-dark',
        'hover:wobble',
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
