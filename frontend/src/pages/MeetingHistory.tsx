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

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-[var(--color-brand)] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-[26px] sm:text-[28px] font-semibold text-[var(--text-primary)] tracking-tight">Meeting Archive</h2>
          <p className="text-[15px] text-[var(--text-secondary)] mt-1">Browse, search, and inspect past discussions and AI reports.</p>
        </div>
        <Link
          to={PATHS.CREATE_MEETING}
          className="btn-primary text-[14px] py-2 px-4 gap-2 rounded-lg self-start"
        >
          <Video className="h-4 w-4" />
          New Meeting
        </Link>
      </div>

      {/* Search Input Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-[var(--text-muted)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search meetings by title..."
          className="input-enterprise pl-10 pr-4 py-2 text-[14px]"
        />
      </div>

      {/* Grid List */}
      {filteredMeetings.length === 0 ? (
        <div className="card-enterprise text-center py-16 text-[var(--text-secondary)] text-[15px]">
          No matching meetings found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMeetings.map((meeting) => (
            <div
              key={meeting.id}
              className="card-enterprise p-6 flex flex-col justify-between"
            >
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[var(--text-muted)] font-mono font-medium">#{meeting.id}</span>
                  {meeting.status === 'completed' ? (
                    <span className="badge-success capitalize">{meeting.status}</span>
                  ) : meeting.status === 'ongoing' ? (
                    <span className="badge-warning capitalize live-pulse">{meeting.status}</span>
                  ) : (
                    <span className="badge-neutral capitalize">{meeting.status}</span>
                  )}
                </div>

                <h3 className="text-[17px] sm:text-[18px] font-semibold text-[var(--text-primary)] line-clamp-1">{meeting.title}</h3>
                
                <div className="flex flex-col gap-2 text-[13px] sm:text-[14px] text-[var(--text-secondary)] pt-1">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
                    {new Date(meeting.date).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
                    {formatDuration(meeting.duration_seconds)}
                  </span>
                  {meeting.focus_score !== undefined && (
                    <span className="flex items-center gap-2 font-medium">
                      <Activity className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
                      Focus Level:{' '}
                      <strong className={meeting.focus_score >= 80 ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}>
                        {meeting.focus_score.toFixed(1)}%
                      </strong>
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[var(--border-subtle)] flex justify-end">
                <Link
                  to={meeting.status === 'ongoing' ? `/meetings/${meeting.id}/live` : `/meetings/${meeting.id}`}
                  className="text-[13px] font-medium text-[var(--color-brand)] hover:text-[var(--color-brand-hover)] inline-flex items-center gap-1.5 transition-colors"
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
