import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { PATHS } from '../routes/paths';
import {
  Video,
  Clock,
  Activity,
  CalendarDays,
  FileDown,
  ArrowRight,
  TrendingUp,
  BrainCircuit,
  Eye,
  MousePointerClick,
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
      // Call join endpoint in backend
      await api.post(`/meetings/${meetingCode.trim()}/join`);
      // Redirect to the live meeting
      navigate(`/meetings/${meetingCode.trim()}/live`);
    } catch (err: any) {
      console.error(err);
      setJoinError(err.response?.data?.detail || 'Failed to join meeting. Please verify the code.');
    } finally {
      setIsJoining(false);
    }
  };

  const COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#3B82F6'];

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
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
      {/* 1. Header welcome */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard Overview</h2>
          <p className="text-slate-400 text-sm">Welcome back! Review your productivity trends.</p>
          {joinError && (
            <p className="text-rose-400 text-xs mt-1.5 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded inline-block">
              {joinError}
            </p>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Join Session Form */}
          <form onSubmit={handleJoinMeeting} className="flex items-center gap-2 bg-slate-950 border border-slate-800 p-1.5 rounded-lg focus-within:border-indigo-500/50 transition-all">
            <input
              type="text"
              placeholder="Enter meeting code (e.g. 1)"
              value={meetingCode}
              onChange={(e) => setMeetingCode(e.target.value)}
              className="bg-transparent text-sm text-white px-2.5 py-1 focus:outline-hidden w-48 placeholder:text-slate-500"
              disabled={isJoining}
            />
            <button
              type="submit"
              disabled={isJoining || !meetingCode.trim()}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-semibold px-4 py-2 rounded-md transition-all cursor-pointer"
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
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2.5 rounded-lg shadow-lg hover:shadow-indigo-600/20 transition-all text-sm self-start"
          >
            <Video className="h-4 w-4" />
            Start Smart Session
          </Link>
        </div>
      </div>

      {/* 2. Metrics Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="glass-card p-6 rounded-xl flex items-center gap-4">
          <div className="h-12 w-12 bg-indigo-500/10 text-indigo-400 rounded-lg flex items-center justify-center">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Meetings</p>
            <h3 className="text-2xl font-bold text-white mt-1">{totals.meetings_scheduled}</h3>
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl flex items-center gap-4">
          <div className="h-12 w-12 bg-emerald-500/10 text-emerald-400 rounded-lg flex items-center justify-center">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Hours Logged</p>
            <h3 className="text-2xl font-bold text-white mt-1">{(totals.total_duration_minutes / 60.0).toFixed(1)} hrs</h3>
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl flex items-center gap-4">
          <div className="h-12 w-12 bg-purple-500/10 text-purple-400 rounded-lg flex items-center justify-center">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Average Focus</p>
            <h3 className="text-2xl font-bold text-white mt-1">{totals.average_focus}%</h3>
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl flex items-center gap-4">
          <div className="h-12 w-12 bg-pink-500/10 text-pink-400 rounded-lg flex items-center justify-center">
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Reports Ready</p>
            <h3 className="text-2xl font-bold text-white mt-1">{totals.meetings_completed} PDF</h3>
          </div>
        </div>
      </div>

      {/* 3. Graphs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Focus Trend Chart */}
        <div className="glass-card p-6 rounded-xl lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-base font-semibold text-white">Weekly Focus Trend</h4>
            <div className="flex items-center gap-1.5 text-xs text-indigo-400 bg-indigo-500/5 px-2.5 py-1 rounded border border-indigo-500/10">
              <TrendingUp className="h-3 w-3" />
              Focus Indexed
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics?.weekly_trends || []}>
                <defs>
                  <linearGradient id="colorFocus" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#475569" fontSize={11} tickLine={false} />
                <YAxis stroke="#475569" fontSize={11} domain={[0, 100]} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#1F2937', color: '#FFF', borderRadius: 8 }}
                />
                <Area type="monotone" dataKey="focus" stroke="#6366F1" strokeWidth={2} fillOpacity={1} fill="url(#colorFocus)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Focused Window Share */}
        <div className="glass-card p-6 rounded-xl flex flex-col">
          <h4 className="text-base font-semibold text-white mb-6">Window Focus shares</h4>
          <div className="flex-1 h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics?.active_windows || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {(analytics?.active_windows || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#1F2937', color: '#FFF', borderRadius: 8 }}
                />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: 11, color: '#94A3B8' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 4. Recent Meetings list */}
      <div className="glass-card p-6 rounded-xl">
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-base font-semibold text-white">Recent Meetings Summary</h4>
          <Link
            to={PATHS.MEETING_HISTORY}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1 transition-colors"
          >
            All Meetings
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {recentMeetings.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-sm">
            No meetings saved yet. Start a new smart meeting to log insights!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase font-semibold">
                  <th className="py-3 px-4 font-semibold">Title</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Duration</th>
                  <th className="py-3 px-4 font-semibold">Focus Score</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentMeetings.map((meeting) => (
                  <tr key={meeting.id} className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-white">{meeting.title}</td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date(meeting.date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {meeting.duration_seconds
                        ? `${Math.floor(meeting.duration_seconds / 60)}m ${meeting.duration_seconds % 60}s`
                        : 'ongoing'}
                    </td>
                    <td className="py-3.5 px-4">
                      {meeting.focus_score !== undefined ? (
                        <span className={`inline-flex items-center gap-1 font-semibold ${
                          meeting.focus_score >= 80 ? 'text-emerald-400' : meeting.focus_score >= 60 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {meeting.focus_score.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                        meeting.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : meeting.status === 'ongoing'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20 live-pulse'
                          : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      }`}>
                        {meeting.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        to={meeting.status === 'ongoing' ? `/meetings/${meeting.id}/live` : `/meetings/${meeting.id}`}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1 transition-colors"
                      >
                        Inspect
                        <ArrowRight className="h-3 w-3" />
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
