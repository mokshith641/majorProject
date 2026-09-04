import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { PATHS } from '../routes/paths';
import {
  LayoutDashboard,
  Video,
  History,
  BarChart3,
  FileSpreadsheet,
  Search,
  Settings,
  User,
  LogOut,
  Bell,
  Menu,
  X,
  ShieldCheck,
  Sun,
  Moon
} from 'lucide-react';

export const AuthLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navigationItems = [
    { name: 'Dashboard', path: PATHS.DASHBOARD, icon: LayoutDashboard },
    { name: 'Start Meeting', path: PATHS.CREATE_MEETING, icon: Video },
    { name: 'Meeting History', path: PATHS.MEETING_HISTORY, icon: History },
    { name: 'Analytics', path: PATHS.ANALYTICS, icon: BarChart3 },
    { name: 'Reports', path: PATHS.REPORTS, icon: FileSpreadsheet },
    { name: 'Search Assistant', path: PATHS.SEARCH, icon: Search },
    { name: 'Settings', path: PATHS.SETTINGS, icon: Settings },
    { name: 'My Profile', path: PATHS.PROFILE, icon: User },
  ];

  const handleLogout = () => {
    logout();
    navigate(PATHS.LOGIN);
  };

  const getPageTitle = () => {
    const matched = navigationItems.find((item) => item.path === location.pathname);
    if (matched) return matched.name;
    if (location.pathname.includes('/meetings/') && location.pathname.includes('/live')) {
      return 'Live Monitoring Session';
    }
    if (location.pathname.includes('/meetings/')) {
      return 'Meeting Summaries & Analytics';
    }
    return 'Smart Meeting Assistant';
  };

  return (
    <div className="flex h-screen w-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden transition-colors duration-200">
      {/* 1. Sidebar Desktop view */}
      <aside className="hidden md:flex md:flex-col md:w-64 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] transition-colors duration-200">
        <div className="flex h-16 items-center px-6 border-b border-[var(--border-subtle)]">
          <Link to={PATHS.DASHBOARD} className="flex items-center gap-2.5 font-bold text-lg text-[var(--text-primary)]">
            <div className="h-8 w-8 rounded-lg bg-[#1a73e8] flex items-center justify-center text-white shadow-sm font-semibold text-base">
              M
            </div>
            <span className="tracking-tight">Meet Assistant</span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#e8f0fe] text-[#174ea6] font-semibold dark:bg-blue-600/20 dark:text-blue-400'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-[#1a73e8] dark:text-blue-400' : 'text-[var(--text-secondary)]'}`} />
                {item.name}
              </Link>
            );
          })}

          {user?.role === 'admin' && (
            <Link
              to={PATHS.ADMIN_DASHBOARD}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                location.pathname === PATHS.ADMIN_DASHBOARD
                  ? 'bg-rose-100 text-rose-800 font-semibold dark:bg-rose-950/30 dark:text-rose-400'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
              }`}
            >
              <ShieldCheck className="h-4 w-4 text-rose-500" />
              Admin Portal
            </Link>
          )}
        </nav>

        {/* User Card at bottom */}
        <div className="p-4 border-t border-[var(--border-subtle)] flex items-center gap-3 bg-[var(--bg-surface-hover)]/40">
          <div className="h-9 w-9 rounded-full bg-[#1a73e8] text-white flex items-center justify-center font-bold text-sm uppercase shadow-xs">
            {user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)] truncate">{user?.full_name || user?.email}</p>
            <p className="text-xs text-[var(--text-secondary)] capitalize">{user?.role || 'Member'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-[var(--text-secondary)] hover:text-red-500 hover:bg-[var(--bg-surface-hover)] rounded-lg transition-colors cursor-pointer"
            title="Log Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* 2. Main content area container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur-md z-10 transition-colors duration-200">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="md:hidden p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] rounded-lg cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold text-[var(--text-primary)] hidden sm:block tracking-tight">
              {getPageTitle()}
            </h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Online status indicator */}
            <div className="hidden lg:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Online</span>
            </div>

            {/* Theme Toggle Button (Light/Dark Switcher) */}
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

            {/* Notification trigger */}
            <button 
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--color-brand)] hover:bg-[var(--bg-surface-hover)] rounded-full relative transition-colors cursor-pointer border border-[var(--border-subtle)]"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-[#1a73e8] rounded-full"></span>
            </button>

            {/* Profile Avatar */}
            <Link
              to={PATHS.PROFILE}
              className="h-8 w-8 rounded-full bg-[#1a73e8] hover:bg-[#1967d2] flex items-center justify-center font-bold text-xs uppercase text-white shadow-xs transition-transform active:scale-95"
              title="View Profile"
            >
              {user?.full_name?.slice(0, 2) || user?.email?.slice(0, 2) || 'U'}
            </Link>
          </div>
        </header>

        {/* Main View Router Entry */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-[var(--bg-app)] relative transition-colors duration-200">
          <Outlet />
        </main>
      </div>

      {/* 3. Mobile Navigation Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setIsMobileOpen(false)}></div>
          <div className="relative flex flex-col w-72 max-w-xs h-full bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] p-6 z-10 shadow-2xl transition-colors duration-200">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2 font-bold text-lg text-[var(--text-primary)]">
                <div className="h-7 w-7 rounded bg-[#1a73e8] flex items-center justify-center text-white text-sm font-semibold">
                  M
                </div>
                <span>Meet Assistant</span>
              </div>
              <button
                onClick={() => setIsMobileOpen(false)}
                className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <nav className="flex-1 space-y-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => setIsMobileOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-[#e8f0fe] text-[#174ea6] font-semibold dark:bg-blue-600/20 dark:text-blue-400'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? 'text-[#1a73e8]' : 'text-[var(--text-secondary)]'}`} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            
            <div className="border-t border-[var(--border-subtle)] pt-4 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-[#1a73e8] text-white flex items-center justify-center font-bold text-xs">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{user?.full_name || user?.email}</p>
              </div>
              <button onClick={handleLogout} className="p-1.5 text-[var(--text-secondary)] hover:text-rose-500">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
