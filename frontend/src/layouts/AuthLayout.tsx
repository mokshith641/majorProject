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
    return 'Meet Assistant';
  };

  return (
    <div className="flex h-screen w-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden transition-colors duration-150">
      {/* 1. Sidebar Desktop view */}
      <aside className="hidden md:flex md:flex-col md:w-64 bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)] transition-colors duration-150 shrink-0 select-none">
        {/* Brand Header */}
        <div className="flex h-16 items-center px-6 border-b border-[var(--border-subtle)]">
          <Link to={PATHS.DASHBOARD} className="flex items-center gap-3 font-semibold text-[17px] text-[var(--text-primary)] tracking-tight">
            <div className="h-8 w-8 rounded-lg bg-[var(--color-brand)] flex items-center justify-center text-white shadow-xs font-semibold text-sm">
              M
            </div>
            <span>Meet Assistant</span>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[14px] font-medium transition-all ${
                  isActive
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-semibold shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                }`}
              >
                <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-[var(--color-brand)]' : 'text-[var(--text-muted)]'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}

          {user?.role === 'admin' && (
            <Link
              to={PATHS.ADMIN_DASHBOARD}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[14px] font-medium transition-all ${
                location.pathname === PATHS.ADMIN_DASHBOARD
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-semibold shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
              }`}
            >
              <ShieldCheck className="h-[18px] w-[18px] text-[var(--color-error)] shrink-0" />
              <span>Admin Portal</span>
            </Link>
          )}
        </nav>

        {/* User Card at bottom */}
        <div className="p-3.5 border-t border-[var(--border-subtle)] flex items-center gap-3 bg-[var(--bg-surface-hover)]/60">
          <div className="h-9 w-9 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-center justify-center font-semibold text-xs uppercase shrink-0">
            {user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{user?.full_name || user?.email}</p>
            <p className="text-[12px] text-[var(--text-muted)] capitalize">{user?.role || 'Member'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--bg-elevated)] rounded-md transition-colors cursor-pointer"
            title="Log Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* 2. Main content area container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 flex items-center justify-between px-6 sm:px-8 border-b border-[var(--border-subtle)] bg-[var(--bg-header)] z-10 transition-colors duration-150">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="md:hidden p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] rounded-lg cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-semibold text-[var(--text-primary)] hidden sm:block tracking-tight">
              {getPageTitle()}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Online status indicator */}
            <div className="hidden lg:flex items-center gap-2 bg-[var(--color-success-bg)] border border-[var(--color-success)]/20 rounded-full px-3 py-1 text-[13px] font-medium text-[var(--color-success)]">
              <span className="h-2 w-2 rounded-full bg-[var(--color-success)]"></span>
              <span>Online</span>
            </div>

            {/* Theme Toggle Button (Light/Dark Switcher) */}
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

            {/* Notification trigger */}
            <button 
              className="h-9 w-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:bg-[var(--bg-surface-hover)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] relative transition-all cursor-pointer"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-2 right-2 h-1.5 w-1.5 bg-[var(--color-brand)] rounded-full"></span>
            </button>

            {/* Profile Avatar */}
            <Link
              to={PATHS.PROFILE}
              className="h-9 w-9 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] flex items-center justify-center font-medium text-xs uppercase text-white shadow-xs transition-transform active:scale-95"
              title="View Profile"
            >
              {user?.full_name?.slice(0, 2) || user?.email?.slice(0, 2) || 'U'}
            </Link>
          </div>
        </header>

        {/* Main View Router Entry */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-[var(--bg-app)] relative transition-colors duration-150">
          <Outlet />
        </main>
      </div>

      {/* 3. Mobile Navigation Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setIsMobileOpen(false)}></div>
          <div className="relative flex flex-col w-72 max-w-xs h-full bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)] p-6 z-10 shadow-2xl transition-colors duration-150">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5 font-semibold text-[17px] text-[var(--text-primary)]">
                <div className="h-8 w-8 rounded-lg bg-[var(--color-brand)] flex items-center justify-center text-white text-sm font-semibold shadow-xs">
                  M
                </div>
                <span>Meet Assistant</span>
              </div>
              <button
                onClick={() => setIsMobileOpen(false)}
                className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg cursor-pointer"
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
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[14px] font-medium transition-all ${
                      isActive
                        ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-semibold shadow-xs'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Icon className={`h-[18px] w-[18px] ${isActive ? 'text-[var(--color-brand)]' : 'text-[var(--text-muted)]'}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
            
            <div className="border-t border-[var(--border-subtle)] pt-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-center justify-center font-semibold text-xs">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{user?.full_name || user?.email}</p>
              </div>
              <button onClick={handleLogout} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--color-error)] cursor-pointer">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
