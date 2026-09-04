import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';
import { PATHS } from '../routes/paths';
import { AlertCircle, Lock, Mail, Loader2 } from 'lucide-react';

interface LoginFormInputs {
  email: string;
  password: string;
}

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormInputs>();

  const from = (location.state as any)?.from?.pathname || PATHS.DASHBOARD;

  const onSubmit = async (data: LoginFormInputs) => {
    setIsSubmitting(true);
    setErrorMsg(null);

    const body = new FormData();
    body.append('username', data.email);
    body.append('password', data.password);

    try {
      await login(body);
      navigate(from, { replace: true });
    } catch (e: any) {
      console.error(e);
      setErrorMsg(
        e.response?.data?.detail || 'Authentication failed. Please verify credentials.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md glass-card rounded-2xl p-8 shadow-xl relative overflow-hidden">
      {/* Google decorative top accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1a73e8] via-[#34a853] to-[#fbbc05]"></div>

      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Welcome Back</h2>
        <p className="text-[var(--text-secondary)] text-sm">Access your meeting intelligence dashboard</p>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 p-3.5 rounded-xl text-sm mb-6">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="email"
              {...register('email', {
                required: 'Email address is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address syntax',
                },
              })}
              placeholder="you@example.com"
              className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] focus:border-[#1a73e8] text-[var(--text-primary)] rounded-xl pl-10 pr-4 py-2.5 text-sm transition-all outline-none"
            />
          </div>
          {errors.email && <p className="text-rose-600 dark:text-rose-400 text-xs mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Password
            </label>
            <Link
              to={PATHS.FORGOT_PASSWORD}
              className="text-xs text-[#1a73e8] hover:text-[#1967d2] font-medium transition-colors"
            >
              Forgot?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="password"
              {...register('password', {
                required: 'Password is required',
              })}
              placeholder="••••••••"
              className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] focus:border-[#1a73e8] text-[var(--text-primary)] rounded-xl pl-10 pr-4 py-2.5 text-sm transition-all outline-none"
            />
          </div>
          {errors.password && <p className="text-rose-600 dark:text-rose-400 text-xs mt-1">{errors.password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-[#1a73e8] hover:bg-[#1967d2] disabled:opacity-50 text-white font-medium rounded-xl shadow-xs hover:shadow-md transition-all text-sm flex items-center justify-center gap-2 mt-4 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing In...
            </>
          ) : (
            'Sign In'
          )}
        </button>
      </form>

      <div className="mt-8 text-center text-sm text-[var(--text-secondary)]">
        Don't have an account?{' '}
        <Link to={PATHS.REGISTER} className="text-[#1a73e8] hover:text-[#1967d2] font-semibold transition-colors">
          Get Started
        </Link>
      </div>
    </div>
  );
};
