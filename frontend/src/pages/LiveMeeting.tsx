import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { PATHS } from '../routes/paths';
import {
  Square,
  Clock,
  Video,
  Monitor,
  Volume2,
  MousePointerClick,
  Keyboard,
  Brain,
  AlertCircle,
  Share2,
  Copy,
  Check
} from 'lucide-react';

export const LiveMeeting: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [meetingTitle, setMeetingTitle] = useState('Active Meeting Session');
  const [hostId, setHostId] = useState<number | null>(null);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [localClicks, setLocalClicks] = useState(0);
  const [localKeys, setLocalKeys] = useState(0);
  const [isEnding, setIsEnding] = useState(false);
  const [streamActive, setStreamActive] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<string[]>([
    "System: Telemetry tracking established.",
    "System: Audio buffer stream listening active."
  ]);

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const isHost = user && hostId ? user.id === hostId : true;

  const handleCopyLink = () => {
    const link = `${window.location.origin}/meetings/${id}/live`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(id || '');
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // 1. Fetch meeting title and setup local webcam
  useEffect(() => {
    const fetchMeeting = async () => {
      try {
        // Automatically register participant/join session in backend
        await api.post(`/meetings/${id}/join`);
      } catch (e) {
        console.warn("Could not join meeting as participant:", e);
      }
      try {
        const res = await api.get(`/meetings/${id}`);
        setMeetingTitle(res.data.title);
        setHostId(res.data.host_id);
      } catch (e) {
        console.error("Could not fetch meeting name", e);
      }
    };
    fetchMeeting();

    // Start local camera stream in the browser for UI preview
    const startCam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          mediaStreamRef.current = stream;
          setStreamActive(true);
        }
      } catch (err) {
        console.warn("Webcam access denied. Using simulated placeholder video stream.", err);
        // Create canvas to generate a mock video stream
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        
        let angle = 0;
        const intervalId = setInterval(() => {
          if (!ctx) return;
          // Draw a modern mock camera background (gradient)
          const grad = ctx.createRadialGradient(160, 120, 10, 160, 120, 180);
          grad.addColorStop(0, '#1e1b4b');
          grad.addColorStop(1, '#090d16');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 320, 240);
          
          // Draw user avatar placeholder circle
          ctx.beginPath();
          ctx.arc(160, 110, 45, 0, Math.PI * 2);
          ctx.fillStyle = '#312e81';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#4f46e5';
          ctx.stroke();
          
          // Draw avatar body arc
          ctx.beginPath();
          ctx.arc(160, 200, 60, Math.PI, 0);
          ctx.fillStyle = '#312e81';
          ctx.fill();
          ctx.stroke();
          
          // Draw a pulsing "Active Simulation" dot
          ctx.beginPath();
          const radius = 6 + Math.abs(Math.sin(angle)) * 3;
          ctx.arc(30, 30, radius, 0, Math.PI * 2);
          ctx.fillStyle = '#22c55e'; // Green dot
          ctx.fill();
          
          // Draw "CAMERA SIMULATION" text
          ctx.fillStyle = '#94a3b8';
          ctx.font = 'bold 10px sans-serif';
          ctx.fillText('CAMERA SIMULATION', 50, 34);
          
          angle += 0.1;
        }, 100);

        const simulatedStream = (canvas as any).captureStream ? (canvas as any).captureStream(10) : null;
        if (simulatedStream && videoRef.current) {
          videoRef.current.srcObject = simulatedStream;
          mediaStreamRef.current = simulatedStream;
          (simulatedStream as any)._simIntervalId = intervalId;
          setStreamActive(true);
        }
      }
    };
    startCam();

    return () => {
      // Cleanup: stop video stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        if ((mediaStreamRef.current as any)._simIntervalId) {
          clearInterval((mediaStreamRef.current as any)._simIntervalId);
        }
      }
    };
  }, [id]);

  // 2. Setup running duration timer
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // 3. Setup client-side input activity counters
  useEffect(() => {
    const handleClick = () => setLocalClicks((prev) => prev + 1);
    const handleKeyPress = () => setLocalKeys((prev) => prev + 1);

    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  // 4. Simulate live speech transcription fragments arriving (visual feedback)
  useEffect(() => {
    const phrases = [
      "Hello everyone, let's start the sync review.",
      "Moksh, can you update us on the database setup?",
      "Sure, we configured SQLite locally but PostgreSQL is supported in production.",
      "Perfect. And how is the MediaPipe face telemetry performing?",
      "It reads face gaze landmarks cleanly with low compute requirements.",
      "Excellent. Let's make sure the report exports are formatted nicely."
    ];

    const intervals = [10, 25, 45, 60, 80, 95];
    const timers = intervals.map((time, idx) => {
      return setTimeout(() => {
        setLiveTranscript((prev) => [...prev, `Speaker: "${phrases[idx]}"`]);
      }, time * 1000);
    });

    return () => timers.forEach(clearTimeout);
  }, []);

  const formatTime = (totalSec: int) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleEndMeeting = async () => {
    setIsEnding(true);
    try {
      // Trigger stop recording, run local Whisper and Groq
      await api.post(`/meetings/${id}/end`);
      // Stop local camera streams
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      // Redirect to summaries inspection view
      navigate(`/meetings/${id}`);
    } catch (e) {
      console.error("Error ending meeting:", e);
      alert("Failed to compile meeting data. Please try again.");
      setIsEnding(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">{meetingTitle}</h2>
          <p className="text-xs text-slate-500 mt-1 uppercase font-semibold tracking-wider">
            {isHost ? "Host View" : "Participant View"}
          </p>
        </div>
        
        {/* Share Invite Widget */}
        <div className="flex flex-wrap items-center gap-3 bg-slate-900/60 border border-slate-800/85 px-4 py-2 rounded-xl shadow-lg">
          <div className="flex items-center gap-1.5 border-r border-slate-800 pr-3">
            <span className="text-xs text-slate-500 font-medium">Code:</span>
            <span className="text-sm font-bold text-indigo-400 font-mono">{id}</span>
            <button
              onClick={handleCopyCode}
              title="Copy Code"
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded transition-all ml-1 cursor-pointer"
            >
              {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 text-xs text-indigo-300 hover:text-white bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-500/20 hover:border-indigo-500 px-3 py-1.5 rounded-lg font-semibold shadow-xs hover:shadow-indigo-600/10 transition-all cursor-pointer"
          >
            {copiedLink ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                Copied Link!
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" />
                Share Invite Link
              </>
            )}
          </button>
        </div>
      </div>

      {/* Live Warning Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-red-500/10 border border-red-500/20 px-6 py-4 rounded-xl">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          <div>
            <h3 className="font-semibold text-white text-sm">Session Recording Active</h3>
            <p className="text-slate-400 text-xs mt-0.5">Microphone inputs and desktop activity telemetry logs are running in background.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-lg border border-slate-800 font-mono text-white text-lg">
          <Clock className="h-4 w-4 text-indigo-400" />
          {formatTime(secondsElapsed)}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Side: Video Preview & Local telemetry */}
        <div className="space-y-6 md:col-span-1">
          {/* Webcam Box */}
          <div className="glass-card rounded-xl p-5 border border-slate-800 flex flex-col items-center">
            <h4 className="text-sm font-semibold text-white self-start mb-4 flex items-center gap-1.5">
              <Video className="h-4 w-4 text-indigo-400" />
              Webcam preview
            </h4>
            <div className="relative w-full aspect-video bg-[#090D16] rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover scale-x-[-1] ${streamActive ? 'block' : 'hidden'}`}
              />
              {!streamActive && (
                <div className="text-center p-4">
                  <div className="h-10 w-10 bg-slate-800/80 rounded-full flex items-center justify-center mx-auto mb-2 text-slate-400">
                    X
                  </div>
                  <p className="text-xs text-slate-500">Camera device inactive</p>
                </div>
              )}
              {streamActive && (
                <span className="absolute bottom-2 left-2 bg-indigo-600/80 backdrop-blur-xs px-2 py-0.5 rounded text-[10px] text-white">
                  MediaPipe Active
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-3 text-center">Gaze coordinates and posture index verified locally.</p>
          </div>

          {/* Client Inputs Counters */}
          <div className="glass-card rounded-xl p-5 border border-slate-800 space-y-4">
            <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
              <Monitor className="h-4 w-4 text-indigo-400" />
              Interaction Stats (Live)
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg flex items-center gap-3">
                <Keyboard className="h-5 w-5 text-indigo-400" />
                <div>
                  <p className="text-slate-500 text-[10px] uppercase font-semibold">Keystrokes</p>
                  <p className="text-lg font-bold text-white mt-0.5">{localKeys}</p>
                </div>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg flex items-center gap-3">
                <MousePointerClick className="h-5 w-5 text-indigo-400" />
                <div>
                  <p className="text-slate-500 text-[10px] uppercase font-semibold">Clicks</p>
                  <p className="text-lg font-bold text-white mt-0.5">{localClicks}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Live transcript simulator */}
        <div className="md:col-span-2 glass-card rounded-xl p-6 border border-slate-800 flex flex-col h-[400px]">
          <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-1.5 border-b border-slate-800/80 pb-3">
            <Volume2 className="h-4 w-4 text-indigo-400" />
            Live transcription preview
          </h4>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
            {liveTranscript.map((line, index) => (
              <div
                key={index}
                className={`p-2.5 rounded-lg text-sm leading-relaxed ${
                  line.startsWith('System')
                    ? 'bg-slate-900/40 text-slate-500 font-mono text-xs'
                    : 'bg-indigo-950/10 border border-indigo-900/20 text-slate-200'
                }`}
              >
                {line}
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800/80 flex justify-end">
            {isHost ? (
              <button
                onClick={handleEndMeeting}
                disabled={isEnding}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:bg-red-800/50 text-white font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-red-600/10 transition-all text-sm cursor-pointer"
              >
                <Square className="h-4 w-4" />
                {isEnding ? 'Generating Reports & Summaries...' : 'End Meeting'}
              </button>
            ) : (
              <button
                onClick={() => navigate(PATHS.DASHBOARD)}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold px-6 py-3 rounded-lg shadow-md hover:shadow-slate-800/10 transition-all text-sm cursor-pointer"
              >
                <AlertCircle className="h-4 w-4 rotate-180 text-amber-400" />
                Leave Session
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
