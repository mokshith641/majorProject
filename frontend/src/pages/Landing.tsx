import React from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../routes/paths';
import { Cpu, Sparkles, Mic } from 'lucide-react';

export const Landing: React.FC = () => {
  return (
    <div className="max-w-6xl w-full text-center py-12 md:py-20 flex flex-col items-center">
      {/* Badge container */}
      <div className="inline-flex items-center gap-2 bg-[#e8f0fe] border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#174ea6] dark:text-blue-300 mb-6">
        <Sparkles className="h-3.5 w-3.5 text-[#1a73e8]" />
        Intelligent Meeting Intelligence & Telemetry Suite
      </div>

      {/* Hero Title */}
      <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-[var(--text-primary)] max-w-3xl leading-[1.15] mb-6">
        Smart Meetings with{' '}
        <span className="text-[#1a73e8] dark:text-blue-400">
          Engagement Telemetry
        </span>
      </h1>

      {/* Hero Description */}
      <p className="text-lg text-[var(--text-secondary)] max-w-2xl leading-relaxed mb-10">
        Unlock real-time live captions, local Whisper speech transcription, executive AI summaries, action items extraction, and attention focus tracking right in your browser.
      </p>

      {/* Hero CTA buttons */}
      <div className="flex flex-wrap items-center justify-center gap-4 mb-20">
        <Link
          to={PATHS.REGISTER}
          className="px-6 py-3 rounded-xl bg-[#1a73e8] hover:bg-[#1967d2] text-white font-medium shadow-xs hover:shadow-md transition-all text-sm cursor-pointer"
        >
          Create Free Account
        </Link>
        <Link
          to={PATHS.LOGIN}
          className="px-6 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] font-medium transition-all text-sm cursor-pointer shadow-xs"
        >
          Sign In Dashboard
        </Link>
      </div>

      {/* Core Highlights grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
        <div className="glass-card p-6 rounded-2xl relative overflow-hidden">
          <div className="h-12 w-12 bg-blue-500/10 text-[#1a73e8] dark:text-blue-400 rounded-xl flex items-center justify-center mb-4">
            <Mic className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Live Voice Captions & Whisper</h3>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
            Record audio directly or transcribe speech in real-time with Google Meet style closed captions and high-speed local Whisper models.
          </p>
        </div>

        <div className="glass-card p-6 rounded-2xl relative overflow-hidden">
          <div className="h-12 w-12 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center mb-4">
            <Cpu className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Attention CV Tracking</h3>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
            Monitor gaze focus, facial engagement, and interaction telemetry securely with local computer vision processing.
          </p>
        </div>

        <div className="glass-card p-6 rounded-2xl relative overflow-hidden">
          <div className="h-12 w-12 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center mb-4">
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">AI Summary & Neural Search</h3>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
            Extract decisions, risk logs, and export polished PDF summaries. Query transcripts instantly with semantic intelligence.
          </p>
        </div>
      </div>
    </div>
  );
};
