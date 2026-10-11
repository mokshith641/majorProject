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
    <div className="w-full max-w-md card-enterprise p-8 space-y-6 shadow-md">
      <div className="text-center">
        <h2 className="text-[24px] font-semibold text-[var(--text-primary)] tracking-tight">Welcome Back</h2>
        <p className="text-[14px] text-[var(--text-secondary)] mt-1">Access your meeting intelligence dashboard</p>
      </div>

      {errorMsg && (
        <div className="badge-error w-full p-3 rounded-lg text-[13px] flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-[13px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-3 h-4 w-4 text-[var(--text-muted)]" />
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
              className="input-enterprise pl-10 pr-4 py-2.5 text-[14px]"
            />
          </div>
          {errors.email && <p className="text-[var(--color-error)] text-[12px] mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[13px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Password
            </label>
            <Link
              to={PATHS.FORGOT_PASSWORD}
              className="text-[13px] text-[var(--color-brand)] hover:text-[var(--color-brand-hover)] font-medium transition-colors"
            >
              Forgot?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-3 h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="password"
              {...register('password', {
                required: 'Password is required',
              })}
              placeholder="••••••••"
              className="input-enterprise pl-10 pr-4 py-2.5 text-[14px]"
            />
          </div>
          {errors.password && <p className="text-[var(--color-error)] text-[12px] mt-1">{errors.password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary w-full py-2.5 text-[14px] disabled:opacity-50 mt-4 cursor-pointer gap-2"
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

      <div className="text-center text-[14px] text-[var(--text-secondary)] pt-2 border-t border-[var(--border-subtle)]">
        Don&apos;t have an account?{' '}
        <Link to={PATHS.REGISTER} className="text-[var(--color-brand)] hover:text-[var(--color-brand-hover)] font-semibold transition-colors">
          Get Started
        </Link>
      </div>
    </div>
  );
};
