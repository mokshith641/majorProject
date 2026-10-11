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
      }, 2000);
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
    <div className="w-full max-w-md card-enterprise p-8 space-y-6 shadow-md">
      <div className="text-center">
        <h2 className="text-[24px] font-semibold text-[var(--text-primary)] tracking-tight">Create Account</h2>
        <p className="text-[14px] text-[var(--text-secondary)] mt-1">Register to start managing meeting telemetry</p>
      </div>

      {success && (
        <div className="badge-success w-full p-3.5 rounded-lg text-[13px] flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Registration successful! Redirecting to login...</span>
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
            Full Name
          </label>
          <div className="relative">
            <User className="absolute left-3.5 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="text"
              {...register('name', { required: 'Full name is required' })}
              placeholder="Your Name"
              className="input-enterprise pl-10 pr-4 py-2.5 text-[14px]"
            />
          </div>
          {errors.name && <p className="text-[var(--color-error)] text-[12px] mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <label className="block text-[13px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
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
              placeholder="you@example.com"
              className="input-enterprise pl-10 pr-4 py-2.5 text-[14px]"
            />
          </div>
          {errors.email && <p className="text-[var(--color-error)] text-[12px] mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-[13px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
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
              className="input-enterprise pl-10 pr-4 py-2.5 text-[14px]"
            />
          </div>
          {errors.password && <p className="text-[var(--color-error)] text-[12px] mt-1">{errors.password.message}</p>}
        </div>

        <div>
          <label className="block text-[13px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
            Platform Role
          </label>
          <select
            {...register('role')}
            className="input-enterprise py-2.5 text-[14px] cursor-pointer"
          >
            <option value="user">Standard User</option>
            <option value="admin">Administrator</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || success}
          className="btn-primary w-full py-2.5 text-[14px] disabled:opacity-50 mt-6 cursor-pointer gap-2"
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

      <div className="text-center text-[14px] text-[var(--text-secondary)] pt-2 border-t border-[var(--border-subtle)]">
        Already have an account?{' '}
        <Link to={PATHS.LOGIN} state={{ from }} className="text-[var(--color-brand)] hover:text-[var(--color-brand-hover)] font-semibold transition-colors">
          Sign In
        </Link>
      </div>
    </div>
  );
};
