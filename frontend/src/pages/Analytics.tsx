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

  const brandColor = isLight ? '#2563EB' : '#3478F6';
  const barColor = isLight ? '#12805C' : '#16A37A';
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

  const totals = data?.totals || {
    meetings_scheduled: 0,
    meetings_completed: 0,
    total_duration_minutes: 0,
    average_focus: 0
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h2 className="text-[26px] sm:text-[28px] font-semibold text-[var(--text-primary)] tracking-tight">System Analytics</h2>
        <p className="text-[15px] text-[var(--text-secondary)] mt-1">Review organization productivity benchmarks and engagement indices.</p>
      </div>

      {/* Grid KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="card-enterprise p-5 sm:p-6 flex items-center gap-4.5">
          <div className="h-12 w-12 rounded-xl bg-[var(--bg-elevated)] text-[var(--color-brand)] flex items-center justify-center shrink-0 border border-[var(--border-subtle)]">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[13px] sm:text-[14px] font-medium text-[var(--text-secondary)]">Meetings Completed</p>
            <h3 className="text-[26px] sm:text-[28px] font-semibold text-[var(--text-primary)] tracking-tight leading-none mt-1">
              {totals.meetings_completed}
            </h3>
          </div>
        </div>

        <div className="card-enterprise p-5 sm:p-6 flex items-center gap-4.5">
          <div className="h-12 w-12 rounded-xl bg-[var(--color-success-bg)] text-[var(--color-success)] flex items-center justify-center shrink-0 border border-[var(--color-success)]/20">
            <Timer className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[13px] sm:text-[14px] font-medium text-[var(--text-secondary)]">Total Duration</p>
            <h3 className="text-[26px] sm:text-[28px] font-semibold text-[var(--text-primary)] tracking-tight leading-none mt-1">
              {totals.total_duration_minutes.toFixed(0)} min
            </h3>
          </div>
        </div>

        <div className="card-enterprise p-5 sm:p-6 flex items-center gap-4.5">
          <div className="h-12 w-12 rounded-xl bg-[var(--color-warning-bg)] text-[var(--color-warning)] flex items-center justify-center shrink-0 border border-[var(--color-warning)]/20">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[13px] sm:text-[14px] font-medium text-[var(--text-secondary)]">Engagement Average</p>
            <h3 className="text-[26px] sm:text-[28px] font-semibold text-[var(--text-primary)] tracking-tight leading-none mt-1">
              {totals.average_focus}%
            </h3>
          </div>
        </div>
      </div>

      {/* AI Executive Productivity Insights */}
      {data?.ai_insights && (
        <div className="card-enterprise p-6 sm:p-7 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-[var(--bg-elevated)] text-[var(--color-brand)] border border-[var(--border-subtle)]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-[18px] sm:text-[19px] font-semibold text-[var(--text-primary)] tracking-tight">AI Executive Productivity Insights</h3>
                <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">Synthesized automatically from transcripts and telemetry data</p>
              </div>
            </div>
            {data.ai_insights.team_sentiment && (
              <span className="badge-success text-[13px] py-1 px-3">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {data.ai_insights.team_sentiment}
              </span>
            )}
          </div>

          <p className="text-[15px] sm:text-[16px] text-[var(--text-secondary)] leading-relaxed">
            {data.ai_insights.executive_summary}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            {/* Recurring Themes */}
            <div className="bg-[var(--bg-card-secondary)] p-5 rounded-xl border border-[var(--border-subtle)] space-y-3">
              <h4 className="text-[13px] font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                Key Discussion Themes
              </h4>
              <div className="flex flex-wrap gap-2">
                {data.ai_insights.key_themes?.map((themeName, i) => (
                  <span key={i} className="text-[13px] font-medium bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-subtle)] px-3 py-1 rounded-md shadow-2xs">
                    {themeName}
                  </span>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-[var(--bg-card-secondary)] p-5 rounded-xl border border-[var(--border-subtle)] space-y-3">
              <h4 className="text-[13px] font-semibold text-[var(--color-warning)] uppercase tracking-wider flex items-center gap-1.5">
                <Lightbulb className="h-4 w-4" />
                Productivity Recommendations
              </h4>
              <ul className="space-y-2 text-[14px] text-[var(--text-secondary)]">
                {data.ai_insights.productivity_tips?.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-[var(--color-warning)] font-bold">•</span>
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
        <div className="card-enterprise p-6">
          <h3 className="text-[18px] sm:text-[19px] font-semibold text-[var(--text-primary)] tracking-tight mb-6">Aggregate Focus Levels</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.weekly_trends || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridBorderColor} vertical={false} />
                <XAxis dataKey="date" stroke={axisColor} fontSize={12} tickLine={false} axisLine={{ stroke: gridBorderColor }} />
                <YAxis stroke={axisColor} fontSize={12} domain={[0, 100]} tickLine={false} axisLine={{ stroke: gridBorderColor }} />
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
                <Area type="monotone" dataKey="focus" stroke={brandColor} fill={brandColor} fillOpacity={0.12} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Meeting Quantities */}
        <div className="card-enterprise p-6">
          <h3 className="text-[18px] sm:text-[19px] font-semibold text-[var(--text-primary)] tracking-tight mb-6">Meetings Frequency</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.weekly_trends || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridBorderColor} vertical={false} />
                <XAxis dataKey="date" stroke={axisColor} fontSize={12} tickLine={false} axisLine={{ stroke: gridBorderColor }} />
                <YAxis stroke={axisColor} fontSize={12} tickLine={false} axisLine={{ stroke: gridBorderColor }} />
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
                <Bar dataKey="meetings" fill={barColor} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
