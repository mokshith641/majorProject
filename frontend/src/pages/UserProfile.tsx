import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Calendar, ShieldCheck, Mail } from 'lucide-react';

export const UserProfile: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-[#e8f0fe] text-[#1a73e8] dark:bg-blue-900/30 dark:text-blue-400 rounded-xl flex items-center justify-center">
          <User className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">My Profile</h2>
          <p className="text-[var(--text-secondary)] text-sm">Manage personal details and credentials</p>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-4 border-b border-[var(--border-subtle)] pb-6">
          <div className="h-16 w-16 bg-[#1a73e8] rounded-full flex items-center justify-center font-bold text-2xl uppercase text-white shadow-sm">
            {user?.full_name?.slice(0, 2) || user?.email?.slice(0, 2) || 'US'}
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">{user?.full_name || 'System User'}</h3>
            <p className="text-[var(--text-secondary)] text-sm capitalize">{user?.role || 'Member'} Account</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
            <Mail className="h-4 w-4 text-[var(--text-muted)]" />
            <span>Email Address: <strong className="text-[var(--text-primary)] ml-1">{user?.email}</strong></span>
          </div>

          <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
            <ShieldCheck className="h-4 w-4 text-[var(--text-muted)]" />
            <span>Authorization Status: <span className="text-emerald-600 dark:text-emerald-400 ml-1 font-semibold">Active Verified</span></span>
          </div>

          <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
            <Calendar className="h-4 w-4 text-[var(--text-muted)]" />
            <span>Registered On: <strong className="text-[var(--text-primary)] ml-1">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Today'}
            </strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
