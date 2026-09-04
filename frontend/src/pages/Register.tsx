import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';
import { PATHS } from '../routes/paths';
import { AlertCircle, User, Mail, Lock, Loader2, CheckCircle2 } from 'lucide-react';

interface RegisterFormInputs {
  email: string;
  name: string;
  password: string;
  role: string;
}

export const Register: React.FC = () => {
  const { registerUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as any)?.from;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormInputs>({
    defaultValues: {
      role: 'user',
    },
  });

  const onSubmit = async (data: RegisterFormInputs) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await registerUser(data.email, data.password, data.name, data.role);
      setSuccess(true);
      setTimeout(() => {
        navigate(PATHS.LOGIN, { state: { from } });
      }, 2500);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(
        e.response?.data?.detail || 'Registration failed. Please check inputs and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md glass-card rounded-2xl p-8 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1a73e8] via-[#34a853] to-[#fbbc05]"></div>

      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Create Account</h2>
        <p className="text-[var(--text-secondary)] text-sm">Register to start managing meeting telemetry</p>
      </div>

      {success && (
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 p-4 rounded-xl text-sm mb-6">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>Registration successful! Redirecting to login...</span>
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
            Full Name
          </label>
          <div className="relative">
            <User className="absolute left-3.5 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="text"
              {...register('name', { required: 'Full name is required' })}
              placeholder="Moksh"
              className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] focus:border-[#1a73e8] text-[var(--text-primary)] rounded-xl pl-10 pr-4 py-2.5 text-sm transition-all outline-none"
            />
          </div>
          {errors.name && <p className="text-rose-600 dark:text-rose-400 text-xs mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
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
                  message: 'Invalid email address',
                },
              })}
              placeholder="moksh@example.com"
              className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] focus:border-[#1a73e8] text-[var(--text-primary)] rounded-xl pl-10 pr-4 py-2.5 text-sm transition-all outline-none"
            />
          </div>
          {errors.email && <p className="text-rose-600 dark:text-rose-400 text-xs mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
            Password (Min 6 chars)
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="password"
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 6, message: 'Password must be at least 6 characters' },
              })}
              placeholder="••••••••"
              className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] focus:border-[#1a73e8] text-[var(--text-primary)] rounded-xl pl-10 pr-4 py-2.5 text-sm transition-all outline-none"
            />
          </div>
          {errors.password && <p className="text-rose-600 dark:text-rose-400 text-xs mt-1">{errors.password.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
            Platform Role
          </label>
          <select
            {...register('role')}
            className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] focus:border-[#1a73e8] text-[var(--text-primary)] rounded-xl px-3.5 py-2.5 text-sm transition-all outline-none cursor-pointer"
          >
            <option value="user">Standard User</option>
            <option value="admin">Administrator</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || success}
          className="w-full py-3 bg-[#1a73e8] hover:bg-[#1967d2] disabled:opacity-50 text-white font-medium rounded-xl shadow-xs hover:shadow-md transition-all text-sm flex items-center justify-center gap-2 mt-6 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Registering User...
            </>
          ) : (
            'Sign Up'
          )}
        </button>
      </form>

      <div className="mt-8 text-center text-sm text-[var(--text-secondary)]">
        Already have an account?{' '}
        <Link to={PATHS.LOGIN} state={{ from }} className="text-[#1a73e8] hover:text-[#1967d2] font-semibold transition-colors">
          Sign In
        </Link>
      </div>
    </div>
  );
};
