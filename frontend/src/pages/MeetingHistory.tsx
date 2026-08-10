import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { PATHS } from '../routes/paths';
import { Calendar, Clock, Activity, Search, Video, ArrowRight } from 'lucide-react';

interface MeetingListItem {
  id: number;
  title: string;
  date: string;
  duration_seconds: number;
  status: string;
  focus_score?: number;
}

export const MeetingHistory: React.FC = () => {
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        const res = await api.get<MeetingListItem[]>('/meetings/');
        setMeetings(res.data);
      } catch (e) {
        console.error("Failed to load meeting index:", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMeetings();
  }, []);

  const filteredMeetings = meetings.filter((meeting) =>
    meeting.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDuration = (sec: int) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Meeting Archive</h2>
          <p className="text-slate-400 text-sm">Browse, search, and inspect past discussions and summaries.</p>
        </div>
        <Link
          to={PATHS.CREATE_MEETING}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2.5 rounded-lg shadow-lg transition-all text-sm self-start"
        >
          <Video className="h-4 w-4" />
          New Meeting
        </Link>
      </div>

      {/* Search Input Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search meetings by title..."
          className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white rounded-lg pl-10 pr-4 py-2.5 text-sm transition-all outline-none"
        />
      </div>

      {/* Grid List */}
      {filteredMeetings.length === 0 ? (
        <div className="glass-card text-center py-16 text-slate-500 text-sm rounded-xl">
          No matching meetings found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMeetings.map((meeting) => (
            <div
              key={meeting.id}
              className="glass-card p-6 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700/80 transition-all hover:shadow-lg hover:shadow-indigo-500/[0.02]"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-semibold font-mono">ID: #{meeting.id}</span>
                  <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                    meeting.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : meeting.status === 'ongoing'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                  }`}>
                    {meeting.status}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white line-clamp-1">{meeting.title}</h3>
                
                <div className="flex flex-col gap-2 text-xs text-slate-400 pt-1">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-500" />
                    {new Date(meeting.date).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-500" />
                    {formatDuration(meeting.duration_seconds)}
                  </span>
                  {meeting.focus_score !== undefined && (
                    <span className="flex items-center gap-1.5 font-medium">
                      <Activity className="h-3.5 w-3.5 text-indigo-400" />
                      Focus Level:{' '}
                      <strong className={meeting.focus_score >= 80 ? 'text-emerald-400' : 'text-amber-400'}>
                        {meeting.focus_score}%
                      </strong>
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80 flex justify-end">
                <Link
                  to={meeting.status === 'ongoing' ? `/meetings/${meeting.id}/live` : `/meetings/${meeting.id}`}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold inline-flex items-center gap-1 transition-colors"
                >
                  View Details
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
