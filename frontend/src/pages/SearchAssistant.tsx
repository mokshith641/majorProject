import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Search, Brain, Loader2, ArrowRight, CornerDownRight } from 'lucide-react';

interface Citation {
  meeting_id: number;
  title: string;
  date: string;
}

interface SearchResponse {
  query: string;
  answer: string;
  citations: Citation[];
}

export const SearchAssistant: React.FC = () => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const res = await api.get<SearchResponse>('/search/', {
        params: { q: query },
      });
      setResult(res.data);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-2 mb-8">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center justify-center gap-2">
          <Brain className="h-6 w-6 text-[#1a73e8] dark:text-blue-400" />
          AI Meeting Search Assistant
        </h2>
        <p className="text-[var(--text-secondary)] text-sm">
          Ask questions across all historical meeting transcripts with intelligent neural retrieval.
        </p>
      </div>

      {/* Input Form Box */}
      <form onSubmit={handleSearch} className="flex gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., 'What decisions were made about database schemas?'"
            className="w-full bg-[var(--bg-card)] border border-[var(--border-strong)] focus:border-[#1a73e8] text-[var(--text-primary)] rounded-xl pl-10 pr-4 py-3 text-sm outline-none transition-all shadow-xs"
          />
        </div>
        <button
          type="submit"
          disabled={isSearching}
          className="bg-[#1a73e8] hover:bg-[#1967d2] disabled:opacity-50 text-white font-medium px-6 py-3 rounded-xl shadow-xs hover:shadow-md transition-all text-sm flex items-center gap-2 shrink-0 cursor-pointer"
        >
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Query'}
        </button>
      </form>

      {/* Results Box */}
      {isSearching && (
        <div className="glass-card p-8 rounded-2xl text-center space-y-3">
          <Loader2 className="h-8 w-8 text-[#1a73e8] dark:text-blue-400 animate-spin mx-auto" />
          <p className="text-[var(--text-secondary)] text-sm">Searching historical transcripts and generating answer...</p>
        </div>
      )}

      {!isSearching && result && (
        <div className="space-y-6 animate-fade-in">
          {/* Answer Card */}
          <div className="glass-card p-6 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold text-[#1a73e8] dark:text-blue-400 flex items-center gap-2 uppercase tracking-wider">
              AI Answer
            </h3>
            <p className="text-[var(--text-primary)] text-sm leading-relaxed whitespace-pre-line">
              {result.answer}
            </p>
          </div>

          {/* Citations Card */}
          {result.citations.length > 0 && (
            <div className="glass-card p-5 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">
                Source Citations
              </h4>
              <div className="divide-y divide-[var(--border-subtle)]">
                {result.citations.map((cite, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-[var(--text-primary)]">
                      <CornerDownRight className="h-4 w-4 text-[var(--text-muted)]" />
                      {cite.title}
                      <span className="text-[var(--text-muted)] text-xs font-mono">({cite.date})</span>
                    </span>
                    <Link
                      to={`/meetings/${cite.meeting_id}`}
                      className="text-xs text-[#1a73e8] hover:text-[#1967d2] inline-flex items-center gap-1 font-semibold transition-colors"
                    >
                      Inspect Source
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
