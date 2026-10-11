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
        <h2 className="text-[26px] sm:text-[28px] font-semibold text-[var(--text-primary)] tracking-tight flex items-center justify-center gap-2.5">
          <Brain className="h-6 w-6 text-[var(--color-brand)]" />
          AI Meeting Search Assistant
        </h2>
        <p className="text-[15px] text-[var(--text-secondary)]">
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
            className="input-enterprise pl-10 pr-4 py-3 text-[14px]"
          />
        </div>
        <button
          type="submit"
          disabled={isSearching}
          className="btn-primary px-6 py-3 text-[14px] disabled:opacity-50 gap-2 shrink-0 cursor-pointer"
        >
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Query'}
        </button>
      </form>

      {/* Results Box */}
      {isSearching && (
        <div className="card-enterprise p-8 text-center space-y-3">
          <Loader2 className="h-8 w-8 text-[var(--color-brand)] animate-spin mx-auto" />
          <p className="text-[14px] text-[var(--text-secondary)]">Searching historical transcripts and synthesizing answer...</p>
        </div>
      )}

      {!isSearching && result && (
        <div className="space-y-6">
          {/* Answer Card */}
          <div className="card-enterprise p-6 sm:p-7 space-y-3">
            <h3 className="text-[12px] font-semibold text-[var(--color-brand)] uppercase tracking-wider">
              AI Answer
            </h3>
            <p className="text-[15px] sm:text-[16px] text-[var(--text-primary)] leading-[1.65] whitespace-pre-line">
              {result.answer}
            </p>
          </div>

          {/* Citations Card */}
          {result.citations.length > 0 && (
            <div className="card-enterprise p-6 space-y-3">
              <h4 className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Source Citations
              </h4>
              <div className="divide-y divide-[var(--border-subtle)]">
                {result.citations.map((cite, idx) => (
                  <div key={idx} className="py-3.5 flex items-center justify-between text-[14px]">
                    <span className="flex items-center gap-2 text-[var(--text-primary)] font-medium">
                      <CornerDownRight className="h-4 w-4 text-[var(--text-muted)]" />
                      {cite.title}
                      <span className="text-[var(--text-muted)] text-[12px] font-mono">({cite.date})</span>
                    </span>
                    <Link
                      to={`/meetings/${cite.meeting_id}`}
                      className="text-[13px] font-medium text-[var(--color-brand)] hover:text-[var(--color-brand-hover)] inline-flex items-center gap-1 transition-colors"
                    >
                      Inspect Source
                      <ArrowRight className="h-3.5 w-3.5" />
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
