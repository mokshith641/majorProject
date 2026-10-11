import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { PATHS } from '../routes/paths';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  Users,
  Brain,
  BarChart,
  FileText,
  CheckCircle,
  AlertTriangle,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Cpu,
  RefreshCw,
  Check,
  Activity,
  Layers,
  Sparkles,
  Volume2
} from 'lucide-react';

interface Participant {
  id: number;
  name: string;
  email: string | null;
  join_time: string;
}

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  raw_text?: string;
  cleaned_text?: string;
  speaker?: string;
  speaker_name?: string;
  speaker_id?: string;
  confidence?: number;
  quality_flags?: string[];
  overlap?: boolean;
}

interface TranscriptData {
  full_text: string;
  raw_transcript?: string;
  cleaned_transcript?: string;
  raw_segments: TranscriptSegment[];
  diagnostics?: Record<string, any>;
}

interface ActionItem {
  task: string;
  assignee: string;
  due_date: string;
  status: string;
}

interface SummaryData {
  key_points: string;
  decisions: string;
  risks: string;
  next_steps: string;
  action_items: ActionItem[];
}

interface MeetingDetailsType {
  id: number;
  title: string;
  date: string;
  duration_seconds: number;
  status: string;
  participants: Participant[];
  transcript?: TranscriptData;
  summary?: SummaryData;
}

interface TelemetryLog {
  keyboard_hits: number;
  mouse_clicks: number;
  idle_seconds: number;
  active_window: string;
  face_present_seconds: number;
  eye_attention_score: number;
  focus_score: number;
}

interface PipelineStage {
  key: string;
  label: string;
}

interface ProcessingStatusType {
  status: string;
  progress: number;
  step: string;
  current_stage?: string;
  stages?: PipelineStage[];
  error?: string | null;
}

const DEFAULT_STAGES: PipelineStage[] = [
  { key: 'UPLOADING', label: 'Audio Ingestion' },
  { key: 'PREPROCESSING', label: 'Audio Prep' },
  { key: 'TRANSCRIBING', label: 'Whisper STT' },
  { key: 'DIARIZING', label: 'AssemblyAI Diarization' },
  { key: 'ALIGNING', label: 'Alignment' },
  { key: 'SUMMARIZING', label: 'AI Summaries' },
  { key: 'COMPLETED', label: 'Ready' },
];

