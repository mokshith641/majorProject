import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';
import { PATHS } from '../routes/paths';
import { Mail, Lock, Key, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';

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
    <div className="w-full max-w-md card-enterprise p-8 space-y-6 shadow-md">
      <div className="text-center">
        <h2 className="text-[24px] font-semibold text-[var(--text-primary)] tracking-tight">Update Password</h2>
        <p className="text-[14px] text-[var(--text-secondary)] mt-1">Enter your recovery token to save a new password</p>
      </div>

      {success && (
        <div className="badge-success w-full p-3.5 rounded-lg text-[13px] flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-[var(--color-success)] shrink-0" />
          <span>Password changed successfully! Sending to login...</span>
        </div>
      )}

      {errorMsg && (
        <div className="badge-error w-full p-3 rounded-lg text-[13px] flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-[13px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="email"
              {...register('email', { required: 'Email is required' })}
              placeholder="you@example.com"
              className="input-enterprise pl-10 pr-4 py-2.5 text-[14px]"
            />
          </div>
          {errors.email && <p className="text-[var(--color-error)] text-[12px] mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-[13px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
            Verification Code
          </label>
          <div className="relative">
            <Key className="absolute left-3.5 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="text"
              {...register('token', { required: 'Verification token is required' })}
              placeholder="Paste token received"
              className="input-enterprise pl-10 pr-4 py-2.5 text-[14px] font-mono"
            />
          </div>
          {errors.token && <p className="text-[var(--color-error)] text-[12px] mt-1">{errors.token.message}</p>}
        </div>

        <div>
          <label className="block text-[13px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
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
              className="input-enterprise pl-10 pr-4 py-2.5 text-[14px]"
            />
          </div>
          {errors.new_password && <p className="text-[var(--color-error)] text-[12px] mt-1">{errors.new_password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting || success}
          className="btn-primary w-full py-2.5 text-[14px] disabled:opacity-50 mt-6 cursor-pointer gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Updating Password...
            </>
          ) : (
            'Set New Password'
          )}
        </button>
      </form>

      <div className="text-center pt-2 border-t border-[var(--border-subtle)]">
        <Link
          to={PATHS.LOGIN}
          className="text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Login
        </Link>
      </div>
    </div>
  );
};
