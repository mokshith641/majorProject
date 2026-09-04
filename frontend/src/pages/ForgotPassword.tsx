import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';
import { PATHS } from '../routes/paths';
import { Mail, ArrowLeft, Loader2, Key } from 'lucide-react';

interface ForgotPasswordInputs {
  email: string;
}

export const ForgotPassword: React.FC = () => {
  const { forgotPassword } = useAuth();
  const navigate = useNavigate();
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInputs>();

  const onSubmit = async (data: ForgotPasswordInputs) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const token = await forgotPassword(data.email);
      setRecoveryToken(token);
    } catch (e: any) {
      setErrorMsg(e.response?.data?.detail || 'Failed to initiate password recovery.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md glass-card rounded-2xl p-8 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1a73e8] via-[#34a853] to-[#fbbc05]"></div>

      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Reset Password</h2>
        <p className="text-[var(--text-secondary)] text-sm">Retrieve verification credentials to update login details</p>
      </div>

      {recoveryToken ? (
        <div className="space-y-6">
          <div className="bg-[var(--bg-card-secondary)] border border-[var(--border-subtle)] p-4 rounded-xl text-center">
            <Key className="h-8 w-8 text-[#1a73e8] dark:text-blue-400 mx-auto mb-3" />
            <p className="text-sm text-[var(--text-secondary)] mb-2">Use the verification token below to update your password:</p>
            <code className="block bg-[var(--bg-input)] p-2.5 text-[#174ea6] dark:text-blue-300 rounded-lg font-mono text-xs select-all border border-[var(--border-strong)]">
              {recoveryToken}
            </code>
          </div>

          <Link
            to={PATHS.RESET_PASSWORD}
            className="block text-center w-full py-3 bg-[#1a73e8] hover:bg-[#1967d2] text-white font-medium rounded-xl shadow-xs hover:shadow-md transition-all text-sm cursor-pointer"
          >
            Go to Reset Screen
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {errorMsg && (
            <p className="text-rose-700 dark:text-rose-400 text-xs text-center bg-rose-50 dark:bg-rose-950/20 p-3 rounded-xl border border-rose-200 dark:border-rose-950">
              {errorMsg}
            </p>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
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

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-[#1a73e8] hover:bg-[#1967d2] disabled:opacity-50 text-white font-medium rounded-xl shadow-xs hover:shadow-md transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Validating...
              </>
            ) : (
              'Generate Verification Code'
            )}
          </button>
        </form>
      )}

      <div className="mt-8 text-center">
        <Link
          to={PATHS.LOGIN}
          className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Sign In
        </Link>
      </div>
    </div>
  );
};
