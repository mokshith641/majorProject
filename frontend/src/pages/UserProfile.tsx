import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Calendar, ShieldCheck, Mail } from 'lucide-react';

export const UserProfile: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-indigo-500/10 text-indigo-400 rounded-lg flex items-center justify-center">
          <User className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">My Profile</h2>
          <p className="text-slate-400 text-sm">Manage details and credential validations</p>
        </div>
      </div>

      <div className="glass-card rounded-xl p-8 border border-slate-800 space-y-6">
        <div className="flex items-center gap-4 border-b border-slate-800/80 pb-6">
          <div className="h-16 w-16 bg-indigo-600 rounded-full flex items-center justify-center font-bold text-2xl uppercase text-white shadow-lg shadow-indigo-600/15">
            {user?.full_name?.slice(0, 2) || 'US'}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{user?.full_name || 'System User'}</h3>
            <p className="text-slate-500 text-sm capitalize">{user?.role} Account</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 text-sm text-slate-300">
            <Mail className="h-4 w-4 text-slate-500" />
            <span>Email Address: <strong className="text-white ml-1">{user?.email}</strong></span>
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-300">
            <ShieldCheck className="h-4 w-4 text-slate-500" />
            <span>Authorization Status: <span className="text-emerald-400 ml-1 font-semibold">Active Verified</span></span>
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-300">
            <Calendar className="h-4 w-4 text-slate-500" />
            <span>Registered On: <strong className="text-white ml-1">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Today'}
            </strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
