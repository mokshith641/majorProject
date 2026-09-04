import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { PATHS } from '../routes/paths';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export const GuestLayout: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen w-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex flex-col relative overflow-hidden transition-colors duration-200 selection:bg-[#1a73e8] selection:text-white">
      {/* Ambient gradient */}
      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#1a73e8]/5 filter blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-[45vw] h-[45vw] rounded-full bg-[#34a853]/5 filter blur-[150px] pointer-events-none"></div>

      {/* Guest top navbar */}
      <header className="h-16 flex items-center justify-between px-6 sm:px-12 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 backdrop-blur-md z-10 transition-colors duration-200">
        <Link to={PATHS.LANDING} className="flex items-center gap-2.5 font-bold text-lg text-[var(--text-primary)]">
          <div className="h-8 w-8 rounded-lg bg-[#1a73e8] flex items-center justify-center text-white text-base shadow-xs font-semibold">
            M
          </div>
          <span className="tracking-tight">Meet Assistant</span>
        </Link>
        
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Theme Switcher Button */}
          <button
            onClick={toggleTheme}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--color-brand)] hover:bg-[var(--bg-surface-hover)] rounded-full transition-all flex items-center justify-center cursor-pointer border border-[var(--border-subtle)]"
            title={theme === 'light' ? 'Switch to Dark mode' : 'Switch to Light mode'}
            aria-label="Toggle theme mode"
          >
            {theme === 'light' ? (
              <Moon className="h-4 w-4 text-slate-700" />
            ) : (
              <Sun className="h-4 w-4 text-amber-400" />
            )}
          </button>

          <Link
            to={PATHS.LOGIN}
            className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-3 py-1.5"
          >
            Sign In
          </Link>
          <Link
            to={PATHS.REGISTER}
            className="text-sm font-medium bg-[#1a73e8] hover:bg-[#1967d2] text-white px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Main router page wrapper */}
      <main className="flex-1 flex flex-col justify-center items-center p-6 relative z-10">
        <Outlet />
      </main>
    </div>
  );
};
