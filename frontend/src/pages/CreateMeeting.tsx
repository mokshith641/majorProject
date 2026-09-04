import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { api } from '../services/api';
import { Video, Plus, Trash2, ArrowLeft, Loader2, Upload, FileText } from 'lucide-react';
import { PATHS } from '../routes/paths';

interface ParticipantField {
  name: string;
  email: string;
}

interface CreateMeetingInputs {
  title: string;
  participants: ParticipantField[];
}

type SessionTab = 'live' | 'audio' | 'transcript';

export const CreateMeeting: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SessionTab>('live');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Audio upload state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  
  // Custom transcript state
  const [transcriptText, setTranscriptText] = useState('');

  const handleTranscriptFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setTranscriptText(text || '');
    };
    reader.readAsText(file);
  };

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateMeetingInputs>({
    defaultValues: {
      participants: [{ name: '', email: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'participants',
  });

  const onSubmit = async (data: CreateMeetingInputs) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      // Filter out empty participant rows
      const cleanedParticipants = data.participants.filter(p => p.name.trim() !== '');

      // 1. Create meeting entry
      const response = await api.post('/meetings/', {
        title: data.title,
        participants: cleanedParticipants
      });
      const meetingId = response.data.id;

      if (activeTab === 'live') {
        // Start live session tracking
        await api.post(`/meetings/${meetingId}/start`);
        navigate(`/meetings/${meetingId}/live`);
      } else if (activeTab === 'audio') {
        // Upload audio file
        if (!audioFile) {
          setErrorMsg('Please select an audio file to upload.');
          setIsSubmitting(false);
          return;
        }

        const formData = new FormData();
        formData.append('audio', audioFile);

        await api.post(`/meetings/${meetingId}/upload-audio`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        // Direct user to meeting summary page after background AI processing
        navigate(`/meetings/${meetingId}`);
      } else if (activeTab === 'transcript') {
        // Submit raw transcript text
        if (!transcriptText.trim()) {
          setErrorMsg('Please provide a meeting transcript text.');
          setIsSubmitting(false);
          return;
        }

        await api.post(`/meetings/${meetingId}/transcript`, {
          transcript_text: transcriptText,
        });

        navigate(`/meetings/${meetingId}`);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(
        err.response?.data?.detail || 'Failed to initialize session. Please check your inputs.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button
        onClick={() => navigate(PATHS.DASHBOARD)}
        className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
        {/* Header Title */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-[#e8f0fe] text-[#1a73e8] dark:bg-blue-900/30 dark:text-blue-400 rounded-xl flex items-center justify-center">
            {activeTab === 'live' && <Video className="h-5 w-5" />}
            {activeTab === 'audio' && <Upload className="h-5 w-5" />}
            {activeTab === 'transcript' && <FileText className="h-5 w-5" />}
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Create Smart Session</h2>
            <p className="text-[var(--text-secondary)] text-sm">
              {activeTab === 'live' && 'Configure title and start recording meeting telemetry'}
              {activeTab === 'audio' && 'Upload a pre-recorded audio file to transcribe and summarize'}
              {activeTab === 'transcript' && 'Paste a raw transcript text to generate dynamic summaries'}
            </p>
          </div>
        </div>

        {/* Tab Selection Row */}
        <div className="flex bg-[var(--bg-card-secondary)] p-1 rounded-xl border border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => {
              setActiveTab('live');
              setErrorMsg(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'live'
                ? 'bg-[#1a73e8] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
            }`}
          >
            <Video className="h-3.5 w-3.5" />
            Live Session
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('audio');
              setErrorMsg(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'audio'
                ? 'bg-[#1a73e8] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload Audio
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('transcript');
              setErrorMsg(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'transcript'
                ? 'bg-[#1a73e8] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Paste Transcript
          </button>
        </div>

        {errorMsg && (
          <p className="bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-300 text-sm p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/50">
            {errorMsg}
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Title input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
              Session / Meeting Title
            </label>
            <input
              type="text"
              {...register('title', { required: 'Session title is required' })}
              placeholder="Design & Architecture Review"
              className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] focus:border-[#1a73e8] text-[var(--text-primary)] rounded-xl px-4 py-2.5 text-sm transition-all outline-none"
            />
            {errors.title && <p className="text-rose-600 dark:text-rose-400 text-xs mt-1">{errors.title.message}</p>}
          </div>

          {/* Tab Specific Content */}
          {activeTab === 'audio' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Select Audio File
              </label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-[var(--border-strong)] border-dashed rounded-2xl cursor-pointer bg-[var(--bg-card-secondary)] hover:bg-[var(--bg-surface-hover)] transition-all hover:border-[#1a73e8]">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 text-[var(--text-muted)] mb-2" />
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {audioFile ? audioFile.name : 'Click to select recorded audio'}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">WAV or MP3 (Max 50MB)</p>
                  </div>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {activeTab === 'transcript' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Meeting Transcript
                </label>
                <label className="inline-flex items-center gap-1.5 text-xs text-[#1a73e8] hover:text-[#1967d2] cursor-pointer font-semibold">
                  <Upload className="h-3.5 w-3.5" />
                  Upload Transcript File
                  <input
                    type="file"
                    accept=".txt,.vtt,.srt,.json"
                    onChange={handleTranscriptFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <textarea
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
                placeholder="Priya: Good morning everyone...&#10;Arjun: Yes, let's start the review..."
                rows={8}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] focus:border-[#1a73e8] text-[var(--text-primary)] rounded-xl px-4 py-2.5 text-sm transition-all outline-none resize-y font-mono"
              />
              <p className="text-xs text-[var(--text-secondary)]">
                You can paste the transcript directly or click the upload button to load a .txt, .vtt, .srt, or .json file.
              </p>
            </div>
          )}

          {/* Participant list fields */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Meeting Participants
              </label>
              <button
                type="button"
                onClick={() => append({ name: '', email: '' })}
                className="flex items-center gap-1 text-xs text-[#1a73e8] hover:text-[#1967d2] transition-colors font-semibold cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                Add Row
              </button>
            </div>

            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-3 items-start">
                  <div className="flex-1">
                    <input
                      type="text"
                      {...register(`participants.${index}.name` as const)}
                      placeholder="Name (e.g. Alice)"
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] focus:border-[#1a73e8] text-[var(--text-primary)] rounded-xl px-3.5 py-2 text-sm outline-none transition-all"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="email"
                      {...register(`participants.${index}.email` as const)}
                      placeholder="Email (optional)"
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] focus:border-[#1a73e8] text-[var(--text-primary)] rounded-xl px-3.5 py-2 text-sm outline-none transition-all"
                    />
                  </div>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="p-2 text-[var(--text-muted)] hover:text-rose-500 hover:bg-[var(--bg-surface-hover)] rounded-lg mt-0.5 transition-colors cursor-pointer"
                      title="Remove participant"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-[#1a73e8] hover:bg-[#1967d2] disabled:opacity-50 text-white font-medium rounded-xl shadow-xs hover:shadow-md transition-all text-sm flex items-center justify-center gap-2 mt-4 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {activeTab === 'live' && 'Initializing Systems...'}
                {activeTab === 'audio' && 'Transcribing & Summarizing...'}
                {activeTab === 'transcript' && 'Generating Summary...'}
              </>
            ) : (
              <>
                {activeTab === 'live' && 'Start Meeting & Tracking'}
                {activeTab === 'audio' && 'Process Uploaded Audio'}
                {activeTab === 'transcript' && 'Generate Summary'}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
