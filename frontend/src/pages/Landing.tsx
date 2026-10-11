import React from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../routes/paths';
import { Cpu, Sparkles, Mic } from 'lucide-react';

export const Landing: React.FC = () => {
  return (
    <div className="max-w-6xl w-full text-center py-12 md:py-20 flex flex-col items-center">
      {/* Badge container */}
      <div className="badge-brand text-[13px] py-1 px-3.5 mb-6">
        <Sparkles className="h-3.5 w-3.5" />
        Intelligent Meeting Transcription & Telemetry Suite
      </div>

      {/* Hero Title */}
      <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-[var(--text-primary)] max-w-3xl leading-[1.2] mb-6">
        Smart Meetings with{' '}
        <span className="text-[var(--color-brand)]">
          Engagement Telemetry
        </span>
      </h1>

      {/* Hero Description */}
      <p className="text-[17px] text-[var(--text-secondary)] max-w-2xl leading-relaxed mb-10">
        Enterprise-grade meeting transcription, voice diarization, executive summaries, action item extraction, and productivity telemetry.
      </p>

      {/* Hero CTA buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3.5 mb-20">
        <Link
          to={PATHS.REGISTER}
          className="btn-primary text-[15px] py-2.5 px-6 rounded-lg"
        >
          Create Free Account
        </Link>
        <Link
          to={PATHS.LOGIN}
          className="btn-secondary text-[15px] py-2.5 px-6 rounded-lg"
        >
          Sign In to Dashboard
        </Link>
      </div>

      {/* Core Highlights grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
        <div className="card-enterprise p-6 sm:p-7 relative overflow-hidden">
          <div className="h-12 w-12 bg-[var(--bg-elevated)] text-[var(--color-brand)] border border-[var(--border-subtle)] rounded-xl flex items-center justify-center mb-5">
            <Mic className="h-6 w-6" />
          </div>
          <h3 className="text-[18px] font-semibold text-[var(--text-primary)] tracking-tight mb-2">Groq Whisper & Diarization</h3>
          <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
            Record audio directly or upload recordings for rapid Whisper Large V3 transcription with AssemblyAI speaker diarization and timestamp alignment.
          </p>
        </div>

        <div className="card-enterprise p-6 sm:p-7 relative overflow-hidden">
          <div className="h-12 w-12 bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success)]/20 rounded-xl flex items-center justify-center mb-5">
            <Cpu className="h-6 w-6" />
          </div>
          <h3 className="text-[18px] font-semibold text-[var(--text-primary)] tracking-tight mb-2">Attention CV Tracking</h3>
          <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
            Monitor gaze focus, facial engagement, and interaction telemetry securely with local computer vision processing.
          </p>
        </div>

        <div className="card-enterprise p-6 sm:p-7 relative overflow-hidden">
          <div className="h-12 w-12 bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning)]/20 rounded-xl flex items-center justify-center mb-5">
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="text-[18px] font-semibold text-[var(--text-primary)] tracking-tight mb-2">Executive Summaries & Neural Search</h3>
          <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
            Extract decisions, risk logs, and export polished PDF summaries. Query transcripts instantly with semantic intelligence.
          </p>
        </div>
      </div>
    </div>
  );
};
