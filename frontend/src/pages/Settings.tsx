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
      <div className="flex items-center gap-3.5">
        <div className="h-11 w-11 bg-[var(--bg-elevated)] text-[var(--color-brand)] border border-[var(--border-subtle)] rounded-xl flex items-center justify-center shrink-0">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-[20px] sm:text-[22px] font-semibold text-[var(--text-primary)] tracking-tight">System Settings</h2>
          <p className="text-[14px] text-[var(--text-secondary)] mt-0.5">Customize visual themes, hardware inputs, and AI credentials</p>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2.5 bg-[var(--color-success-bg)] border border-[var(--color-success)]/30 text-[var(--color-success)] p-4 rounded-xl text-[14px] font-medium">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Configurations updated and saved successfully!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="card-enterprise p-6 sm:p-8 space-y-6">
        {/* Visual Theme Customization Cards */}
        <div className="space-y-3">
          <label className="block text-[13px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            UI Theme Customization
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Light Theme Card */}
            <div
              onClick={() => handleThemeChange('light')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
                selectedTheme === 'light'
                  ? 'border-[var(--color-brand)] bg-[var(--color-brand-light)] shadow-xs'
                  : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)] bg-[var(--bg-card)]'
              }`}
            >
              <div className="h-10 w-10 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--color-warning)] shadow-xs shrink-0">
                <Sun className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-[14px] font-semibold text-[var(--text-primary)]">Enterprise Light</h4>
                  {selectedTheme === 'light' && (
                    <span className="h-5 w-5 rounded-full bg-[var(--color-brand)] text-white flex items-center justify-center text-xs">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-[var(--text-secondary)] mt-1">Clean off-white canvas with crisp neutral borders</p>
              </div>
            </div>

            {/* Dark Theme Card */}
            <div
              onClick={() => handleThemeChange('dark')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
                selectedTheme === 'dark'
                  ? 'border-[var(--color-brand)] bg-[var(--bg-elevated)] shadow-xs'
                  : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)] bg-[var(--bg-card)]'
              }`}
            >
              <div className="h-10 w-10 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--color-brand)] shadow-xs shrink-0">
                <Moon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-[14px] font-semibold text-[var(--text-primary)]">Graphite Dark</h4>
                  {selectedTheme === 'dark' && (
                    <span className="h-5 w-5 rounded-full bg-[var(--color-brand)] text-white flex items-center justify-center text-xs">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-[var(--text-secondary)] mt-1">Neutral graphite & charcoal palette for maximum clarity</p>
              </div>
            </div>
          </div>
        </div>

        {/* Hardware Devices */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="space-y-2">
            <label className="block text-[13px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Input Microphone
            </label>
            <select
              value={audioDevice}
              onChange={(e) => setAudioDevice(e.target.value)}
              className="input-enterprise py-2.5 text-[14px]"
            >
              <option value="">Default Microphone</option>
              <option value="built_in">Internal Array Mic</option>
              <option value="external">External USB Headset</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-[13px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Engagement Webcam
            </label>
            <select
              value={videoDevice}
              onChange={(e) => setVideoDevice(e.target.value)}
              className="input-enterprise py-2.5 text-[14px]"
            >
              <option value="">Default Camera</option>
              <option value="integrated">Integrated HD Camera</option>
              <option value="usb_cam">USB Video Device</option>
            </select>
          </div>
        </div>

        {/* API Credentials */}
        <div className="space-y-4 border-t border-[var(--border-subtle)] pt-6">
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <ShieldKeyhole className="h-4 w-4 text-[var(--color-brand)]" />
            AI Developer Credentials
          </h3>
          
          <div className="space-y-2">
            <label className="block text-[13px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Groq Cloud API Key
            </label>
            <input
              type="password"
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              placeholder="e.g. gsk_..."
              className="input-enterprise py-2.5 text-[14px]"
            />
            <p className="text-[12px] text-[var(--text-muted)] leading-normal">
              Used to query Whisper Large V3 and Llama 3 models. You can retrieve a free developer key from console.groq.com.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="btn-primary w-full py-2.5 text-[14px] disabled:opacity-50 cursor-pointer gap-2"
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
