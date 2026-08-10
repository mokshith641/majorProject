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
    <div className="w-full max-w-md glass-card rounded-2xl p-8 shadow-2xl relative overflow-hidden border border-slate-800">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600"></div>

      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Reset Password</h2>
        <p className="text-slate-400 text-sm">Retrieve verification credentials to update login details</p>
      </div>

      {recoveryToken ? (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center">
            <Key className="h-8 w-8 text-indigo-400 mx-auto mb-3" />
            <p className="text-sm text-slate-300 mb-2">Use the verification token below to update your password:</p>
            <code className="block bg-[#090D16] p-2 text-indigo-300 rounded font-mono text-xs select-all border border-indigo-900/50">
              {recoveryToken}
            </code>
          </div>

          <Link
            to={PATHS.RESET_PASSWORD}
            className="block text-center w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg shadow-lg hover:shadow-indigo-600/10 transition-all text-sm"
          >
            Go to Reset Screen
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {errorMsg && <p className="text-red-400 text-xs text-center bg-red-950/20 p-2 rounded border border-red-950">{errorMsg}</p>}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Registered Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input
                type="email"
                {...register('email', { required: 'Email address is required' })}
                placeholder="you@example.com"
                className="w-full bg-[#090D16] border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white rounded-lg pl-10 pr-4 py-2.5 text-sm transition-all outline-none"
              />
            </div>
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 text-white font-medium rounded-lg shadow-lg transition-all text-sm flex items-center justify-center gap-2"
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
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Sign In
        </Link>
      </div>
    </div>
  );
};
