import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
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
  ShieldCheck
} from 'lucide-react';

export const AuthLayout: React.FC = () => {
  const { user, logout } = useAuth();
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
    <div className="flex h-screen w-screen bg-[#090D16] text-slate-100 overflow-hidden">
      {/* 1. Sidebar Desktop view */}
      <aside className="hidden md:flex md:flex-col md:w-64 glass-panel border-r border-slate-800">
        <div className="flex h-16 items-center px-6 border-b border-slate-800">
          <Link to={PATHS.DASHBOARD} className="flex items-center gap-2 font-bold text-lg text-indigo-400">
            <span className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">M</span>
            Meeting Assistant
          </Link>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 border-l-2 border-indigo-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}

          {user?.role === 'admin' && (
            <Link
              to={PATHS.ADMIN_DASHBOARD}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                location.pathname === PATHS.ADMIN_DASHBOARD
                  ? 'bg-red-950/20 text-red-400 border-l-2 border-red-500'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <ShieldCheck className="h-4 w-4 text-red-500" />
              Admin Portal
            </Link>
          )}
        </nav>

        {/* User Card at bottom */}
        <div className="p-4 border-t border-slate-800 flex items-center gap-3 bg-slate-900/30">
          <div className="h-9 w-9 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-sm uppercase">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.full_name || user?.email}</p>
            <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
            title="Log Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* 2. Main content area container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-slate-800/80 bg-[#090D16]/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="md:hidden p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold text-slate-100 hidden sm:block">{getPageTitle()}</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Quick stats indicators */}
            <div className="hidden lg:flex items-center gap-4 bg-slate-900/60 border border-slate-800 rounded-full px-4 py-1.5 text-xs text-slate-400">
              <span>Status: <strong className="text-emerald-400 font-medium">Online</strong></span>
            </div>

            {/* Notification triggers */}
            <button className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800/60 rounded-full relative transition-colors">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-indigo-500 rounded-full"></span>
            </button>

            {/* Profile Dropdown Avatar */}
            <div className="h-8 w-8 rounded-full bg-brand-600 flex items-center justify-center font-bold text-sm uppercase text-white shadow-lg">
              {user?.full_name?.slice(0, 2) || 'U'}
            </div>
          </div>
        </header>

        {/* Main View Router Entry */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#090D16] relative">
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand-600/5 rounded-full filter blur-[120px] pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/5 rounded-full filter blur-[120px] pointer-events-none"></div>
          <Outlet />
        </main>
      </div>

      {/* 3. Mobile Navigation Drawers */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setIsMobileOpen(false)}></div>
          <div className="relative flex flex-col w-64 max-w-xs h-full bg-[#0B0F19] border-r border-slate-800 p-6 z-10 animate-slide-in">
            <div className="flex items-center justify-between mb-8">
              <span className="font-bold text-lg text-indigo-400">Meeting Assistant</span>
              <button
                onClick={() => setIsMobileOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-200"
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
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-indigo-600/25 text-indigo-300'
                        : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            
            <div className="border-t border-slate-800 pt-4 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold">
                U
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.full_name || user?.email}</p>
              </div>
              <button onClick={handleLogout} className="p-1 text-slate-400 hover:text-red-400">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
