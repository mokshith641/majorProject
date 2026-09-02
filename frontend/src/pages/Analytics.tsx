import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { BarChart3, TrendingUp, Cpu, Timer, Sparkles, Lightbulb, CheckCircle2 } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
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

interface AIInsights {
  executive_summary: string;
  key_themes: string[];
  productivity_tips: string[];
  team_sentiment: string;
}

interface AnalyticsData {
  totals: Totals;
  weekly_trends: TrendDay[];
  active_windows: ActiveWindowShare[];
  ai_insights?: AIInsights;
}

export const Analytics: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await api.get<AnalyticsData>('/analytics/summary');
        setData(res.data);
      } catch (e) {
        console.error("Failed to load analytics trends:", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  const totals = data?.totals || {
    meetings_scheduled: 0,
    meetings_completed: 0,
    total_duration_minutes: 0,
    average_focus: 0
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-white">System Analytics</h2>
        <p className="text-slate-400 text-sm">Review performance aggregates and visual user engagement indices.</p>
      </div>

      {/* Grid numbers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="glass-card p-6 rounded-xl flex items-center gap-4">
          <div className="h-10 w-10 bg-indigo-500/10 text-indigo-400 rounded-lg flex items-center justify-center">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Meetings Completed</p>
            <h3 className="text-2xl font-bold text-white mt-0.5">{totals.meetings_completed}</h3>
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl flex items-center gap-4">
          <div className="h-10 w-10 bg-emerald-500/10 text-emerald-400 rounded-lg flex items-center justify-center">
            <Timer className="h-5 w-5" />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Duration</p>
            <h3 className="text-2xl font-bold text-white mt-0.5">{totals.total_duration_minutes.toFixed(0)} min</h3>
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl flex items-center gap-4">
          <div className="h-10 w-10 bg-purple-500/10 text-purple-400 rounded-lg flex items-center justify-center">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Engagement Average</p>
            <h3 className="text-2xl font-bold text-white mt-0.5">{totals.average_focus}%</h3>
          </div>
        </div>
      </div>

      {/* AI Executive Productivity Insights */}
      {data?.ai_insights && (
        <div className="glass-card p-6 rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/20 via-slate-900/40 to-purple-950/20 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">AI Executive Productivity Insights</h3>
                <p className="text-xs text-slate-400">Synthesized automatically from completed meeting transcripts and engagement telemetry.</p>
              </div>
            </div>
            {data.ai_insights.team_sentiment && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                {data.ai_insights.team_sentiment}
              </span>
            )}
          </div>

          <p className="text-sm text-slate-200 leading-relaxed">
            {data.ai_insights.executive_summary}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Recurring Themes */}
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>Key Discussion Themes</span>
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {data.ai_insights.key_themes?.map((theme, i) => (
                  <span key={i} className="text-xs bg-indigo-500/10 text-indigo-200 border border-indigo-500/20 px-2.5 py-1 rounded-md">
                    {theme}
                  </span>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
                <span>Productivity Recommendations</span>
              </h4>
              <ul className="space-y-1 text-xs text-slate-300">
                {data.ai_insights.productivity_tips?.map((tip, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-amber-400">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Detailed charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engagement Trend Chart */}
        <div className="glass-card p-6 rounded-xl">
          <h3 className="text-base font-semibold text-white mb-6">Aggregate Focus Levels</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.weekly_trends || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="date" stroke="#475569" fontSize={11} />
                <YAxis stroke="#475569" fontSize={11} domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#1F2937' }} />
                <Area type="monotone" dataKey="focus" stroke="#6366F1" fill="#6366F1" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Meeting Quantities */}
        <div className="glass-card p-6 rounded-xl">
          <h3 className="text-base font-semibold text-white mb-6">Meetings Frequency</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.weekly_trends || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="date" stroke="#475569" fontSize={11} />
                <YAxis stroke="#475569" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#1F2937' }} />
                <Bar dataKey="meetings" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
