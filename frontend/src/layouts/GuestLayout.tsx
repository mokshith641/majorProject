import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { PATHS } from '../routes/paths';

export const GuestLayout: React.FC = () => {
  return (
    <div className="min-h-screen w-screen bg-[#090D16] text-slate-100 flex flex-col relative overflow-hidden selection:bg-indigo-500 selection:text-white">
      {/* Dynamic ambient backgrounds */}
      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-brand-700/10 filter blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-[45vw] h-[45vw] rounded-full bg-indigo-500/10 filter blur-[150px] pointer-events-none"></div>

      {/* Guest top navbar */}
      <header className="h-16 flex items-center justify-between px-6 sm:px-12 border-b border-slate-800/40 backdrop-blur-md z-10">
        <Link to={PATHS.LANDING} className="flex items-center gap-2 font-bold text-lg text-indigo-400">
          <span className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">M</span>
          Meeting Assistant
        </Link>
        <div className="flex items-center gap-4">
          <Link to={PATHS.LOGIN} className="text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors">
            Sign In
          </Link>
          <Link
            to={PATHS.REGISTER}
            className="text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg shadow-lg hover:shadow-indigo-600/20 transition-all"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Main router page wrapper */}
      <main className="flex-1 flex flex-col justify-center items-center p-6 relative z-10">
        <Outlet />
      </main>
    </div>
  );
};
