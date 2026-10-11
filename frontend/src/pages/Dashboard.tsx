import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { PATHS } from '../routes/paths';
import { useTheme } from '../contexts/ThemeContext';
import {
  Video,
  Clock,
  Activity,
  CalendarDays,
  ArrowRight,
  TrendingUp,
  BrainCircuit,
  LogIn
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

interface Totals {
  meetings_scheduled: number;
  meetings_completed: number;
  total_duration_minutes: number;
  average_focus: number;
}

interface TrendDay {
  date: string;
  meetings: number;
  focus: number;
}

interface ActiveWindowShare {
  name: string;
  value: number;
}

interface DashboardAnalytics {
  totals: Totals;
  weekly_trends: TrendDay[];
  active_windows: ActiveWindowShare[];
}

interface MeetingSummary {
  id: number;
  title: string;
  date: string;
  duration_seconds: number;
  status: string;
  focus_score?: number;
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [recentMeetings, setRecentMeetings] = useState<MeetingSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Join meeting states
  const [meetingCode, setMeetingCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [analyticsRes, meetingsRes] = await Promise.all([
          api.get<DashboardAnalytics>('/analytics/summary'),
          api.get<MeetingSummary[]>('/meetings/'),
        ]);
        setAnalytics(analyticsRes.data);
        setRecentMeetings(meetingsRes.data.slice(0, 5));
      } catch (e) {
        console.error('Failed to fetch dashboard metrics:', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const handleJoinMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingCode.trim()) return;

    setIsJoining(true);
    setJoinError(null);
    try {
      await api.post(`/meetings/${meetingCode.trim()}/join`);
      navigate(`/meetings/${meetingCode.trim()}/live`);
    } catch (err: any) {
      console.error(err);
      setJoinError(err.response?.data?.detail || 'Failed to join meeting. Please verify the code.');
    } finally {
      setIsJoining(false);
    }
  };

  const isLight = theme === 'light';

  // Professional enterprise chart palette (restrained, accessible)
  const PIE_COLORS = isLight
    ? ['#2563EB', '#12805C', '#A66B12', '#7C3AED']
    : ['#3478F6', '#16A37A', '#D99A32', '#A78BFA'];

  const brandActionColor = isLight ? '#2563EB' : '#3478F6';
  const axisColor = isLight ? '#747D88' : '#929AA5';
  const gridBorderColor = isLight ? '#E1E5EA' : '#383E45';
  const tooltipBg = isLight ? '#FFFFFF' : '#23272C';
  const tooltipText = isLight ? '#20252B' : '#F3F4F6';

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-[var(--color-brand)] border-t-transparent"></div>
      </div>
    );
  }

  const totals = analytics?.totals || {
    meetings_scheduled: 0,
    meetings_completed: 0,
    total_duration_minutes: 0,
    average_focus: 0,
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* 1. Header Overview & Primary Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-[26px] sm:text-[28px] font-semibold text-[var(--text-primary)] tracking-tight">Dashboard Overview</h2>
          <p className="text-[15px] text-[var(--text-secondary)] mt-1">Review your productivity telemetry and meeting intelligence.</p>
          {joinError && (
            <div className="badge-error mt-2">
              {joinError}
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Join Session Form */}
          <form onSubmit={handleJoinMeeting} className="flex items-center gap-1.5 bg-[var(--bg-card)] border border-[var(--border-subtle)] p-1 rounded-lg focus-within:border-[var(--color-brand)] transition-all">
            <input
              type="text"
              placeholder="Enter meeting code..."
              value={meetingCode}
              onChange={(e) => setMeetingCode(e.target.value)}
              className="bg-transparent text-[14px] text-[var(--text-primary)] px-3 py-1.5 focus:outline-none w-44 sm:w-48 placeholder:text-[var(--text-muted)]"
              disabled={isJoining}
            />
            <button
              type="submit"
              disabled={isJoining || !meetingCode.trim()}
              className="btn-primary text-[13px] py-1.5 px-3.5 gap-1.5 disabled:opacity-40"
            >
              {isJoining ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              ) : (
                <LogIn className="h-3.5 w-3.5" />
              )}
              Join
            </button>
          </form>

          <Link
            to={PATHS.CREATE_MEETING}
            className="btn-primary text-[14px] py-2 px-4 gap-2 rounded-lg"
          >
            <Video className="h-4 w-4" />
            Start Smart Session
          </Link>
        </div>
      </div>

      {/* 2. Enterprise Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="card-enterprise p-5 sm:p-6 flex items-center gap-4.5">
          <div className="h-12 w-12 rounded-xl bg-[var(--bg-elevated)] text-[var(--color-brand)] flex items-center justify-center shrink-0 border border-[var(--border-subtle)]">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[13px] sm:text-[14px] font-medium text-[var(--text-secondary)]">Total Meetings</p>
            <h3 className="text-[26px] sm:text-[28px] font-semibold text-[var(--text-primary)] tracking-tight leading-none mt-1">
              {totals.meetings_scheduled}
            </h3>
          </div>
        </div>

        <div className="card-enterprise p-5 sm:p-6 flex items-center gap-4.5">
          <div className="h-12 w-12 rounded-xl bg-[var(--color-success-bg)] text-[var(--color-success)] flex items-center justify-center shrink-0 border border-[var(--color-success)]/20">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[13px] sm:text-[14px] font-medium text-[var(--text-secondary)]">Hours Logged</p>
            <h3 className="text-[26px] sm:text-[28px] font-semibold text-[var(--text-primary)] tracking-tight leading-none mt-1">
              {(totals.total_duration_minutes / 60.0).toFixed(1)} hrs
            </h3>
          </div>
        </div>

        <div className="card-enterprise p-5 sm:p-6 flex items-center gap-4.5">
          <div className="h-12 w-12 rounded-xl bg-[var(--color-warning-bg)] text-[var(--color-warning)] flex items-center justify-center shrink-0 border border-[var(--color-warning)]/20">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[13px] sm:text-[14px] font-medium text-[var(--text-secondary)]">Average Focus</p>
            <h3 className="text-[26px] sm:text-[28px] font-semibold text-[var(--text-primary)] tracking-tight leading-none mt-1">
              {totals.average_focus}%
            </h3>
          </div>
        </div>

        <div className="card-enterprise p-5 sm:p-6 flex items-center gap-4.5">
          <div className="h-12 w-12 rounded-xl bg-[var(--bg-elevated)] text-[var(--text-secondary)] flex items-center justify-center shrink-0 border border-[var(--border-subtle)]">
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[13px] sm:text-[14px] font-medium text-[var(--text-secondary)]">Reports Ready</p>
            <h3 className="text-[26px] sm:text-[28px] font-semibold text-[var(--text-primary)] tracking-tight leading-none mt-1">
              {totals.meetings_completed} PDF
            </h3>
          </div>
        </div>
      </div>

      {/* 3. Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Focus Trend */}
        <div className="card-enterprise p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-[19px] sm:text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">Weekly Focus Trend</h4>
              <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">Average team engagement across recent session dates</p>
            </div>
            <div className="badge-brand">
              <TrendingUp className="h-3.5 w-3.5" />
              Focus Indexed
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics?.weekly_trends || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorFocus" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={brandActionColor} stopOpacity={0.15}/>
                    <stop offset="95%" stopColor={brandActionColor} stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  stroke={axisColor}
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: gridBorderColor }}
                />
                <YAxis
                  stroke={axisColor}
                  fontSize={12}
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={{ stroke: gridBorderColor }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    borderColor: gridBorderColor,
                    color: tooltipText,
                    borderRadius: 8,
                    fontSize: 13,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="focus"
                  stroke={brandActionColor}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorFocus)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Focused Window Share */}
        <div className="card-enterprise p-6 flex flex-col">
          <h4 className="text-[19px] sm:text-[20px] font-semibold text-[var(--text-primary)] tracking-tight mb-1">Window Focus Shares</h4>
          <p className="text-[13px] text-[var(--text-secondary)] mb-4">Distribution of active workplace contexts</p>
          <div className="flex-1 min-h-[260px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics?.active_windows || []}
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {(analytics?.active_windows || []).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke={tooltipBg} strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    borderColor: gridBorderColor,
                    color: tooltipText,
                    borderRadius: 8,
                    fontSize: 13,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                />
                <Legend
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{ fontSize: 12, color: axisColor, paddingTop: 16 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 4. Recent Meetings Table */}
      <div className="card-enterprise p-6 sm:p-7">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h4 className="text-[19px] sm:text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">Recent Meetings Summary</h4>
            <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">Quick access to recent transcripts and metrics</p>
          </div>
          <Link
            to={PATHS.MEETING_HISTORY}
            className="text-[14px] font-medium text-[var(--color-brand)] hover:text-[var(--color-brand-hover)] inline-flex items-center gap-1 transition-colors"
          >
            All Meetings
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {recentMeetings.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-secondary)] text-[15px]">
            No meetings saved yet. Start a new smart meeting to log insights!
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 sm:mx-0">
            <table className="w-full text-left text-[14px] sm:text-[15px] border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)] text-[12px] sm:text-[13px] font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4 font-semibold">Title</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Duration</th>
                  <th className="py-3 px-4 font-semibold">Focus Score</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {recentMeetings.map((meeting) => (
                  <tr key={meeting.id} className="hover:bg-[var(--bg-surface-hover)] transition-colors">
                    <td className="py-4 px-4 font-medium text-[var(--text-primary)]">{meeting.title}</td>
                    <td className="py-4 px-4 text-[var(--text-secondary)] text-[13px] sm:text-[14px]">
                      {new Date(meeting.date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-4 px-4 text-[var(--text-secondary)] text-[13px] sm:text-[14px]">
                      {meeting.duration_seconds
                        ? `${Math.floor(meeting.duration_seconds / 60)}m ${meeting.duration_seconds % 60}s`
                        : 'ongoing'}
                    </td>
                    <td className="py-4 px-4 font-semibold">
                      {meeting.focus_score !== undefined ? (
                        <span className={
                          meeting.focus_score >= 80 
                            ? 'text-[var(--color-success)]' 
                            : meeting.focus_score >= 60 
                            ? 'text-[var(--color-warning)]' 
                            : 'text-[var(--color-error)]'
                        }>
                          {meeting.focus_score.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">-</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {meeting.status === 'completed' ? (
                        <span className="badge-success capitalize">{meeting.status}</span>
                      ) : meeting.status === 'ongoing' ? (
                        <span className="badge-warning capitalize live-pulse">{meeting.status}</span>
                      ) : (
                        <span className="badge-neutral capitalize">{meeting.status}</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <Link
                        to={meeting.status === 'ongoing' ? `/meetings/${meeting.id}/live` : `/meetings/${meeting.id}`}
                        className="text-[13px] font-medium text-[var(--color-brand)] hover:text-[var(--color-brand-hover)] inline-flex items-center gap-1 transition-colors"
                      >
                        Inspect
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
