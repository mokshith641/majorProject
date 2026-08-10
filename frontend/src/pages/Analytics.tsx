import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { BarChart3, TrendingUp, Cpu, Timer } from 'lucide-react';
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

interface AnalyticsData {
  totals: Totals;
  weekly_trends: TrendDay[];
  active_windows: ActiveWindowShare[];
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
