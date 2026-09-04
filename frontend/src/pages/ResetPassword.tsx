import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';
import { PATHS } from '../routes/paths';
import { Mail, Lock, Key, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface ResetPasswordInputs {
  email: string;
  token: string;
  new_password: string;
}

export const ResetPassword: React.FC = () => {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInputs>();

  const onSubmit = async (data: ResetPasswordInputs) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await resetPassword(data.email, data.token, data.new_password);
      setSuccess(true);
      setTimeout(() => {
        navigate(PATHS.LOGIN);
      }, 2000);
    } catch (e: any) {
      setErrorMsg(e.response?.data?.detail || 'Failed to update password. Invalid verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md glass-card rounded-2xl p-8 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1a73e8] via-[#34a853] to-[#fbbc05]"></div>

      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Update Password</h2>
        <p className="text-[var(--text-secondary)] text-sm">Enter your recovery token to save a new password</p>
      </div>

      {success && (
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 p-4 rounded-xl text-sm mb-6">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Password changed successfully! Sending to login...</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 p-3.5 rounded-xl text-sm mb-6">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
            Registered Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="email"
              {...register('email', { required: 'Email address is required' })}
              placeholder="you@example.com"
              className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] focus:border-[#1a73e8] text-[var(--text-primary)] rounded-xl pl-10 pr-4 py-2.5 text-sm transition-all outline-none"
            />
          </div>
          {errors.email && <p className="text-rose-600 dark:text-rose-400 text-xs mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
            Verification Token
          </label>
          <div className="relative">
            <Key className="absolute left-3.5 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="text"
              {...register('token', { required: 'Verification token is required' })}
              placeholder="recovery-token-for-user-id"
              className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] focus:border-[#1a73e8] text-[var(--text-primary)] rounded-xl pl-10 pr-4 py-2.5 text-sm transition-all outline-none"
            />
          </div>
          {errors.token && <p className="text-rose-600 dark:text-rose-400 text-xs mt-1">{errors.token.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
            New Password (Min 6 chars)
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="password"
              {...register('new_password', {
                required: 'New password is required',
                minLength: { value: 6, message: 'Password must be at least 6 characters' },
              })}
              placeholder="••••••••"
              className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] focus:border-[#1a73e8] text-[var(--text-primary)] rounded-xl pl-10 pr-4 py-2.5 text-sm transition-all outline-none"
            />
          </div>
          {errors.new_password && <p className="text-rose-600 dark:text-rose-400 text-xs mt-1">{errors.new_password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting || success}
          className="w-full py-3 bg-[#1a73e8] hover:bg-[#1967d2] disabled:opacity-50 text-white font-medium rounded-xl shadow-xs hover:shadow-md transition-all text-sm flex items-center justify-center gap-2 mt-4 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving Password...
            </>
          ) : (
            'Change Password'
          )}
        </button>
      </form>
    </div>
  );
};
