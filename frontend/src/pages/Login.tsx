import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';
import { PATHS } from '../routes/paths';
import { AlertCircle, Lock, Mail, Loader2 } from 'lucide-react';

interface LoginFormInputs {
  email: string;
  password: str;
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

  // Determine redirection target (default to dashboard)
  const from = (location.state as any)?.from?.pathname || PATHS.DASHBOARD;

  const onSubmit = async (data: LoginFormInputs) => {
    setIsSubmitting(true);
    setErrorMsg(null);

    // OAuth2 password bearer expects urlencoded form body
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
    <div className="w-full max-w-md glass-card rounded-2xl p-8 shadow-2xl relative overflow-hidden border border-slate-800">
      {/* Decorative accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600"></div>

      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Welcome Back</h2>
        <p className="text-slate-400 text-sm">Access your meeting intelligence dashboard</p>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 bg-red-950/20 border border-red-500/30 text-red-300 p-3 rounded-lg text-sm mb-6">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
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
              className="w-full bg-[#090D16] border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white rounded-lg pl-10 pr-4 py-2.5 text-sm transition-all outline-none"
            />
          </div>
          {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Password
            </label>
            <Link
              to={PATHS.FORGOT_PASSWORD}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Forgot?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <input
              type="password"
              {...register('password', {
                required: 'Password is required',
              })}
              placeholder="••••••••"
              className="w-full bg-[#090D16] border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white rounded-lg pl-10 pr-4 py-2.5 text-sm transition-all outline-none"
            />
          </div>
          {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 text-white font-medium rounded-lg shadow-lg hover:shadow-indigo-600/10 transition-all text-sm flex items-center justify-center gap-2 mt-4"
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

      <div className="mt-8 text-center text-sm text-slate-400">
        Don't have an account?{' '}
        <Link to={PATHS.REGISTER} className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
          Get Started
        </Link>
      </div>
    </div>
  );
};
