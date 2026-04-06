import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-zine-mint dark:bg-zine-mint-dark border-t-4 border-zine-cream dark:border-zine-cream/30 mt-8">
      <div className="mx-auto max-w-[640px] px-4 py-4 flex items-center justify-between font-body text-sm text-zine-cream">
        <span>quartinho · desde 2023</span>
        <a
          href="https://www.instagram.com/quartinhobh/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-zine-burntYellow"
        >
          @quartinhobh
        </a>
      </div>
    </footer>
  );
};

export default Footer;
