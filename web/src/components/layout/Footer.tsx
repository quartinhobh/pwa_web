import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-zine-mint dark:bg-zine-mint-dark border-t-4 border-zine-cream dark:border-zine-cream/30 mt-auto">
      <div className="mx-auto max-w-[640px] px-4 py-4 flex items-center justify-between font-body text-sm text-zine-cream">
        <span>quartinho · desde 2023</span>
        <div className="flex items-center gap-3">
          <Link to="/links" className="underline hover:text-zine-burntYellow">
            links
          </Link>
          <a
            href="https://www.instagram.com/quartinhobh/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-zine-burntYellow"
          >
            @quartinhobh
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