export const MeetingDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<MeetingDetailsType | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryLog | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatusType | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'engagement'>('summary');
  const [transcriptViewMode, setTranscriptViewMode] = useState<'cleaned' | 'raw'>('cleaned');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMeeting = async () => {
      try {
        const res = await api.get<MeetingDetailsType>(`/meetings/${id}`);
        setMeeting(res.data);

        // Fetch telemetry
        try {
          const telemRes = await api.get<TelemetryLog>(`/analytics/meeting/${id}`);
          setTelemetry(telemRes.data);
        } catch {
          // Telemetry is optional
        }

        // Fetch pipeline status if meeting is processing
        if (res.data.status === 'processing') {
          try {
            const statusRes = await api.get<ProcessingStatusType>(`/meetings/${id}/processing-status`);
            setProcessingStatus(statusRes.data);
          } catch {
            // Processing status might not exist yet
          }
        }
      } catch (e) {
        console.error('Failed to load meeting details:', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMeeting();
  }, [id]);

  // Polling for processing status if status === 'processing'
  useEffect(() => {
    if (!meeting || meeting.status !== 'processing') return;

    const interval = setInterval(async () => {
      try {
        const [statusRes, meetingRes] = await Promise.all([
          api.get<ProcessingStatusType>(`/meetings/${id}/processing-status`),
          api.get<MeetingDetailsType>(`/meetings/${id}`),
        ]);
        setProcessingStatus(statusRes.data);
        setMeeting(meetingRes.data);

        if (statusRes.data.status === 'COMPLETED' || meetingRes.data.status === 'completed') {
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Error polling meeting status:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [id, meeting?.status]);

  const handleDownloadPDF = async () => {
    try {
      const response = await api.get(`/reports/${id}/download`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Meeting_Report_${meeting?.title || id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error('Download error:', err);
      alert('Report is being processed or unavailable.');
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  const formatTimestamp = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Restrained enterprise color mapping for speakers
  const speakerPalette = [
    '#2563EB', // Blue
    '#12805C', // Emerald
    '#7C3AED', // Purple
    '#D97706', // Amber
    '#DC2626', // Crimson
    '#0891B2', // Cyan
  ];

  const speakerColorMap = new Map<string, string>();
  let paletteIdx = 0;

  const getSpeakerColor = (speakerName: string) => {
    const name = speakerName || 'Speaker 1';
    if (!speakerColorMap.has(name)) {
      speakerColorMap.set(name, speakerPalette[paletteIdx % speakerPalette.length]);
      paletteIdx++;
    }
    return speakerColorMap.get(name)!;
  };

  const safeActionItems = (): ActionItem[] => {
    const raw = meeting?.summary?.action_items;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    }
    return [];
  };

  // Helper to highlight matching search text
  const highlightSearch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-amber-200 text-amber-950 dark:bg-amber-900/60 dark:text-amber-200 px-1 py-0.5 rounded font-semibold">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Filter segments based on search
  const rawSegmentsList = meeting?.transcript?.raw_segments || [];
  const filteredSegments = rawSegmentsList.filter((seg) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const textToSearch = (transcriptViewMode === 'cleaned' ? seg.cleaned_text || seg.text : seg.raw_text || seg.text) || '';
    const speakerToSearch = seg.speaker_name || seg.speaker || '';
    return textToSearch.toLowerCase().includes(q) || speakerToSearch.toLowerCase().includes(q);
  });

  const diagnosticsData = meeting?.transcript?.diagnostics || {};

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-[var(--color-brand)] border-t-transparent"></div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="card-enterprise text-center py-16 space-y-4">
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">Meeting record not found</h2>
        <Link to={PATHS.MEETING_HISTORY} className="btn-primary text-sm py-2 px-4">
          Return to History
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Top Navigation & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={PATHS.MEETING_HISTORY}
          className="btn-secondary text-[13px] py-1.5 px-3 rounded-lg gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to History
        </Link>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowDebugPanel(!showDebugPanel)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[13px] font-medium transition-all cursor-pointer ${
              showDebugPanel
                ? 'bg-[var(--bg-elevated)] border-[var(--border-strong)] text-[var(--text-primary)] font-semibold'
                : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-card)]'
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            Diagnostics & Debug
            {showDebugPanel ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {meeting.status === 'completed' && (
            <button
              onClick={handleDownloadPDF}
              className="btn-primary text-[13px] py-1.5 px-3.5 gap-2 rounded-lg"
            >
              <Download className="h-4 w-4" />
              Download PDF Report
            </button>
          )}
        </div>
      </div>

      {/* Main Metadata Banner */}
      <div className="card-enterprise p-6 sm:p-7 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="badge-brand text-[12px] uppercase tracking-wider font-semibold">
              Meeting Intelligence Record
            </span>
            <h1 className="text-[26px] sm:text-[30px] font-semibold text-[var(--text-primary)] mt-1.5 tracking-tight leading-tight">
              {meeting.title}
            </h1>
          </div>
          <div>
            {meeting.status === 'completed' ? (
              <span className="badge-success text-[13px] py-1 px-3 capitalize">{meeting.status}</span>
            ) : meeting.status === 'processing' ? (
              <span className="badge-warning text-[13px] py-1 px-3 live-pulse">Processing with AI...</span>
            ) : (
              <span className="badge-neutral text-[13px] py-1 px-3 capitalize">{meeting.status}</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-6 text-[14px] text-[var(--text-secondary)] border-t border-[var(--border-subtle)] pt-4">
          <span className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
            {new Date(meeting.date).toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
            {formatDuration(meeting.duration_seconds)}
          </span>
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
            {meeting.participants.length} Participants
          </span>
        </div>
      </div>

      {/* Live 7-Stage Processing Status Stepper (if meeting is in progress or processing) */}
      {meeting.status === 'processing' && (
        <div className="card-enterprise p-6 space-y-5 bg-[var(--bg-elevated)] border-[var(--border-strong)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-[var(--color-brand)] text-white flex items-center justify-center">
                <RefreshCw className="h-4 w-4 animate-spin" />
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">AI Meeting Processing Pipeline</h3>
                <p className="text-[13px] text-[var(--text-secondary)]">
                  {processingStatus?.step || 'Executing multi-tier transcription and diarization...'}
                </p>
              </div>
            </div>
            <span className="text-[14px] font-semibold font-mono text-[var(--color-brand)]">
              {processingStatus?.progress || 25}%
            </span>
          </div>

          {/* Stepper Progress Bar */}
          <div className="w-full bg-[var(--border-subtle)] h-2 rounded-full overflow-hidden">
            <div
              className="bg-[var(--color-brand)] h-full transition-all duration-500 rounded-full"
              style={{ width: `${processingStatus?.progress || 25}%` }}
            />
          </div>

          {/* Stepper Stage Nodes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-1">
            {(processingStatus?.stages || DEFAULT_STAGES).map((stg, idx) => {
              const currentKey = processingStatus?.current_stage || processingStatus?.status;
              const stageKeys = (processingStatus?.stages || DEFAULT_STAGES).map((s) => s.key);
              const currentIdx = stageKeys.indexOf(currentKey || 'UPLOADING');
              const isPast = currentIdx > idx;
              const isCurrent = currentIdx === idx;

              return (
                <div
                  key={stg.key}
                  className={`p-2.5 rounded-lg border text-center text-[12px] font-medium transition-all ${
                    isPast
                      ? 'badge-success justify-center'
                      : isCurrent
                      ? 'bg-[var(--color-brand)] text-white border-transparent shadow-xs'
                      : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-subtle)]'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 mb-1">
                    {isPast ? <Check className="h-3 w-3" /> : <Activity className="h-3 w-3" />}
                  </div>
                  <span className="block truncate">{stg.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Diagnostics & Debugging Panel (Collapsible) */}
      {showDebugPanel && (
        <div className="card-enterprise p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
            <div className="flex items-center gap-2.5">
              <Cpu className="h-5 w-5 text-[var(--color-brand)]" />
              <h3 className="text-[17px] font-semibold text-[var(--text-primary)]">Pipeline Diagnostics & Model Telemetry</h3>
            </div>
            <span className="text-[12px] bg-[var(--bg-elevated)] text-[var(--text-secondary)] px-2.5 py-1 rounded-md font-mono border border-[var(--border-subtle)]">
              Meeting #{meeting.id}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-[13px]">
            <div className="bg-[var(--bg-card-secondary)] p-3.5 rounded-xl border border-[var(--border-subtle)]">
              <span className="text-[12px] text-[var(--text-muted)] block font-medium">Speech-to-Text Engine</span>
              <strong className="text-[var(--text-primary)] block mt-0.5">
                {diagnosticsData.transcription_provider === 'groq' ? 'Groq Cloud Whisper' : diagnosticsData.transcription_provider || 'Groq Cloud Whisper'}
              </strong>
              <span className="text-[12px] text-[var(--color-brand)] font-mono block mt-0.5">
                {diagnosticsData.transcription_model || 'whisper-large-v3-turbo'}
              </span>
            </div>

            <div className="bg-[var(--bg-card-secondary)] p-3.5 rounded-xl border border-[var(--border-subtle)]">
              <span className="text-[12px] text-[var(--text-muted)] block font-medium">Speaker Diarization</span>
              <strong className="text-[var(--text-primary)] block mt-0.5">
                {diagnosticsData.diarization_provider === 'assemblyai' ? 'AssemblyAI Diarizer' : 'AssemblyAI Cloud'}
              </strong>
              <span className="text-[12px] text-[var(--color-success)] font-mono block mt-0.5">
                {diagnosticsData.detected_speakers_count || meeting.participants.length || 2} distinct speakers
              </span>
            </div>

            <div className="bg-[var(--bg-card-secondary)] p-3.5 rounded-xl border border-[var(--border-subtle)]">
              <span className="text-[12px] text-[var(--text-muted)] block font-medium">Audio Diagnostics</span>
              <strong className="text-[var(--text-primary)] block mt-0.5">
                {diagnosticsData.audio_duration_seconds ? `${diagnosticsData.audio_duration_seconds}s` : `${meeting.duration_seconds}s`}
              </strong>
              <span
                className={`text-[12px] font-medium px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                  diagnosticsData.audio_quality === 'Low'
                    ? 'badge-error'
                    : 'badge-success'
                }`}
              >
                Quality: {diagnosticsData.audio_quality || 'Normal'}
              </span>
            </div>

            <div className="bg-[var(--bg-card-secondary)] p-3.5 rounded-xl border border-[var(--border-subtle)]">
              <span className="text-[12px] text-[var(--text-muted)] block font-medium">Silence & Levels</span>
              <strong className="text-[var(--text-primary)] block mt-0.5">
                Silence: {diagnosticsData.silence_percent ?? 15}%
              </strong>
              <span className="text-[12px] text-[var(--text-muted)] font-mono block mt-0.5">
                RMS: {diagnosticsData.rms ?? 'N/A'}
              </span>
            </div>

            <div className="bg-[var(--bg-card-secondary)] p-3.5 rounded-xl border border-[var(--border-subtle)]">
              <span className="text-[12px] text-[var(--text-muted)] block font-medium">Transcript Segments</span>
              <strong className="text-[var(--text-primary)] block mt-0.5 text-[15px]">
                {diagnosticsData.transcript_segments_count || rawSegmentsList.length}
              </strong>
            </div>

            <div className="bg-[var(--bg-card-secondary)] p-3.5 rounded-xl border border-[var(--border-subtle)]">
              <span className="text-[12px] text-[var(--text-muted)] block font-medium">Diarization Intervals</span>
              <strong className="text-[var(--text-primary)] block mt-0.5 text-[15px]">
                {diagnosticsData.diarization_segments_count || 'Analyzed'}
              </strong>
            </div>

            <div className="bg-[var(--bg-card-secondary)] p-3.5 rounded-xl border border-[var(--border-subtle)]">
              <span className="text-[12px] text-[var(--text-muted)] block font-medium">Flagged Repetitions</span>
              <strong
                className={`text-[15px] block mt-0.5 ${
                  (diagnosticsData.suspicious_segments_count || 0) > 0 ? 'text-[var(--color-warning)] font-semibold' : 'text-[var(--color-success)]'
                }`}
              >
                {diagnosticsData.suspicious_segments_count || 0} flagged
              </strong>
            </div>

            <div className="bg-[var(--bg-card-secondary)] p-3.5 rounded-xl border border-[var(--border-subtle)]">
              <span className="text-[12px] text-[var(--text-muted)] block font-medium">Post-Cleanup Engine</span>
              <strong className="text-[var(--text-primary)] block mt-0.5">Gemini Flash</strong>
              <span className="text-[12px] text-[var(--text-muted)] block mt-0.5">Punctuation & Grammar</span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation tabs */}
      <div className="flex border-b border-[var(--border-subtle)] gap-2">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-5 py-3 text-[14px] sm:text-[15px] font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'summary'
              ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Brain className="h-4 w-4" />
          AI Summary & Action Items
        </button>
        <button
          onClick={() => setActiveTab('transcript')}
          className={`px-5 py-3 text-[14px] sm:text-[15px] font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'transcript'
              ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <FileText className="h-4 w-4" />
          Full Transcript ({rawSegmentsList.length})
        </button>
        <button
          onClick={() => setActiveTab('engagement')}
          className={`px-5 py-3 text-[14px] sm:text-[15px] font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'engagement'
              ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <BarChart className="h-4 w-4" />
          Engagement Analytics
        </button>
      </div>

      {/* Tab Panels */}
      <div className="mt-4">
        {/* SUMMARY TAB */}
        {activeTab === 'summary' && meeting.summary && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left AI summary */}
            <div className="lg:col-span-2 space-y-6">
              <div className="card-enterprise p-6 sm:p-7 space-y-3.5">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="h-5 w-5 text-[var(--color-brand)]" />
                  <h2 className="text-[19px] sm:text-[21px] font-semibold text-[var(--text-primary)] tracking-tight">Executive Summary</h2>
                </div>
                <p className="text-[15px] sm:text-[16px] leading-[1.65] text-[var(--text-secondary)] whitespace-pre-line font-normal">
                  {meeting.summary.key_points}
                </p>
              </div>

              <div className="card-enterprise p-6 sm:p-7 space-y-3.5">
                <h2 className="text-[19px] sm:text-[21px] font-semibold text-[var(--text-primary)] tracking-tight">Core Decisions</h2>
                <p className="text-[15px] sm:text-[16px] leading-[1.65] text-[var(--text-secondary)] whitespace-pre-line font-normal">
                  {meeting.summary.decisions}
                </p>
              </div>

              {meeting.summary.risks && (
                <div className="card-enterprise p-6 sm:p-7 space-y-3.5 border-l-4 border-l-[var(--color-error)]">
                  <h2 className="text-[19px] sm:text-[21px] font-semibold text-[var(--color-error)] flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Roadblocks & Technical Risks
                  </h2>
                  <p className="text-[15px] sm:text-[16px] leading-[1.65] text-[var(--text-secondary)] whitespace-pre-line font-normal">
                    {meeting.summary.risks}
                  </p>
                </div>
              )}
            </div>

            {/* Right Action Items list */}
            <div className="lg:col-span-1 card-enterprise p-6 sm:p-7 space-y-5">
              <h2 className="text-[19px] sm:text-[21px] font-semibold text-[var(--text-primary)] flex items-center gap-2.5">
                <CheckCircle className="h-5 w-5 text-[var(--color-success)]" />
                Action Items
              </h2>

              <div className="space-y-4">
                {safeActionItems().length === 0 ? (
                  <p className="text-[var(--text-muted)] text-[14px]">No action items logged for this session.</p>
                ) : (
                  safeActionItems().map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-[var(--bg-card-secondary)] p-4 sm:p-5 rounded-xl border border-[var(--border-subtle)] space-y-2.5"
                    >
                      <p className="text-[15px] font-semibold text-[var(--text-primary)] leading-snug">{item.task}</p>
                      <div className="flex items-center justify-between text-[13px] text-[var(--text-secondary)]">
                        <span>
                          Assignee: <strong className="text-[var(--color-brand)] font-semibold">{item.assignee}</strong>
                        </span>
                        <span>Due: {item.due_date}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TRANSCRIPT TAB (Enhanced Typography & Readability) */}
        {activeTab === 'transcript' && (
          <div className="card-enterprise p-6 sm:p-8 space-y-6">
            {/* Header controls: Search & Cleaned/Raw Toggle */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
              <div>
                <h2 className="text-[19px] sm:text-[21px] font-semibold text-[var(--text-primary)] tracking-tight">Meeting Transcript</h2>
                <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
                  Voice diarization via AssemblyAI with Groq Whisper timestamp alignment
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Search Bar */}
                <div className="relative min-w-[240px] sm:min-w-[280px]">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search keywords or speakers..."
                    className="input-enterprise pl-9 pr-3 py-2 text-[14px]"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Cleaned vs Raw Toggle */}
                <div className="flex p-1 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-subtle)] text-[13px] font-semibold">
                  <button
                    onClick={() => setTranscriptViewMode('cleaned')}
                    className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                      transcriptViewMode === 'cleaned'
                        ? 'bg-[var(--color-brand)] text-white shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Cleaned
                  </button>
                  <button
                    onClick={() => setTranscriptViewMode('raw')}
                    className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                      transcriptViewMode === 'raw'
                        ? 'bg-[var(--color-brand)] text-white shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Raw
                  </button>
                </div>
              </div>
            </div>

            {/* Match info counter when searching */}
            {searchQuery && (
              <div className="text-[13px] text-[var(--color-brand)] font-medium bg-[var(--color-brand-light)] border border-[var(--color-brand)]/20 px-3.5 py-2 rounded-lg">
                Showing {filteredSegments.length} of {rawSegmentsList.length} utterances matching &ldquo;{searchQuery}&rdquo;
              </div>
            )}

            {/* Transcript Utterances List */}
            <div className="space-y-4">
              {!meeting.transcript ? (
                <p className="text-[var(--text-secondary)] text-[15px] leading-relaxed py-6">
                  No transcript generated yet. If the meeting was recently recorded, AI processing is underway.
                </p>
              ) : rawSegmentsList.length === 0 ? (
                <div className="bg-[var(--bg-card-secondary)] p-5 rounded-xl border border-[var(--border-subtle)]">
                  <p className="text-[var(--text-primary)] text-[16px] leading-[1.65]">
                    {meeting.transcript.full_text || 'No speech recorded.'}
                  </p>
                </div>
              ) : filteredSegments.length === 0 ? (
                <div className="text-center py-12 text-[var(--text-secondary)] space-y-2">
                  <p className="text-[16px] font-semibold">No utterances matched your search query.</p>
                  <p className="text-[14px]">Try searching for other keywords, terms, or clear the search filter.</p>
                </div>
              ) : (
                filteredSegments.map((seg, idx) => {
                  const speakerDisplay = seg.speaker_name || seg.speaker || 'Participant 1';
                  const speakerColor = getSpeakerColor(speakerDisplay);
                  const textToShow =
                    (transcriptViewMode === 'cleaned' ? seg.cleaned_text || seg.text : seg.raw_text || seg.text) || '';
                  const hasRepetition = seg.quality_flags?.includes('possible_repetition');

                  return (
                    <div
                      key={idx}
                      className="bg-[var(--bg-card)] p-5 sm:p-6 rounded-xl border border-[var(--border-subtle)] transition-all hover:border-[var(--border-strong)] space-y-3 shadow-2xs"
                      style={{ borderLeftColor: speakerColor, borderLeftWidth: '4px' }}
                    >
                      {/* Speaker Bar */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          {/* Speaker Avatar indicator */}
                          <div
                            className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[12px] font-bold shrink-0"
                            style={{ backgroundColor: speakerColor }}
                          >
                            {speakerDisplay.replace(/[^0-9]/g, '') || speakerDisplay.slice(0, 1)}
                          </div>
                          <span
                            className="text-[16px] sm:text-[17px] font-semibold tracking-tight"
                            style={{ color: speakerColor }}
                          >
                            {speakerDisplay}
                          </span>

                          {/* Subtle Warning Tag if Repetition/Hallucination detected */}
                          {hasRepetition && (
                            <span className="badge-warning text-[11px] py-0.5 px-2">
                              <AlertTriangle className="h-3 w-3" />
                              Repetition Flagged
                            </span>
                          )}
                        </div>

                        {/* MM:SS timestamp */}
                        <span className="bg-[var(--bg-elevated)] text-[var(--text-muted)] font-mono text-[12px] sm:text-[13px] px-2.5 py-1 rounded-md font-medium shrink-0 border border-[var(--border-subtle)]">
                          {formatTimestamp(seg.start)} - {formatTimestamp(seg.end)}
                        </span>
                      </div>

                      {/* Main Readable Transcript Text */}
                      <p className="text-[16px] sm:text-[17px] leading-[1.65] text-[var(--text-primary)] font-normal pl-9.5">
                        {highlightSearch(textToShow, searchQuery)}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ENGAGEMENT TAB */}
        {activeTab === 'engagement' && telemetry && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Visual Gauge */}
            <div className="card-enterprise p-6 sm:p-7 space-y-6 flex flex-col justify-center">
              <h2 className="text-[19px] sm:text-[21px] font-semibold text-[var(--text-primary)] text-center tracking-tight">Session Focus Score</h2>
              <div className="relative h-40 w-40 mx-auto flex items-center justify-center rounded-full border-4 border-dashed border-[var(--border-subtle)]">
                <div className="absolute inset-2 rounded-full bg-[var(--bg-elevated)] flex flex-col items-center justify-center shadow-xs">
                  <span className="text-[34px] font-semibold text-[var(--text-primary)]">{telemetry.focus_score}%</span>
                  <span className="text-[12px] text-[var(--text-muted)] uppercase tracking-wider mt-1 font-medium">Indexed</span>
                </div>
              </div>
              <p className="text-[14px] text-[var(--text-secondary)] text-center leading-relaxed">
                Calculated dynamically from gaze direction and desktop activity telemetry.
              </p>
            </div>

            {/* Desktop Interaction details */}
            <div className="card-enterprise p-6 sm:p-7 lg:col-span-2 space-y-6">
              <h2 className="text-[19px] sm:text-[21px] font-semibold text-[var(--text-primary)] tracking-tight">Interactive Telemetry Log</h2>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[var(--bg-card-secondary)] border border-[var(--border-subtle)] p-4 sm:p-5 rounded-xl text-center">
                  <p className="text-[var(--text-muted)] text-[12px] font-semibold uppercase tracking-wider">Keystrokes</p>
                  <p className="text-[26px] sm:text-[28px] font-semibold text-[var(--text-primary)] mt-1">
                    {telemetry.keyboard_hits}
                  </p>
                </div>
                <div className="bg-[var(--bg-card-secondary)] border border-[var(--border-subtle)] p-4 sm:p-5 rounded-xl text-center">
                  <p className="text-[var(--text-muted)] text-[12px] font-semibold uppercase tracking-wider">Clicks</p>
                  <p className="text-[26px] sm:text-[28px] font-semibold text-[var(--text-primary)] mt-1">
                    {telemetry.mouse_clicks}
                  </p>
                </div>
                <div className="bg-[var(--bg-card-secondary)] border border-[var(--border-subtle)] p-4 sm:p-5 rounded-xl text-center">
                  <p className="text-[var(--text-muted)] text-[12px] font-semibold uppercase tracking-wider">Idle Time</p>
                  <p className="text-[26px] sm:text-[28px] font-semibold text-[var(--text-primary)] mt-1">
                    {telemetry.idle_seconds}s
                  </p>
                </div>
              </div>

              <div className="bg-[var(--bg-card-secondary)] p-4 sm:p-5 rounded-xl border border-[var(--border-subtle)] flex items-center justify-between text-[14px] sm:text-[15px]">
                <span className="text-[var(--text-secondary)]">Dominant Application Focused:</span>
                <strong className="text-[var(--text-primary)] font-semibold">{telemetry.active_window}</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
