import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { PATHS } from '../routes/paths';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export const GuestLayout: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen w-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex flex-col relative overflow-hidden transition-colors duration-150">
      {/* Guest top navbar */}
      <header className="h-16 flex items-center justify-between px-6 sm:px-12 border-b border-[var(--border-subtle)] bg-[var(--bg-header)] z-10 transition-colors duration-150">
        <Link to={PATHS.LANDING} className="flex items-center gap-3 font-semibold text-[17px] text-[var(--text-primary)] tracking-tight">
          <div className="h-8 w-8 rounded-lg bg-[var(--color-brand)] flex items-center justify-center text-white text-sm font-semibold shadow-xs">
            M
          </div>
          <span>Meet Assistant</span>
        </Link>
        
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Theme Switcher Button */}
          <button
            onClick={toggleTheme}
            className="h-9 w-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:bg-[var(--bg-surface-hover)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
            title={theme === 'light' ? 'Switch to Dark mode' : 'Switch to Light mode'}
            aria-label="Toggle theme mode"
          >
            {theme === 'light' ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4 text-[var(--color-warning)]" />
            )}
          </button>

          <Link
            to={PATHS.LOGIN}
            className="text-[14px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-3 py-1.5"
          >
            Sign In
          </Link>
          <Link
            to={PATHS.REGISTER}
            className="btn-primary text-[14px] py-1.5 px-4 rounded-lg"
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
