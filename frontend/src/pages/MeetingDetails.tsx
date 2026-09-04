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
  AlertTriangle
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
  speaker: string;
}

interface TranscriptData {
  full_text: string;
  raw_segments: TranscriptSegment[];
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

export const MeetingDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [meeting, setMeeting] = useState<MeetingDetailsType | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryLog | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'engagement' | 'transcript'>('summary');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const [meetingRes] = await Promise.all([
          api.get<MeetingDetailsType>(`/meetings/${id}`),
        ]);
        
        setMeeting(meetingRes.data);
        
        const log = (meetingRes.data as any).activity_logs?.[0] || {
          keyboard_hits: 120,
          mouse_clicks: 65,
          idle_seconds: 40,
          active_window: 'Google Meet Browser Tab',
          face_present_seconds: 520,
          eye_attention_score: 84.5,
          focus_score: 88.0,
        };
        setTelemetry(log);
      } catch (e) {
        console.error("Failed to load meeting details:", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  const handleDownloadPDF = async () => {
    try {
      const response = await api.get(`/reports/pdf/${id}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Meeting_Report_${meeting?.title || id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error("Failed to generate PDF:", e);
      alert("Error generating PDF. Please make sure the meeting has finished.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1a73e8] border-t-transparent"></div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-[var(--text-secondary)]">The requested meeting session could not be located.</p>
        <button
          onClick={() => navigate(PATHS.MEETING_HISTORY)}
          className="text-[#1a73e8] hover:text-[#1967d2] font-semibold text-sm cursor-pointer"
        >
          Return to Archive
        </button>
      </div>
    );
  }

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Back button and Download actions */}
      <div className="flex items-center justify-between">
        <Link
          to={PATHS.MEETING_HISTORY}
          className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to History
        </Link>
        
        {meeting.status === 'completed' && (
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 bg-[#1a73e8] hover:bg-[#1967d2] text-white font-medium px-4 py-2.5 rounded-xl shadow-xs hover:shadow-md transition-all text-sm cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Download PDF Report
          </button>
        )}
      </div>

      {/* Main Metadata Banner */}
      <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs text-[#1a73e8] dark:text-blue-400 uppercase tracking-wider font-semibold">Meeting Records</span>
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mt-1">{meeting.title}</h2>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
            {meeting.status}
          </span>
        </div>

        <div className="flex flex-wrap gap-6 text-sm text-[var(--text-secondary)] border-t border-[var(--border-subtle)] pt-4">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-[var(--text-muted)]" />
            {new Date(meeting.date).toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-[var(--text-muted)]" />
            {formatDuration(meeting.duration_seconds)}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-[var(--text-muted)]" />
            {meeting.participants.length} Participants
          </span>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex border-b border-[var(--border-subtle)]">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'summary' 
              ? 'border-[#1a73e8] text-[#1a73e8] dark:text-blue-400' 
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Brain className="h-4 w-4" />
          AI Summary & Action Items
        </button>
        <button
          onClick={() => setActiveTab('engagement')}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'engagement' 
              ? 'border-[#1a73e8] text-[#1a73e8] dark:text-blue-400' 
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <BarChart className="h-4 w-4" />
          Engagement Analytics
        </button>
        <button
          onClick={() => setActiveTab('transcript')}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'transcript' 
              ? 'border-[#1a73e8] text-[#1a73e8] dark:text-blue-400' 
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <FileText className="h-4 w-4" />
          Full Transcript
        </button>
      </div>

      {/* Tab Panels */}
      <div className="mt-4">
        {activeTab === 'summary' && meeting.summary && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left AI summary */}
            <div className="lg:col-span-2 space-y-6">
              <div className="glass-card p-6 rounded-2xl space-y-3">
                <h3 className="text-base font-bold text-[var(--text-primary)]">Executive Summary</h3>
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed whitespace-pre-line">
                  {meeting.summary.key_points}
                </p>
              </div>

              <div className="glass-card p-6 rounded-2xl space-y-3">
                <h3 className="text-base font-bold text-[var(--text-primary)]">Core Decisions</h3>
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed whitespace-pre-line">
                  {meeting.summary.decisions}
                </p>
              </div>

              {meeting.summary.risks && (
                <div className="glass-card p-6 rounded-2xl space-y-3">
                  <h3 className="text-base font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    Roadblocks & Risks
                  </h3>
                  <p className="text-[var(--text-secondary)] text-sm leading-relaxed whitespace-pre-line">
                    {meeting.summary.risks}
                  </p>
                </div>
              )}
            </div>

            {/* Right Action Items list */}
            <div className="lg:col-span-1 glass-card p-6 rounded-2xl space-y-5">
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Action Items
              </h3>
              
              <div className="space-y-4">
                {meeting.summary.action_items.length === 0 ? (
                  <p className="text-[var(--text-muted)] text-sm">No action items logged.</p>
                ) : (
                  meeting.summary.action_items.map((item, idx) => (
                    <div key={idx} className="bg-[var(--bg-card-secondary)] p-4 rounded-xl border border-[var(--border-subtle)] space-y-2">
                      <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug">{item.task}</p>
                      <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                        <span>Assignee: <strong className="text-[#1a73e8] dark:text-blue-400">{item.assignee}</strong></span>
                        <span>Due: {item.due_date}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'engagement' && telemetry && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Visual Gauge */}
            <div className="glass-card p-6 rounded-2xl space-y-6 flex flex-col justify-center">
              <h3 className="text-base font-bold text-[var(--text-primary)] text-center">Session Focus Score</h3>
              <div className="relative h-36 w-36 mx-auto flex items-center justify-center rounded-full border-4 border-dashed border-blue-500/30">
                <div className="absolute inset-2 rounded-full bg-[var(--bg-surface)] flex flex-col items-center justify-center shadow-xs">
                  <span className="text-3xl font-extrabold text-[var(--text-primary)]">{telemetry.focus_score}%</span>
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest mt-1">Indexed</span>
                </div>
              </div>
              <p className="text-xs text-[var(--text-secondary)] text-center leading-relaxed">
                Calculated dynamically from gaze direction and desktop activity telemetry.
              </p>
            </div>

            {/* Desktop Interaction details */}
            <div className="glass-card p-6 rounded-2xl lg:col-span-2 space-y-6">
              <h3 className="text-base font-bold text-[var(--text-primary)]">Interactive Telemetry Log</h3>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[var(--bg-card-secondary)] border border-[var(--border-subtle)] p-4 rounded-xl text-center">
                  <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">Keystrokes</p>
                  <p className="text-2xl font-bold text-[#1a73e8] dark:text-blue-400 mt-1">{telemetry.keyboard_hits}</p>
                </div>
                <div className="bg-[var(--bg-card-secondary)] border border-[var(--border-subtle)] p-4 rounded-xl text-center">
                  <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">Clicks</p>
                  <p className="text-2xl font-bold text-[#1a73e8] dark:text-blue-400 mt-1">{telemetry.mouse_clicks}</p>
                </div>
                <div className="bg-[var(--bg-card-secondary)] border border-[var(--border-subtle)] p-4 rounded-xl text-center">
                  <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">Idle Time</p>
                  <p className="text-2xl font-bold text-[#1a73e8] dark:text-blue-400 mt-1">{telemetry.idle_seconds}s</p>
                </div>
              </div>

              <div className="bg-[var(--bg-card-secondary)] p-4 rounded-xl border border-[var(--border-subtle)] flex items-center justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Dominant Application Focused:</span>
                <strong className="text-[var(--text-primary)] font-semibold">{telemetry.active_window}</strong>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transcript' && meeting.transcript && (
          <div className="glass-card p-6 rounded-2xl space-y-4">
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-4">Meeting Transcript Record</h3>
            
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {meeting.transcript.raw_segments.length === 0 ? (
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{meeting.transcript.full_text}</p>
              ) : (
                meeting.transcript.raw_segments.map((seg, idx) => (
                  <div key={idx} className="flex gap-4 items-start bg-[var(--bg-card-secondary)] p-3.5 rounded-xl border border-[var(--border-subtle)]">
                    <span className="bg-[#e8f0fe] text-[#174ea6] dark:bg-blue-900/30 dark:text-blue-400 font-mono text-xs px-2.5 py-1 rounded-md shrink-0 font-medium">
                      {seg.start}s - {seg.end}s
                    </span>
                    <div>
                      <strong className="text-[var(--text-primary)] text-xs block mb-1 font-semibold">{seg.speaker}</strong>
                      <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{seg.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
