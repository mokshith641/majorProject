import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Save, Settings as SettingsIcon, ShieldKeyhole, Loader2, CheckCircle2 } from 'lucide-react';

export const Settings: React.FC = () => {
  const [theme, setTheme] = useState('dark');
  const [audioDevice, setAudioDevice] = useState('');
  const [videoDevice, setVideoDevice] = useState('');
  const [groqKey, setGroqKey] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings/');
        setTheme(res.data.theme || 'dark');
        setAudioDevice(res.data.audio_device || '');
        setVideoDevice(res.data.video_device || '');
        // The API returns masked keys, we don't overwrite if present
        setGroqKey(res.data.api_keys?.groq_api_key ? '***' : '');
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccess(false);

    try {
      const payload: any = {
        theme,
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
        <div className="h-10 w-10 bg-indigo-500/10 text-indigo-400 rounded-lg flex items-center justify-center">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">System Settings</h2>
          <p className="text-slate-400 text-sm">Configure hardware inputs and authorization API tokens</p>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 p-4 rounded-lg text-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>Configurations updated successfully!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="glass-card rounded-xl p-8 border border-slate-800 space-y-6">
        {/* Theme Settings */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
            UI Theme Mode
          </label>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="w-full bg-[#090D16] border border-slate-800 focus:border-indigo-500 text-white rounded-lg px-3 py-2.5 text-sm outline-none cursor-pointer"
          >
            <option value="dark">Dark Theme (Default)</option>
            <option value="light">Light Theme</option>
          </select>
        </div>

        {/* Hardware Devices */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Input Microphone
            </label>
            <select
              value={audioDevice}
              onChange={(e) => setAudioDevice(e.target.value)}
              className="w-full bg-[#090D16] border border-slate-800 text-white rounded-lg px-3 py-2.5 text-sm outline-none"
            >
              <option value="">Default Microphone</option>
              <option value="built_in">Internal Array Mic</option>
              <option value="external">External USB Headset</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Engagement Webcam
            </label>
            <select
              value={videoDevice}
              onChange={(e) => setVideoDevice(e.target.value)}
              className="w-full bg-[#090D16] border border-slate-800 text-white rounded-lg px-3 py-2.5 text-sm outline-none"
            >
              <option value="">Default Camera</option>
              <option value="integrated">Integrated HD Camera</option>
              <option value="usb_cam">USB Video Device</option>
            </select>
          </div>
        </div>

        {/* API Credentials */}
        <div className="space-y-4 border-t border-slate-800/80 pt-6">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldKeyhole className="h-4 w-4 text-indigo-400" />
            AI Developer Credentials
          </h3>
          
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Groq Cloud API Key
            </label>
            <input
              type="password"
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              placeholder="e.g. gsk_..."
              className="w-full bg-[#090D16] border border-slate-800 focus:border-indigo-500 text-white rounded-lg px-4 py-2.5 text-sm outline-none transition-all"
            />
            <p className="text-[10px] text-slate-500 leading-normal">
              Used to query Llama 3.1 8B Instant. You can retrieve a free developer key from console.groq.com.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 text-white font-semibold rounded-lg shadow-lg transition-all text-sm flex items-center justify-center gap-2"
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
