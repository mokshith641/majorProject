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
          throw new Error('Please select an audio file to upload.');
        }
        const formData = new FormData();
        formData.append('file', audioFile);
        
        await api.post(`/meetings/${meetingId}/upload-recording`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        navigate(`/meetings/${meetingId}`);
      } else if (activeTab === 'transcript') {
        // Submit raw text transcript
        if (!transcriptText.trim()) {
          throw new Error('Transcript text cannot be empty.');
        }
        await api.post(`/meetings/${meetingId}/submit-transcript`, {
          transcript: transcriptText
        });
        navigate(`/meetings/${meetingId}`);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || e.response?.data?.detail || 'Failed to create and process meeting session.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button
        onClick={() => navigate(PATHS.DASHBOARD)}
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      <div className="glass-card rounded-xl p-8 border border-slate-800 space-y-6">
        {/* Header Title */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-indigo-500/10 text-indigo-400 rounded-lg flex items-center justify-center">
            {activeTab === 'live' && <Video className="h-5 w-5" />}
            {activeTab === 'audio' && <Upload className="h-5 w-5" />}
            {activeTab === 'transcript' && <FileText className="h-5 w-5" />}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Create Smart Session</h2>
            <p className="text-slate-400 text-sm">
              {activeTab === 'live' && 'Configure title and start recording meeting telemetry'}
              {activeTab === 'audio' && 'Upload a pre-recorded audio file to transcribe and summarize'}
              {activeTab === 'transcript' && 'Paste a raw transcript text to generate dynamic summaries'}
            </p>
          </div>
        </div>

        {/* Tab Selection Row */}
        <div className="flex bg-slate-900/60 p-1 rounded-lg border border-slate-800/80">
          <button
            type="button"
            onClick={() => {
              setActiveTab('live');
              setErrorMsg(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'live'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
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
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'audio'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
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
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'transcript'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Paste Transcript
          </button>
        </div>

        {errorMsg && (
          <p className="bg-red-950/20 text-red-300 text-sm p-3 rounded-lg border border-red-900/50">
            {errorMsg}
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Title input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Session / Meeting Title
            </label>
            <input
              type="text"
              {...register('title', { required: 'Session title is required' })}
              placeholder="Design & Architecture Review"
              className="w-full bg-[#090D16] border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white rounded-lg px-4 py-2.5 text-sm transition-all outline-none"
            />
            {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title.message}</p>}
          </div>

          {/* Tab Specific Content */}
          {activeTab === 'audio' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Select Audio File
              </label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-800 border-dashed rounded-lg cursor-pointer bg-slate-900/30 hover:bg-slate-800/20 transition-all hover:border-indigo-500">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 text-slate-400 mb-2" />
                    <p className="text-sm text-slate-300">
                      {audioFile ? audioFile.name : 'Click to select recorded audio'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">WAV or MP3 (Max 50MB)</p>
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
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Paste Meeting Transcript
              </label>
              <textarea
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
                placeholder="Priya: Good morning everyone...&#10;Arjun: Yes, let's start the review..."
                rows={8}
                className="w-full bg-[#090D16] border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white rounded-lg px-4 py-2.5 text-sm transition-all outline-none resize-y font-mono text-slate-300"
              />
            </div>
          )}

          {/* Participant list fields */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Meeting Participants
              </label>
              <button
                type="button"
                onClick={() => append({ name: '', email: '' })}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
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
                      {...register(`participants.${index}.name` as const, {
                        required: index === 0 ? 'First participant name is required' : false,
                      })}
                      placeholder="Name (e.g. Alice)"
                      className="w-full bg-[#090D16] border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white rounded-lg px-3 py-2 text-sm outline-none transition-all"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="email"
                      {...register(`participants.${index}.email` as const)}
                      placeholder="Email (optional)"
                      className="w-full bg-[#090D16] border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white rounded-lg px-3 py-2 text-sm outline-none transition-all"
                    />
                  </div>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800/40 rounded-lg mt-0.5 transition-colors"
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
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 text-white font-medium rounded-lg shadow-lg hover:shadow-indigo-600/10 transition-all text-sm flex items-center justify-center gap-2 mt-4"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {activeTab === 'live' && 'Initializing Systems...'}
                {activeTab === 'audio' && 'Transcribing & Summarizing...'}
                {activeTab === 'transcript' && 'Generating T5 Summary...'}
              </>
            ) : (
              <>
                {activeTab === 'live' && 'Start Meeting & Tracking'}
                {activeTab === 'audio' && 'Process Uploaded Audio'}
                {activeTab === 'transcript' && 'Generate T5 Summary'}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
