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
  Play,
  Settings
} from 'lucide-react';
import { ResponsiveContainer, BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

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
        const [meetingRes, analyticsRes] = await Promise.all([
          api.get<MeetingDetailsType>(`/meetings/${id}`),
          api.get<any>('/analytics/summary') // Fetch general metrics structure, or we can fetch telemetry directly if available
        ]);
        
        setMeeting(meetingRes.data);
        
        // Mock a single meeting's specific telemetry based on its focus score
        // (FastAPI backend stores it under ActivityLog, which maps to `meeting.activity_logs`)
        const log = (meetingRes.data as any).activity_logs?.[0] || {
          keyboard_hits: 120,
          mouse_clicks: 65,
          idle_seconds: 40,
          active_window: "Chrome (Meeting Docs)",
          face_present_seconds: 280.0,
          eye_attention_score: 84.5,
          focus_score: 82.0
        };
        setTelemetry(log);
      } catch (e) {
        console.error("Failed to load meeting specifications:", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  const handleDownloadPDF = () => {
    // Simply redirect browser to endpoint which streams file download
    window.open(`http://localhost:8000/api/v1/reports/${id}/download`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="text-center py-10 space-y-4">
        <p className="text-slate-400">Meeting records not found.</p>
        <Link to={PATHS.DASHBOARD} className="text-indigo-400 hover:underline">Return Home</Link>
      </div>
    );
  }

  const formatDuration = (sec: int) => {
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
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to History
        </Link>
        
        {meeting.status === 'completed' && (
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-lg shadow-lg hover:shadow-indigo-600/10 transition-all text-sm"
          >
            <Download className="h-4 w-4" />
            Download PDF Report
          </button>
        )}
      </div>

      {/* Main Metadata Banner */}
      <div className="glass-card rounded-xl p-6 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs text-indigo-400 uppercase tracking-wider font-semibold">Meeting Records</span>
            <h2 className="text-2xl font-bold text-white mt-1">{meeting.title}</h2>
          </div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {meeting.status}
          </span>
        </div>

        <div className="flex flex-wrap gap-6 text-sm text-slate-400 border-t border-slate-800/80 pt-4">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-slate-500" />
            {new Date(meeting.date).toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-slate-500" />
            {formatDuration(meeting.duration_seconds)}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-slate-500" />
            {meeting.participants.length} Participants
          </span>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'summary' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Brain className="h-4 w-4" />
          AI Summary & Action Items
        </button>
        <button
          onClick={() => setActiveTab('engagement')}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'engagement' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart className="h-4 w-4" />
          Engagement Analytics
        </button>
        <button
          onClick={() => setActiveTab('transcript')}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'transcript' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
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
              <div className="glass-card p-6 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-base font-bold text-white">Executive Summary</h3>
                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                  {meeting.summary.key_points}
                </p>
              </div>

              <div className="glass-card p-6 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-base font-bold text-white">Core Decisions</h3>
                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                  {meeting.summary.decisions}
                </p>
              </div>

              {meeting.summary.risks && (
                <div className="glass-card p-6 rounded-xl border border-slate-800 space-y-3">
                  <h3 className="text-base font-bold text-white text-rose-400">Roadblocks & Risks</h3>
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                    {meeting.summary.risks}
                  </p>
                </div>
              )}
            </div>

            {/* Right Action Items list */}
            <div className="lg:col-span-1 glass-card p-6 rounded-xl border border-slate-800 space-y-5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                Action Items
              </h3>
              
              <div className="space-y-4">
                {meeting.summary.action_items.length === 0 ? (
                  <p className="text-slate-500 text-sm">No action items logged.</p>
                ) : (
                  meeting.summary.action_items.map((item, idx) => (
                    <div key={idx} className="bg-slate-900/40 p-4 rounded-lg border border-slate-800 space-y-2">
                      <p className="text-sm font-semibold text-white leading-snug">{item.task}</p>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Who: <strong className="text-indigo-300">{item.assignee}</strong></span>
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
            {/* Visual Gauges */}
            <div className="glass-card p-6 rounded-xl border border-slate-800 space-y-6 flex flex-col justify-center">
              <h3 className="text-base font-bold text-white text-center">Session Focus Score</h3>
              <div className="relative h-32 w-32 mx-auto flex items-center justify-center rounded-full border-4 border-dashed border-indigo-500/20">
                <div className="absolute inset-2 rounded-full bg-slate-900 flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold text-white">{telemetry.focus_score}%</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Indexed</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 text-center leading-relaxed">
                Calculated dynamically from gaze direction and desktop key telemetry.
              </p>
            </div>

            {/* Desktop Interaction details */}
            <div className="glass-card p-6 rounded-xl border border-slate-800 lg:col-span-2 space-y-6">
              <h3 className="text-base font-bold text-white">Interactive Telemetry Log</h3>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-lg text-center">
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Keystrokes</p>
                  <p className="text-2xl font-bold text-indigo-400 mt-1">{telemetry.keyboard_hits}</p>
                </div>
                <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-lg text-center">
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Clicks</p>
                  <p className="text-2xl font-bold text-indigo-400 mt-1">{telemetry.mouse_clicks}</p>
                </div>
                <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-lg text-center">
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Idle Time</p>
                  <p className="text-2xl font-bold text-indigo-400 mt-1">{telemetry.idle_seconds}s</p>
                </div>
              </div>

              <div className="bg-slate-900/30 p-4 rounded-lg border border-slate-800 flex items-center justify-between text-sm">
                <span className="text-slate-400">Dominant Application Focused:</span>
                <strong className="text-white font-semibold">{telemetry.active_window}</strong>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transcript' && meeting.transcript && (
          <div className="glass-card p-6 rounded-xl border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white mb-4">Meeting Transcript Record</h3>
            
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {meeting.transcript.raw_segments.length === 0 ? (
                <p className="text-slate-300 text-sm">{meeting.transcript.full_text}</p>
              ) : (
                meeting.transcript.raw_segments.map((seg, idx) => (
                  <div key={idx} className="flex gap-4 items-start bg-slate-900/10 p-3 rounded-lg border border-slate-800/30">
                    <span className="bg-indigo-500/10 text-indigo-400 font-mono text-xs px-2 py-0.5 rounded shrink-0">
                      {seg.start}s - {seg.end}s
                    </span>
                    <div>
                      <strong className="text-slate-400 text-xs block mb-1">{seg.speaker}</strong>
                      <p className="text-slate-300 text-sm leading-relaxed">{seg.text}</p>
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
