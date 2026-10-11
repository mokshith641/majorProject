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
    <div className="w-full max-w-md card-enterprise p-8 space-y-6 shadow-md">
      <div className="text-center">
        <h2 className="text-[24px] font-semibold text-[var(--text-primary)] tracking-tight">Reset Password</h2>
        <p className="text-[14px] text-[var(--text-secondary)] mt-1">Retrieve verification credentials to update login details</p>
      </div>

      {recoveryToken ? (
        <div className="space-y-6">
          <div className="bg-[var(--bg-card-secondary)] border border-[var(--border-subtle)] p-5 rounded-xl text-center">
            <Key className="h-8 w-8 text-[var(--color-brand)] mx-auto mb-3" />
            <p className="text-[14px] text-[var(--text-secondary)] mb-2">Use the verification token below to update your password:</p>
            <code className="block bg-[var(--bg-elevated)] p-2.5 text-[var(--color-brand)] rounded-lg font-mono text-[13px] select-all border border-[var(--border-subtle)]">
              {recoveryToken}
            </code>
          </div>

          <Link
            to={PATHS.RESET_PASSWORD}
            className="btn-primary w-full py-2.5 text-[14px] text-center block"
          >
            Continue to Set New Password
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {errorMsg && (
            <div className="badge-error w-full p-3 rounded-lg text-[13px]">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-[13px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
              Account Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
              <input
                type="email"
                {...register('email', { required: 'Email address is required' })}
                placeholder="you@example.com"
                className="input-enterprise pl-10 pr-4 py-2.5 text-[14px]"
              />
            </div>
            {errors.email && <p className="text-[var(--color-error)] text-[12px] mt-1">{errors.email.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full py-2.5 text-[14px] disabled:opacity-50 mt-4 cursor-pointer gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating Verification Code...
              </>
            ) : (
              'Send Recovery Instructions'
            )}
          </button>
        </form>
      )}

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
