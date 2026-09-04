import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { Save, Settings as SettingsIcon, ShieldKeyhole, Loader2, CheckCircle2, Sun, Moon, Check } from 'lucide-react';

export const Settings: React.FC = () => {
  const { theme, setTheme: setGlobalTheme } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState<'light' | 'dark'>(theme);
  const [audioDevice, setAudioDevice] = useState('');
  const [videoDevice, setVideoDevice] = useState('');
  const [groqKey, setGroqKey] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings/');
        if (res.data.theme === 'light' || res.data.theme === 'dark') {
          setSelectedTheme(res.data.theme);
          setGlobalTheme(res.data.theme);
        }
        setAudioDevice(res.data.audio_device || '');
        setVideoDevice(res.data.video_device || '');
        setGroqKey(res.data.api_keys?.groq_api_key ? '***' : '');
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    };
    fetchSettings();
  }, [setGlobalTheme]);

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setSelectedTheme(newTheme);
    setGlobalTheme(newTheme);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccess(false);

    try {
      const payload: any = {
        theme: selectedTheme,
        audio_device: audioDevice,
        video_device: videoDevice,
      };

      if (groqKey && groqKey !== '***') {
        payload.api_keys = {
          groq_api_key: groqKey,
        };
      }

      await api.put('/settings/', payload);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to update settings:", err);
      alert("Failed to save settings modifications.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-[#e8f0fe] text-[#1a73e8] dark:bg-blue-900/30 dark:text-blue-400 rounded-lg flex items-center justify-center">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">System Settings</h2>
          <p className="text-[var(--text-secondary)] text-sm">Customize visual themes, hardware inputs, and AI credentials</p>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 p-4 rounded-xl text-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Configurations updated and saved successfully!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
        {/* Visual Theme Customization Cards */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            UI Theme Customization
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Light Theme Card */}
            <div
              onClick={() => handleThemeChange('light')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
                selectedTheme === 'light'
                  ? 'border-[#1a73e8] bg-[#e8f0fe]/40 shadow-xs'
                  : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)] bg-[var(--bg-surface)]'
              }`}
            >
              <div className="h-10 w-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-amber-500 shadow-xs shrink-0">
                <Sun className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-900">Google Meet Light</h4>
                  {selectedTheme === 'light' && (
                    <span className="h-5 w-5 rounded-full bg-[#1a73e8] text-white flex items-center justify-center text-xs">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">Clean off-white canvas with Google Blue accents</p>
              </div>
            </div>

            {/* Dark Theme Card */}
            <div
              onClick={() => handleThemeChange('dark')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
                selectedTheme === 'dark'
                  ? 'border-[#3b82f6] bg-blue-950/20 shadow-xs'
                  : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)] bg-[var(--bg-surface)]'
              }`}
            >
              <div className="h-10 w-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 shadow-xs shrink-0">
                <Moon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[var(--text-primary)]">Dark Slate</h4>
                  {selectedTheme === 'dark' && (
                    <span className="h-5 w-5 rounded-full bg-[#3b82f6] text-white flex items-center justify-center text-xs">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Sleek low-light contrast for low eye strain</p>
              </div>
            </div>
          </div>
        </div>

        {/* Hardware Devices */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Input Microphone
            </label>
            <select
              value={audioDevice}
              onChange={(e) => setAudioDevice(e.target.value)}
              className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] text-[var(--text-primary)] rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-[#1a73e8] transition-colors"
            >
              <option value="">Default Microphone</option>
              <option value="built_in">Internal Array Mic</option>
              <option value="external">External USB Headset</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Engagement Webcam
            </label>
            <select
              value={videoDevice}
              onChange={(e) => setVideoDevice(e.target.value)}
              className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] text-[var(--text-primary)] rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-[#1a73e8] transition-colors"
            >
              <option value="">Default Camera</option>
              <option value="integrated">Integrated HD Camera</option>
              <option value="usb_cam">USB Video Device</option>
            </select>
          </div>
        </div>

        {/* API Credentials */}
        <div className="space-y-4 border-t border-[var(--border-subtle)] pt-6">
          <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <ShieldKeyhole className="h-4 w-4 text-[#1a73e8] dark:text-blue-400" />
            AI Developer Credentials
          </h3>
          
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Groq Cloud API Key
            </label>
            <input
              type="password"
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              placeholder="e.g. gsk_..."
              className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] text-[var(--text-primary)] rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#1a73e8] transition-colors"
            />
            <p className="text-[11px] text-[var(--text-muted)] leading-normal">
              Used to query Llama 3.1 8B Instant. You can retrieve a free developer key from console.groq.com.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-3 bg-[#1a73e8] hover:bg-[#1967d2] disabled:opacity-50 text-white font-medium rounded-xl shadow-sm hover:shadow-md transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving Settings...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Configurations
            </>
          )}
        </button>
      </form>
    </div>
  );
};
