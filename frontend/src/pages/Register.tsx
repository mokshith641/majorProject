import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        navigate(PATHS.LOGIN);
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
    <div className="w-full max-w-md glass-card rounded-2xl p-8 shadow-2xl relative overflow-hidden border border-slate-800">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600"></div>

      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Create Account</h2>
        <p className="text-slate-400 text-sm">Register to start managing meeting telemetry</p>
      </div>

      {success && (
        <div className="flex items-center gap-2 bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 p-4 rounded-lg text-sm mb-6 animate-pulse">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>Registration successful! Redirecting to login...</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 bg-red-950/20 border border-red-500/30 text-red-300 p-3 rounded-lg text-sm mb-6">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Full Name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <input
              type="text"
              {...register('name', { required: 'Full name is required' })}
              placeholder="Moksh"
              className="w-full bg-[#090D16] border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white rounded-lg pl-10 pr-4 py-2.5 text-sm transition-all outline-none"
            />
          </div>
          {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
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
                  message: 'Invalid email address',
                },
              })}
              placeholder="moksh@example.com"
              className="w-full bg-[#090D16] border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white rounded-lg pl-10 pr-4 py-2.5 text-sm transition-all outline-none"
            />
          </div>
          {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Password (Min 6 chars)
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <input
              type="password"
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 6, message: 'Password must be at least 6 characters' },
              })}
              placeholder="••••••••"
              className="w-full bg-[#090D16] border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white rounded-lg pl-10 pr-4 py-2.5 text-sm transition-all outline-none"
            />
          </div>
          {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Platform Role
          </label>
          <select
            {...register('role')}
            className="w-full bg-[#090D16] border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white rounded-lg px-3 py-2.5 text-sm transition-all outline-none cursor-pointer"
          >
            <option value="user">Standard User</option>
            <option value="admin">Administrator</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || success}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 text-white font-medium rounded-lg shadow-lg hover:shadow-indigo-600/10 transition-all text-sm flex items-center justify-center gap-2 mt-6"
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

      <div className="mt-8 text-center text-sm text-slate-400">
        Already have an account?{' '}
        <Link to={PATHS.LOGIN} className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
          Sign In
        </Link>
      </div>
    </div>
  );
};
