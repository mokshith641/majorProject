import React from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../routes/paths';
import { Video, ShieldAlert, Cpu, Sparkles, Mic, FileBarChart } from 'lucide-react';

export const Landing: React.FC = () => {
  return (
    <div className="max-w-6xl w-full text-center py-12 md:py-20 flex flex-col items-center">
      {/* Badge container */}
      <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full text-xs font-semibold text-indigo-400 mb-6 animate-pulse">
        <Sparkles className="h-3 w-3" />
        Now Live: Intelligent Meeting Intelligence Suite
      </div>

      {/* Hero Title */}
      <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-white max-w-3xl leading-[1.1] mb-6">
        AI-Powered Smart Meetings with{' '}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-500">
          Engagement Telemetry
        </span>
      </h1>

      {/* Hero Description */}
      <p className="text-lg text-slate-400 max-w-2xl leading-relaxed mb-10">
        Unlock executive transcription, detailed Llama-extracted notes, action items schedules, and gaze focus analysis locally on your laptop. No cloud queues, no data leaks.
      </p>

      {/* Hero CTA buttons */}
      <div className="flex flex-wrap items-center justify-center gap-4 mb-20">
        <Link
          to={PATHS.REGISTER}
          className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg hover:shadow-indigo-600/30 transition-all text-sm"
        >
          Create Free Account
        </Link>
        <Link
          to={PATHS.LOGIN}
          className="px-6 py-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 font-medium transition-all text-sm"
        >
          Sign In Dashboard
        </Link>
      </div>

      {/* Core Highlights grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="h-10 w-10 bg-indigo-600/10 text-indigo-400 rounded-lg flex items-center justify-center mb-4">
            <Mic className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Local Whisper Transcriptions</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Record audio directly from your browser. Our local Whisper integration translates voice to timestamped segments instantly.
          </p>
        </div>

        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="h-10 w-10 bg-indigo-600/10 text-indigo-400 rounded-lg flex items-center justify-center mb-4">
            <Cpu className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Gaze & Attention CV Tracking</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Leverage OpenCV and MediaPipe FaceMesh to calculate eye attention alignment and input activity logs locally in real-time.
          </p>
        </div>

        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="h-10 w-10 bg-indigo-600/10 text-indigo-400 rounded-lg flex items-center justify-center mb-4">
            <Sparkles className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Llama AI Summary & Search</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Generate action items, risks, and roadmap tasks using Llama 3.1. Query historical transcripts using semantic search.
          </p>
        </div>
      </div>

      {/* Tech Stack Specs */}
      <div className="mt-20 border-t border-slate-800/80 pt-10 w-full">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Designed With Standard Major Project Technologies</h4>
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400 font-medium">
          <span>React & TypeScript</span>
          <span className="text-slate-600">•</span>
          <span>FastAPI</span>
          <span className="text-slate-600">•</span>
          <span>PostgreSQL</span>
          <span className="text-slate-600">•</span>
          <span>OpenCV & MediaPipe</span>
          <span className="text-slate-600">•</span>
          <span>faster-whisper</span>
          <span className="text-slate-600">•</span>
          <span>Groq Llama 3.1</span>
        </div>
      </div>
    </div>
  );
};
