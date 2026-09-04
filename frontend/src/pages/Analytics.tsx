import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { BarChart3, Timer, Cpu, Sparkles, Lightbulb, CheckCircle2 } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
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
  const { theme } = useTheme();
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

  const isLight = theme === 'light';

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1a73e8] border-t-transparent"></div>
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
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">System Analytics</h2>
        <p className="text-[var(--text-secondary)] text-sm">Review performance aggregates and engagement indices.</p>
      </div>

      {/* Grid KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="glass-card p-6 rounded-2xl flex items-center gap-4">
          <div className="h-12 w-12 bg-blue-500/10 text-[#1a73e8] dark:text-blue-400 rounded-xl flex items-center justify-center shrink-0">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider">Meetings Completed</p>
            <h3 className="text-2xl font-bold text-[var(--text-primary)] mt-0.5">{totals.meetings_completed}</h3>
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl flex items-center gap-4">
          <div className="h-12 w-12 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
            <Timer className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider">Total Duration</p>
            <h3 className="text-2xl font-bold text-[var(--text-primary)] mt-0.5">{totals.total_duration_minutes.toFixed(0)} min</h3>
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl flex items-center gap-4">
          <div className="h-12 w-12 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center shrink-0">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider">Engagement Average</p>
            <h3 className="text-2xl font-bold text-[var(--text-primary)] mt-0.5">{totals.average_focus}%</h3>
          </div>
        </div>
      </div>

      {/* AI Executive Productivity Insights */}
      {data?.ai_insights && (
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#e8f0fe] text-[#1a73e8] dark:bg-blue-900/30 dark:text-blue-400">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">AI Executive Productivity Insights</h3>
                <p className="text-xs text-[var(--text-secondary)]">Synthesized automatically from completed meeting transcripts and engagement telemetry.</p>
              </div>
            </div>
            {data.ai_insights.team_sentiment && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                {data.ai_insights.team_sentiment}
              </span>
            )}
          </div>

          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            {data.ai_insights.executive_summary}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Recurring Themes */}
            <div className="bg-[var(--bg-card-secondary)] p-4 rounded-xl border border-[var(--border-subtle)] space-y-2">
              <h4 className="text-xs font-bold text-[#1a73e8] dark:text-blue-400 uppercase tracking-wider">
                Key Discussion Themes
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {data.ai_insights.key_themes?.map((themeName, i) => (
                  <span key={i} className="text-xs bg-[#e8f0fe] text-[#174ea6] dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900 px-2.5 py-1 rounded-md">
                    {themeName}
                  </span>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-[var(--bg-card-secondary)] p-4 rounded-xl border border-[var(--border-subtle)] space-y-2">
              <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5" />
                Productivity Recommendations
              </h4>
              <ul className="space-y-1 text-xs text-[var(--text-secondary)]">
                {data.ai_insights.productivity_tips?.map((tip, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-amber-500">•</span>
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
        <div className="glass-card p-6 rounded-2xl">
          <h3 className="text-base font-semibold text-[var(--text-primary)] mb-6">Aggregate Focus Levels</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.weekly_trends || []}>
                <CartesianGrid strokeDasharray="3 3" stroke={isLight ? '#e8eaed' : '#222f47'} />
                <XAxis dataKey="date" stroke={isLight ? '#80868b' : '#64748b'} fontSize={11} />
                <YAxis stroke={isLight ? '#80868b' : '#64748b'} fontSize={11} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isLight ? '#ffffff' : '#182030',
                    borderColor: isLight ? '#dadce0' : '#222f47',
                    color: isLight ? '#202124' : '#ffffff',
                    borderRadius: 12,
                    boxShadow: isLight ? '0 4px 12px rgba(60,64,67,0.15)' : '0 8px 24px rgba(0,0,0,0.4)'
                  }}
                />
                <Area type="monotone" dataKey="focus" stroke={isLight ? '#1a73e8' : '#3b82f6'} fill={isLight ? '#1a73e8' : '#3b82f6'} fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Meeting Quantities */}
        <div className="glass-card p-6 rounded-2xl">
          <h3 className="text-base font-semibold text-[var(--text-primary)] mb-6">Meetings Frequency</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.weekly_trends || []}>
                <CartesianGrid strokeDasharray="3 3" stroke={isLight ? '#e8eaed' : '#222f47'} />
                <XAxis dataKey="date" stroke={isLight ? '#80868b' : '#64748b'} fontSize={11} />
                <YAxis stroke={isLight ? '#80868b' : '#64748b'} fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isLight ? '#ffffff' : '#182030',
                    borderColor: isLight ? '#dadce0' : '#222f47',
                    color: isLight ? '#202124' : '#ffffff',
                    borderRadius: 12,
                    boxShadow: isLight ? '0 4px 12px rgba(60,64,67,0.15)' : '0 8px 24px rgba(0,0,0,0.4)'
                  }}
                />
                <Bar dataKey="meetings" fill={isLight ? '#1a73e8' : '#818cf8'} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
