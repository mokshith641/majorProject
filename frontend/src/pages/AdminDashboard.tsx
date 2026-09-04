import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ShieldCheck, Cpu, HardDrive, Settings, Trash2, Users, Loader2 } from 'lucide-react';

interface SystemHealth {
  cpu: { usage_percent: number; cores: number };
  memory: { total_gb: number; available_gb: number; usage_percent: number };
  disk: { usage_percent: number; free_gb: number };
  process: { memory_usage_mb: number; threads_active: number };
}

interface AccountUser {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<AccountUser[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  const fetchAdminData = async () => {
    try {
      const [usersRes, healthRes] = await Promise.all([
        api.get<AccountUser[]>('/admin/users'),
        api.get<SystemHealth>('/admin/system-health')
      ]);
      setUsers(usersRes.data);
      setHealth(healthRes.data);
    } catch (e) {
      console.error("Admin dashboard data fetch failed:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
    const interval = setInterval(async () => {
      try {
        const res = await api.get<SystemHealth>('/admin/system-health');
        setHealth(res.data);
      } catch (err) {
        console.warn("Failed to poll live health data", err);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleDeleteUser = async (userId: number) => {
    if (!window.confirm("Are you sure you want to delete this user profile?")) return;
    
    setIsDeleting(userId);
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err: any) {
      alert(err.response?.data?.detail || "Delete operation failed.");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleRoleToggle = async (userId: number, currentRole: string) => {
    const targetRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await api.put(`/admin/users/${userId}/role?role=${targetRole}`);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: targetRole } : u))
      );
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to toggle role.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1a73e8] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-rose-500" />
          Admin Portal Dashboard
        </h2>
        <p className="text-[var(--text-secondary)] text-sm">Audit accounts registration and inspect server computer metrics.</p>
      </div>

      {/* 1. System Health indicators */}
      {health && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* CPU Card */}
          <div className="glass-card p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider">CPU Usage</span>
              <Cpu className="h-5 w-5 text-[#1a73e8] dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-[var(--text-primary)]">{health.cpu.usage_percent}%</h3>
              <p className="text-[var(--text-secondary)] text-xs mt-1">Logical cores: {health.cpu.cores}</p>
            </div>
            <div className="w-full bg-[var(--bg-surface-hover)] rounded-full h-1.5 overflow-hidden">
              <div className="bg-[#1a73e8] h-1.5 transition-all duration-500 rounded-full" style={{ width: `${health.cpu.usage_percent}%` }}></div>
            </div>
          </div>

          {/* RAM Card */}
          <div className="glass-card p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider">System Memory</span>
              <HardDrive className="h-5 w-5 text-[#1a73e8] dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-[var(--text-primary)]">{health.memory.usage_percent}%</h3>
              <p className="text-[var(--text-secondary)] text-xs mt-1">
                Available: {health.memory.available_gb} GB / {health.memory.total_gb} GB
              </p>
            </div>
            <div className="w-full bg-[var(--bg-surface-hover)] rounded-full h-1.5 overflow-hidden">
              <div className="bg-[#1a73e8] h-1.5 transition-all duration-500 rounded-full" style={{ width: `${health.memory.usage_percent}%` }}></div>
            </div>
          </div>

          {/* Process specs */}
          <div className="glass-card p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider">Server Performance</span>
              <Settings className="h-5 w-5 text-[#1a73e8] dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-[var(--text-primary)]">{health.process.memory_usage_mb} MB</h3>
              <p className="text-[var(--text-secondary)] text-xs mt-1">Active worker threads: {health.process.threads_active}</p>
            </div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Memory consumption healthy</div>
          </div>
        </div>
      )}

      {/* 2. User Directory control panel */}
      <div className="glass-card p-6 rounded-2xl">
        <h3 className="text-base font-bold text-[var(--text-primary)] mb-6 flex items-center gap-2">
          <Users className="h-5 w-5 text-[#1a73e8] dark:text-blue-400" />
          Platform Accounts Directory
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-[var(--text-secondary)] text-xs uppercase font-semibold">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Registered Date</th>
                <th className="py-3 px-4">System Role</th>
                <th className="py-3 px-4 text-right">Settings Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {users.map((item) => (
                <tr key={item.id} className="hover:bg-[var(--bg-surface-hover)] transition-colors">
                  <td className="py-3 px-4 text-[var(--text-primary)] font-medium">{item.full_name || '-'}</td>
                  <td className="py-3 px-4 text-[var(--text-secondary)]">{item.email}</td>
                  <td className="py-3 px-4 text-[var(--text-secondary)]">{new Date(item.created_at).toLocaleDateString()}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                      item.role === 'admin' 
                        ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800' 
                        : 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800'
                    }`}>
                      {item.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      onClick={() => handleRoleToggle(item.id, item.role)}
                      className="text-xs bg-[var(--bg-card)] border border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                    >
                      Toggle Role
                    </button>
                    <button
                      onClick={() => handleDeleteUser(item.id)}
                      disabled={isDeleting === item.id}
                      className="text-xs bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-950/50 p-1.5 rounded-lg transition-all inline-flex items-center justify-center align-middle cursor-pointer"
                      title="Delete User"
                    >
                      {isDeleting === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
