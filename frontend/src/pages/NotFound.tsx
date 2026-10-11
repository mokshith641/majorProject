import React from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../routes/paths';
import { HelpCircle, ArrowLeft } from 'lucide-react';

export const NotFound: React.FC = () => {
  return (
    <div className="text-center py-20 space-y-6 max-w-md mx-auto">
      <div className="h-16 w-16 bg-[var(--bg-elevated)] text-[var(--color-brand)] border border-[var(--border-subtle)] rounded-2xl flex items-center justify-center mx-auto">
        <HelpCircle className="h-8 w-8" />
      </div>
      
      <div className="space-y-2">
        <h2 className="text-[26px] font-semibold text-[var(--text-primary)] tracking-tight">404 - Not Found</h2>
        <p className="text-[14px] text-[var(--text-secondary)]">
          The requested page route could not be resolved or doesn't exist.
        </p>
      </div>

      <Link
        to={PATHS.DASHBOARD}
        className="btn-primary text-[14px] py-2 px-5 gap-2 rounded-lg"
      >
        <ArrowLeft className="h-4 w-4" />
        Return to Dashboard
      </Link>
    </div>
  );
};
