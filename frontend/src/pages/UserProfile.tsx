import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Calendar, ShieldCheck, Mail } from 'lucide-react';

export const UserProfile: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3.5">
        <div className="h-11 w-11 bg-[var(--bg-elevated)] text-[var(--color-brand)] border border-[var(--border-subtle)] rounded-xl flex items-center justify-center shrink-0">
          <User className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-[20px] sm:text-[22px] font-semibold text-[var(--text-primary)] tracking-tight">My Profile</h2>
          <p className="text-[14px] text-[var(--text-secondary)] mt-0.5">Manage personal details and credentials</p>
        </div>
      </div>

      <div className="card-enterprise p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-4.5 border-b border-[var(--border-subtle)] pb-6">
          <div className="h-16 w-16 bg-[var(--color-brand)] rounded-xl flex items-center justify-center font-semibold text-2xl uppercase text-white shadow-xs">
            {user?.full_name?.slice(0, 2) || user?.email?.slice(0, 2) || 'US'}
          </div>
          <div>
            <h3 className="text-[18px] sm:text-[19px] font-semibold text-[var(--text-primary)]">{user?.full_name || 'System User'}</h3>
            <p className="text-[13px] text-[var(--text-secondary)] capitalize mt-0.5">{user?.role || 'Member'} Account</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 text-[14px] text-[var(--text-secondary)]">
            <Mail className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
            <span>Email Address: <strong className="text-[var(--text-primary)] font-medium ml-1">{user?.email}</strong></span>
          </div>

          <div className="flex items-center gap-3 text-[14px] text-[var(--text-secondary)]">
            <ShieldCheck className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
            <span>Authorization Status: <span className="badge-success ml-1">Active Verified</span></span>
          </div>

          <div className="flex items-center gap-3 text-[14px] text-[var(--text-secondary)]">
            <Calendar className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
            <span>Registered On: <strong className="text-[var(--text-primary)] font-medium ml-1">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Today'}
            </strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
