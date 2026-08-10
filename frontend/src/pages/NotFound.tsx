import React from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../routes/paths';
import { HelpCircle, ArrowLeft } from 'lucide-react';

export const NotFound: React.FC = () => {
  return (
    <div className="text-center py-20 space-y-6 max-w-md mx-auto">
      <div className="h-16 w-16 bg-brand-500/10 text-brand-500 rounded-full flex items-center justify-center mx-auto border border-brand-500/20">
        <HelpCircle className="h-8 w-8" />
      </div>
      
      <div className="space-y-2">
        <h2 className="text-3xl font-extrabold text-white">404 - Not Found</h2>
        <p className="text-slate-400 text-sm">
          The requested page route could not be resolved or doesn't exist.
        </p>
      </div>

      <Link
        to={PATHS.DASHBOARD}
        className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-lg shadow-lg hover:shadow-indigo-600/10 transition-all text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Return to Dashboard
      </Link>
    </div>
  );
};
