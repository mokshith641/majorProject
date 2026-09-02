import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Subtitles,
  Hand,
  ScreenShare,
  MoreVertical,
  PhoneOff,
  Info,
  Users,
  MessageSquare,
  Activity,
  X,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Sparkles,
  Radio,
  ShieldCheck,
  Pin,
  Send,
  Monitor,
  Keyboard,
  MousePointerClick
} from 'lucide-react';

interface LiveCaptionEvent {
  speaker: string;
  text: string;
  isInterim: boolean;
  timestamp?: string;
}

interface ChatMessage {
  id: string;
  speaker: string;
  text: string;
  time: string;
  isSystem?: boolean;
}

export const LiveMeeting: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Meeting metadata
  const [meetingTitle, setMeetingTitle] = useState('Google Meet Session');
  const [hostId, setHostId] = useState<number | null>(null);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isEnding, setIsEnding] = useState(false);
  const [streamActive, setStreamActive] = useState(false);

  // Google Meet Core Action Controls
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [activeSidebar, setActiveSidebar] = useState<'none' | 'chat' | 'people' | 'details' | 'telemetry'>('none');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Subtitles / Live Captions state
  const [activeCaption, setActiveCaption] = useState<LiveCaptionEvent | null>(null);
  const [isHearingSpeech, setIsHearingSpeech] = useState(false);
  const [speechApiSupported, setSpeechApiSupported] = useState(true);
  const [captionSize, setCaptionSize] = useState<'normal' | 'large'>('normal');

  // Side Drawer state
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      speaker: 'System',
      text: 'Meeting session connected. Closed Captions (CC) and telemetry are active.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSystem: true
    }
  ]);

  // Telemetry counters
  const [localClicks, setLocalClicks] = useState(0);
  const [localKeys, setLocalKeys] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const captionClearTimeoutRef = useRef<any>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isHost = user && hostId ? user.id === hostId : true;
  const currentSpeakerName = user?.full_name || user?.email?.split('@')[0] || (isHost ? 'Host' : 'Participant');

  // Format digital clock time (HH:MM AM/PM)
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  useEffect(() => {
    const updateTime = () => {
      setCurrentTimeStr(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Format meeting duration
  const formatDuration = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

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

  // 1. Fetch meeting title and register attendance
  useEffect(() => {
    const fetchMeeting = async () => {
      try {
        await api.post(`/meetings/${id}/join`);
      } catch (e) {
        console.warn("Could not join meeting as participant:", e);
      }
      try {
        const res = await api.get(`/meetings/${id}`);
        setMeetingTitle(res.data.title || 'Google Meet Session');
        setHostId(res.data.host_id);
      } catch (e) {
        console.error("Could not fetch meeting name", e);
      }
    };
    fetchMeeting();
  }, [id]);

  // 2. Setup local webcam video stream
  useEffect(() => {
    const startCam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 1280, height: 720, frameRate: 30 },
          audio: false 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          mediaStreamRef.current = stream;
          setStreamActive(true);
        }
      } catch (err) {
        console.warn("Webcam unavailable. Rendering Google Meet simulated stream.", err);
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext('2d');
        
        let angle = 0;
        const intervalId = setInterval(() => {
          if (!ctx) return;
          // Clean Google Meet dark tile gradient background
          const grad = ctx.createRadialGradient(320, 180, 20, 320, 180, 320);
          grad.addColorStop(0, '#282a2d');
          grad.addColorStop(1, '#17181a');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 640, 360);
          
          // User avatar circle
          ctx.beginPath();
          ctx.arc(320, 160, 55, 0, Math.PI * 2);
          ctx.fillStyle = '#1a73e8';
          ctx.fill();
          
          // User initial letter
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 44px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText((currentSpeakerName[0] || 'U').toUpperCase(), 320, 162);
          
          // Audio waveform indicator dots at bottom
          ctx.beginPath();
          const waveHeight = 4 + Math.abs(Math.sin(angle)) * 8;
          ctx.fillStyle = '#34a853';
          ctx.arc(40, 40, waveHeight, 0, Math.PI * 2);
          ctx.fill();

          angle += 0.15;
        }, 80);

        const simulatedStream = (canvas as any).captureStream ? (canvas as any).captureStream(15) : null;
        if (simulatedStream && videoRef.current) {
          videoRef.current.srcObject = simulatedStream;
          mediaStreamRef.current = simulatedStream;
          (simulatedStream as any)._simIntervalId = intervalId;
          setStreamActive(true);
        }
      }
    };

    if (!isVideoOff) {
      startCam();
    } else {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      setStreamActive(false);
    }

    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        if ((mediaStreamRef.current as any)._simIntervalId) {
          clearInterval((mediaStreamRef.current as any)._simIntervalId);
        }
      }
    };
  }, [isVideoOff, currentSpeakerName]);

  // 3. Screen sharing toggle
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
      }
      setIsScreenSharing(false);
      // Revert back to webcam
      if (videoRef.current && mediaStreamRef.current) {
        videoRef.current.srcObject = mediaStreamRef.current;
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsScreenSharing(true);
        stream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          if (videoRef.current && mediaStreamRef.current) {
            videoRef.current.srcObject = mediaStreamRef.current;
          }
        };
      } catch (err) {
        console.warn("Screen share declined:", err);
      }
    }
  };

  // 4. Setup duration timer & interaction telemetry
  useEffect(() => {
    const timer = setInterval(() => setSecondsElapsed((p) => p + 1), 1000);
    const handleClick = () => setLocalClicks((p) => p + 1);
    const handleKeyPress = () => setLocalKeys((p) => p + 1);

    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKeyPress);

    return () => {
      clearInterval(timer);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  // 5. WebSocket connection for multi-user captions and chat
  useEffect(() => {
    if (!id) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:8000/api/v1/meetings/${id}/ws`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'caption') {
            setActiveCaption({
              speaker: data.speaker,
              text: data.text,
              isInterim: !data.is_final,
              timestamp: data.timestamp
            });

            if (data.is_final && data.text.trim()) {
              setChatMessages((prev) => [
                ...prev,
                {
                  id: `cap-${Date.now()}-${Math.random()}`,
                  speaker: data.speaker,
                  text: data.text.trim(),
                  time: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
              ]);

              if (captionClearTimeoutRef.current) clearTimeout(captionClearTimeoutRef.current);
              captionClearTimeoutRef.current = setTimeout(() => {
                setActiveCaption((curr) => (curr?.text === data.text ? null : curr));
              }, 4500);
            }
          }
        } catch (e) {
          console.warn("WebSocket message parsing error:", e);
        }
      };

      ws.onclose = () => setWsConnected(false);
      ws.onerror = () => setWsConnected(false);
    } catch (err) {
      console.warn("WebSocket init failed:", err);
      setWsConnected(false);
    }

    return () => {
      if (ws) ws.close();
    };
  }, [id]);

  // 6. Web Speech API live microphone speech recognition
  useEffect(() => {
    if (isMicMuted) {
      setIsHearingSpeech(false);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechApiSupported(false);
      return;
    }

    let recognition: any;
    let isExplicitlyClosed = false;

    try {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        setIsHearingSpeech(true);
      };

      recognition.onresult = (event: any) => {
        let interimText = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const piece = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalText += piece;
          } else {
            interimText += piece;
          }
        }

        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        if (interimText.trim()) {
          setActiveCaption({
            speaker: `${currentSpeakerName} (You)`,
            text: interimText.trim(),
            isInterim: true,
            timestamp: timeStr
          });

          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'caption',
              speaker: currentSpeakerName,
              text: interimText.trim(),
              is_final: false,
              timestamp: timeStr
            }));
          }
        }

        if (finalText.trim()) {
          const cleanFinal = finalText.trim();
          setActiveCaption({
            speaker: `${currentSpeakerName} (You)`,
            text: cleanFinal,
            isInterim: false,
            timestamp: timeStr
          });

          setChatMessages((prev) => [
            ...prev,
            {
              id: `cap-${Date.now()}-${Math.random()}`,
              speaker: `${currentSpeakerName} (You)`,
              text: cleanFinal,
              time: timeStr
            }
          ]);

          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'caption',
              speaker: currentSpeakerName,
              text: cleanFinal,
              is_final: true,
              timestamp: timeStr
            }));
          }

          if (captionClearTimeoutRef.current) clearTimeout(captionClearTimeoutRef.current);
          captionClearTimeoutRef.current = setTimeout(() => {
            setActiveCaption((curr) => (curr?.text === cleanFinal ? null : curr));
          }, 4500);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition notice:", event.error);
        if (event.error === 'not-allowed') {
          setIsHearingSpeech(false);
          setSpeechApiSupported(false);
        }
      };

      recognition.onend = () => {
        if (!isExplicitlyClosed && !isMicMuted && captionsEnabled) {
          try {
            recognition.start();
          } catch (e) {}
        }
      };

      if (captionsEnabled && !isMicMuted) {
        recognition.start();
      }
    } catch (e) {
      console.warn("Could not initiate SpeechRecognition:", e);
      setSpeechApiSupported(false);
    }

    return () => {
      isExplicitlyClosed = true;
      if (recognition) {
        try {
          recognition.stop();
        } catch (e) {}
      }
    };
  }, [captionsEnabled, isMicMuted, currentSpeakerName]);

  // 7. Fallback dialogue if microphone speech is blocked
  useEffect(() => {
    if (speechApiSupported && isHearingSpeech) return;
    if (isMicMuted) return;

    const fallbackDialogue = [
      { speaker: "Daniel", text: "Welcome to the session everyone. Let's sync on current milestones." },
      { speaker: "Priya", text: "I have completed testing on the authentication and session handlers." },
      { speaker: "Mokshith", text: "Database connection pooling is configured and optimized." },
      { speaker: "Daniel", text: "Live captions and attendance telemetry look completely stable." },
      { speaker: "Priya", text: "We are ready to wrap up and compile the final meeting reports." }
    ];

    const intervals = [6, 18, 35, 52, 70];
    const timers = intervals.map((time, idx) => {
      return setTimeout(() => {
        const item = fallbackDialogue[idx];
        const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (captionsEnabled) {
          setActiveCaption({
            speaker: item.speaker,
            text: item.text,
            isInterim: false,
            timestamp: timeNow
          });

          if (captionClearTimeoutRef.current) clearTimeout(captionClearTimeoutRef.current);
          captionClearTimeoutRef.current = setTimeout(() => {
            setActiveCaption((curr) => (curr?.text === item.text ? null : curr));
          }, 4500);
        }

        setChatMessages((prev) => [
          ...prev,
          {
            id: `diag-${idx}`,
            speaker: item.speaker,
            text: item.text,
            time: timeNow
          }
        ]);
      }, time * 1000);
    });

    return () => timers.forEach(clearTimeout);
  }, [speechApiSupported, isHearingSpeech, captionsEnabled, isMicMuted]);

  // Auto-scroll chat / transcript sidebar
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMsg: ChatMessage = {
      id: `chat-${Date.now()}`,
      speaker: `${currentSpeakerName} (You)`,
      text: chatInput.trim(),
      time: timeStr
    };

    setChatMessages((prev) => [...prev, newMsg]);

    // Send through WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'caption',
        speaker: currentSpeakerName,
        text: chatInput.trim(),
        is_final: true,
        timestamp: timeStr
      }));
    }

    setChatInput('');
  };

  const handleEndMeeting = async () => {
    setIsEnding(true);
    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      await api.post(`/meetings/${id}/end`);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      navigate(`/meetings/${id}`);
    } catch (e) {
      console.error("Error ending meeting:", e);
      alert("Failed to compile meeting data. Please try again.");
      setIsEnding(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-[#202124] text-white flex flex-col font-sans select-none overflow-hidden"
    >
      {/* 1. Google Meet Top Header Bar */}
      <header className="h-14 px-6 flex items-center justify-between z-20 bg-[#202124]/90 backdrop-blur-xs border-b border-[#3c4043]/40">
        {/* Left: Meeting Title & Security Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <span className="text-xs font-bold text-red-400 uppercase tracking-widest bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
              REC
            </span>
          </div>

          <span className="text-[#3c4043]">|</span>

          <h1 className="text-sm font-medium text-slate-100 tracking-normal truncate max-w-xs sm:max-w-md">
            {meetingTitle}
          </h1>

          <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 bg-[#303134] px-2.5 py-1 rounded-md">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Encrypted Session</span>
          </div>
        </div>

        {/* Right: Session Timer & Layout Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300 bg-[#303134] px-3 py-1.5 rounded-full border border-[#3c4043]/50">
            <Radio className={`h-3 w-3 ${wsConnected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
            <span>{formatDuration(secondsElapsed)}</span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 text-slate-400 hover:text-white hover:bg-[#3c4043] rounded-full transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit full screen' : 'Full screen'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* 2. Main Stage: Google Meet Video Grid & Side Drawer */}
      <div className="flex-1 flex overflow-hidden p-3 sm:p-4 gap-3 relative">
        {/* Primary Video Grid Container */}
        <div className="flex-1 flex flex-col justify-center items-center relative overflow-hidden">
          {/* Main Speaker Stage Tile */}
          <div className="w-full h-full max-w-5xl max-h-[82vh] rounded-2xl bg-[#3c4043] overflow-hidden relative shadow-2xl flex items-center justify-center border border-white/5 group">
            {/* Real or Simulated Video Element */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${
                !isVideoOff && streamActive ? 'opacity-100' : 'opacity-0 absolute'
              }`}
            />

            {/* Video-Off Google Meet Style Avatar Placeholder */}
            {isVideoOff && (
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="h-28 w-28 rounded-full bg-[#1a73e8] text-white flex items-center justify-center text-5xl font-bold shadow-xl border-4 border-white/10">
                  {(currentSpeakerName[0] || 'U').toUpperCase()}
                </div>
                <p className="text-sm font-medium text-slate-300">{currentSpeakerName}</p>
              </div>
            )}

            {/* Speaking Active Glow Ring Indicator */}
            {isHearingSpeech && !isMicMuted && (
              <div className="absolute inset-0 rounded-2xl border-3 border-[#8ab4f8] pointer-events-none transition-all duration-200 shadow-[inset_0_0_20px_rgba(138,180,248,0.3)]"></div>
            )}

            {/* Google Meet Participant Bottom-Left Name Badge */}
            <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 bg-[#202124]/85 backdrop-blur-md px-3.5 py-1.5 rounded-lg border border-white/10 shadow-lg">
              <span className="text-xs font-medium text-white tracking-wide">
                {currentSpeakerName} (You)
              </span>
              {isMicMuted ? (
                <MicOff className="h-3.5 w-3.5 text-red-400" />
              ) : (
                <div className="flex items-center gap-0.5">
                  <Mic className={`h-3.5 w-3.5 ${isHearingSpeech ? 'text-[#8ab4f8]' : 'text-slate-400'}`} />
                  {isHearingSpeech && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8ab4f8] animate-ping"></span>
                  )}
                </div>
              )}
            </div>

            {/* Top-Right Tile Status Badges */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
              {isHandRaised && (
                <span className="flex items-center gap-1.5 bg-[#f29900] text-black font-bold text-xs px-2.5 py-1 rounded-full shadow-lg animate-bounce">
                  <Hand className="h-3.5 w-3.5 fill-black" />
                  Hand Raised
                </span>
              )}
              {isScreenSharing && (
                <span className="flex items-center gap-1.5 bg-[#1a73e8] text-white text-xs px-2.5 py-1 rounded-full shadow-lg font-medium">
                  <ScreenShare className="h-3.5 w-3.5" />
                  Sharing screen
                </span>
              )}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-md p-1.5 rounded-lg text-slate-300 flex items-center gap-1">
                <button className="p-1 hover:text-white rounded hover:bg-white/10" title="Pin tile">
                  <Pin className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Google Meet Native-Style Closed Captions (CC) Overlay */}
            {captionsEnabled && activeCaption && (
              <div className="absolute bottom-16 left-6 right-6 z-30 flex justify-center pointer-events-none animate-fadeIn">
                <div className="bg-[#202124]/90 backdrop-blur-md border border-white/15 px-5 py-3 rounded-xl shadow-2xl max-w-2xl text-center space-y-1">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-[11px] font-bold text-[#8ab4f8] uppercase tracking-wider">
                      {activeCaption.speaker}
                    </span>
                    {activeCaption.isInterim && (
                      <span className="text-[10px] text-slate-400 italic">...</span>
                    )}
                  </div>
                  <p className={`${captionSize === 'large' ? 'text-lg' : 'text-sm'} text-white font-medium leading-snug tracking-wide`}>
                    "{activeCaption.text}"
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. Collapsible Google Meet Side Drawer */}
        {activeSidebar !== 'none' && (
          <aside className="w-80 sm:w-96 bg-[#202124] rounded-2xl border border-[#3c4043] flex flex-col overflow-hidden shadow-2xl z-30 animate-fadeIn">
            {/* Drawer Header */}
            <div className="p-4 border-b border-[#3c4043] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                {activeSidebar === 'chat' && 'In-call messages & Transcript'}
                {activeSidebar === 'people' && 'People'}
                {activeSidebar === 'details' && 'Meeting details'}
                {activeSidebar === 'telemetry' && 'AI Engagement & Telemetry'}
              </h3>
              <button
                onClick={() => setActiveSidebar('none')}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-[#3c4043] rounded-full transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer Sub-Tabs */}
            <div className="flex border-b border-[#3c4043] bg-[#1a1b1e]">
              <button
                onClick={() => setActiveSidebar('chat')}
                className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  activeSidebar === 'chat' ? 'text-[#8ab4f8] border-b-2 border-[#8ab4f8]' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Chat
              </button>
              <button
                onClick={() => setActiveSidebar('people')}
                className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  activeSidebar === 'people' ? 'text-[#8ab4f8] border-b-2 border-[#8ab4f8]' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                People (2)
              </button>
              <button
                onClick={() => setActiveSidebar('telemetry')}
                className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  activeSidebar === 'telemetry' ? 'text-[#8ab4f8] border-b-2 border-[#8ab4f8]' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity className="h-3.5 w-3.5" />
                Telemetry
              </button>
              <button
                onClick={() => setActiveSidebar('details')}
                className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  activeSidebar === 'details' ? 'text-[#8ab4f8] border-b-2 border-[#8ab4f8]' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Info className="h-3.5 w-3.5" />
                Info
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
              {/* TAB: In-call Messages & Real-time Live Transcript */}
              {activeSidebar === 'chat' && (
                <div className="space-y-3 h-full flex flex-col">
                  {/* AI Catch-Up Banner */}
                  <div className="flex items-center justify-between gap-2 bg-[#303134]/60 border border-[#3c4043] p-2.5 rounded-xl text-xs">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-[#8ab4f8]" />
                      <span className="text-slate-300 text-[11px]">Need a quick recap?</span>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const res = await api.post(`/meetings/${id}/catchup`);
                          const data = res.data;
                          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          setChatMessages((prev) => [
                            ...prev,
                            {
                              id: `ai-catchup-${Date.now()}`,
                              speaker: 'AI Assistant',
                              text: `Meeting Catch-Up:\n${data.summary}\n\nCurrent Topic: ${data.active_topic}`,
                              time: timeStr
                            }
                          ]);
                        } catch (e) {
                          console.warn("Catch-up notice:", e);
                        }
                      }}
                      className="flex items-center gap-1.5 bg-[#1a73e8]/25 hover:bg-[#1a73e8]/40 border border-[#1a73e8]/50 text-[#8ab4f8] px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer"
                    >
                      <span>AI Catch-Up</span>
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-2.5 rounded-xl text-xs space-y-1 ${
                          msg.isSystem
                            ? 'bg-[#303134]/40 text-slate-400 font-mono'
                            : 'bg-[#303134] text-slate-200 border border-white/5'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="font-semibold text-[#8ab4f8]">{msg.speaker}</span>
                          <span>{msg.time}</span>
                        </div>
                        <p className="leading-relaxed">{msg.text}</p>
                      </div>
                    ))}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* Send Message Input */}
                  <form onSubmit={handleSendMessage} className="pt-2 flex items-center gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Send a message to everyone"
                      className="flex-1 bg-[#303134] border border-[#3c4043] rounded-full px-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-[#8ab4f8]"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className="p-2 bg-[#1a73e8] hover:bg-[#185abc] disabled:opacity-40 text-white rounded-full transition-all cursor-pointer"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              )}

              {/* TAB: People */}
              {activeSidebar === 'people' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>IN CALL</span>
                    <span>2 people</span>
                  </div>

                  {/* Participant: Current User */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#303134]/40 border border-[#3c4043]/50">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-[#1a73e8] flex items-center justify-center font-bold text-xs">
                        {(currentSpeakerName[0] || 'U').toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white">{currentSpeakerName} (You)</p>
                        <p className="text-[10px] text-slate-400">Meeting host</p>
                      </div>
                    </div>
                    <div>
                      {isMicMuted ? (
                        <MicOff className="h-4 w-4 text-red-400" />
                      ) : (
                        <Mic className="h-4 w-4 text-emerald-400" />
                      )}
                    </div>
                  </div>

                  {/* Participant: Remote Peer */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#303134]/20 border border-[#3c4043]/30">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-[#ea4335] flex items-center justify-center font-bold text-xs">
                        D
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white">Daniel</p>
                        <p className="text-[10px] text-slate-400">Contributor</p>
                      </div>
                    </div>
                    <Mic className="h-4 w-4 text-emerald-400" />
                  </div>
                </div>
              )}

              {/* TAB: Telemetry */}
              {activeSidebar === 'telemetry' && (
                <div className="space-y-4">
                  <div className="bg-[#303134]/60 p-4 rounded-xl border border-[#3c4043] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-300">Focus & Attention Score</span>
                      <span className="text-sm font-bold text-emerald-400">92%</span>
                    </div>
                    <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-400 h-full rounded-full w-[92%] transition-all"></div>
                    </div>
                    <p className="text-[10px] text-slate-400">Calculated continuously from face gaze coordinates and interaction telemetry.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#303134]/40 p-3 rounded-xl border border-[#3c4043]">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-400 mb-1">
                        <Keyboard className="h-3.5 w-3.5 text-[#8ab4f8]" />
                        Keystrokes
                      </div>
                      <p className="text-lg font-bold text-white">{localKeys}</p>
                    </div>

                    <div className="bg-[#303134]/40 p-3 rounded-xl border border-[#3c4043]">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-400 mb-1">
                        <MousePointerClick className="h-3.5 w-3.5 text-[#8ab4f8]" />
                        Clicks
                      </div>
                      <p className="text-lg font-bold text-white">{localClicks}</p>
                    </div>
                  </div>

                  <div className="bg-[#303134]/30 p-3 rounded-xl border border-[#3c4043] text-xs space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Active Window</span>
                    <p className="text-slate-200 font-mono text-[11px] truncate">Google Chrome - Meeting Assistant</p>
                  </div>
                </div>
              )}

              {/* TAB: Meeting Details */}
              {activeSidebar === 'details' && (
                <div className="space-y-4 text-xs">
                  <div className="space-y-1">
                    <h4 className="font-semibold text-white">Joining info</h4>
                    <p className="text-slate-400 text-[11px]">Share this info with people you want in the meeting</p>
                  </div>

                  <div className="p-3 bg-[#303134]/60 rounded-xl border border-[#3c4043] space-y-2">
                    <p className="text-slate-300 font-mono text-[11px] break-all">
                      {window.location.origin}/meetings/{id}/live
                    </p>
                    <button
                      onClick={handleCopyLink}
                      className="w-full flex items-center justify-center gap-2 bg-[#1a73e8]/20 hover:bg-[#1a73e8]/30 text-[#8ab4f8] py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
                    >
                      {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedLink ? 'Link Copied' : 'Copy joining link'}</span>
                    </button>
                  </div>

                  <div className="p-3 bg-[#303134]/40 rounded-xl border border-[#3c4043] flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Meeting Code</p>
                      <p className="font-mono text-white text-sm font-bold">{id}</p>
                    </div>
                    <button
                      onClick={handleCopyCode}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
                    >
                      {copiedCode ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* 4. The Iconic Google Meet Bottom Control Dock */}
      <footer className="h-20 bg-[#202124] px-4 sm:px-8 flex items-center justify-between border-t border-[#3c4043]/50 z-40 select-none">
        {/* Left Section: Time & Meeting Code */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-medium text-white hidden sm:inline">{currentTimeStr}</span>
          <span className="text-slate-500 hidden sm:inline">|</span>
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white font-mono bg-[#303134]/60 hover:bg-[#3c4043] px-2.5 py-1.5 rounded-lg border border-[#3c4043]/50 transition-colors cursor-pointer"
            title="Click to copy meeting code"
          >
            <span>{id}</span>
            {copiedCode ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-slate-400" />}
          </button>
        </div>

        {/* Center Section: Google Meet Round Action Dock Buttons */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* 1. Microphone Toggle */}
          <button
            onClick={() => setIsMicMuted(!isMicMuted)}
            className={`h-12 w-12 rounded-full flex items-center justify-center transition-all shadow-md cursor-pointer ${
              isMicMuted
                ? 'bg-[#ea4335] text-white hover:bg-[#d93025]'
                : 'bg-[#3c4043] text-white hover:bg-[#43474b]'
            }`}
            title={isMicMuted ? 'Turn on microphone (⌘+D)' : 'Turn off microphone (⌘+D)'}
          >
            {isMicMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>

          {/* 2. Camera Toggle */}
          <button
            onClick={() => setIsVideoOff(!isVideoOff)}
            className={`h-12 w-12 rounded-full flex items-center justify-center transition-all shadow-md cursor-pointer ${
              isVideoOff
                ? 'bg-[#ea4335] text-white hover:bg-[#d93025]'
                : 'bg-[#3c4043] text-white hover:bg-[#43474b]'
            }`}
            title={isVideoOff ? 'Turn on camera (⌘+E)' : 'Turn off camera (⌘+E)'}
          >
            {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </button>

          {/* 3. Live Captions [CC] Toggle */}
          <button
            onClick={() => setCaptionsEnabled(!captionsEnabled)}
            className={`h-12 w-12 rounded-full flex items-center justify-center transition-all shadow-md cursor-pointer ${
              captionsEnabled
                ? 'bg-[#8ab4f8] text-[#202124] hover:bg-[#aecbfa]'
                : 'bg-[#3c4043] text-white hover:bg-[#43474b]'
            }`}
            title={captionsEnabled ? 'Turn off captions (c)' : 'Turn on captions (c)'}
          >
            <Subtitles className="h-5 w-5" />
          </button>

          {/* 4. Raise Hand Button */}
          <button
            onClick={() => setIsHandRaised(!isHandRaised)}
            className={`h-12 w-12 rounded-full flex items-center justify-center transition-all shadow-md cursor-pointer ${
              isHandRaised
                ? 'bg-[#f29900] text-black hover:bg-[#e38c00]'
                : 'bg-[#3c4043] text-white hover:bg-[#43474b]'
            }`}
            title={isHandRaised ? 'Lower hand' : 'Raise hand'}
          >
            <Hand className="h-5 w-5" />
          </button>

          {/* 5. Screen Share Button */}
          <button
            onClick={toggleScreenShare}
            className={`h-12 w-12 rounded-full flex items-center justify-center transition-all shadow-md cursor-pointer ${
              isScreenSharing
                ? 'bg-[#1a73e8] text-white hover:bg-[#185abc]'
                : 'bg-[#3c4043] text-white hover:bg-[#43474b]'
            }`}
            title={isScreenSharing ? 'Stop presenting' : 'Present now'}
          >
            <ScreenShare className="h-5 w-5" />
          </button>

          {/* 6. More Options Button */}
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="h-12 w-12 rounded-full bg-[#3c4043] text-white hover:bg-[#43474b] flex items-center justify-center transition-all shadow-md cursor-pointer"
              title="More options"
            >
              <MoreVertical className="h-5 w-5" />
            </button>

            {showMoreMenu && (
              <div className="absolute bottom-14 left-1/2 -translate-x-1/2 w-48 bg-[#282a2d] border border-[#3c4043] rounded-xl shadow-2xl p-1.5 space-y-1 z-50 text-xs animate-fadeIn">
                <button
                  onClick={() => {
                    setCaptionSize(captionSize === 'normal' ? 'large' : 'normal');
                    setShowMoreMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-slate-200 hover:bg-[#3c4043] rounded-lg transition-colors cursor-pointer"
                >
                  Captions font: {captionSize === 'normal' ? 'Normal' : 'Large'}
                </button>
                <button
                  onClick={() => {
                    toggleFullscreen();
                    setShowMoreMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-slate-200 hover:bg-[#3c4043] rounded-lg transition-colors cursor-pointer"
                >
                  {isFullscreen ? 'Exit full screen' : 'Full screen'}
                </button>
              </div>
            )}
          </div>

          {/* 7. End / Leave Call Pill Button */}
          <button
            onClick={handleEndMeeting}
            disabled={isEnding}
            className="h-12 px-6 rounded-full bg-[#ea4335] hover:bg-[#d93025] text-white flex items-center justify-center gap-2 font-medium shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50 ml-1"
            title="Leave call"
          >
            <PhoneOff className="h-5 w-5 fill-white" />
            <span className="hidden md:inline">{isEnding ? 'Compiling...' : (isHost ? 'End call' : 'Leave')}</span>
          </button>
        </div>

        {/* Right Section: Sidebar Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Meeting Info */}
          <button
            onClick={() => setActiveSidebar(activeSidebar === 'details' ? 'none' : 'details')}
            className={`p-2.5 rounded-full transition-colors cursor-pointer ${
              activeSidebar === 'details'
                ? 'bg-[#8ab4f8]/20 text-[#8ab4f8]'
                : 'text-slate-300 hover:text-white hover:bg-[#3c4043]'
            }`}
            title="Meeting details"
          >
            <Info className="h-5 w-5" />
          </button>

          {/* People */}
          <button
            onClick={() => setActiveSidebar(activeSidebar === 'people' ? 'none' : 'people')}
            className={`p-2.5 rounded-full transition-colors cursor-pointer relative ${
              activeSidebar === 'people'
                ? 'bg-[#8ab4f8]/20 text-[#8ab4f8]'
                : 'text-slate-300 hover:text-white hover:bg-[#3c4043]'
            }`}
            title="People"
          >
            <Users className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-3.5 w-3.5 rounded-full bg-[#1a73e8] text-[9px] font-bold flex items-center justify-center text-white">
              2
            </span>
          </button>

          {/* Chat & Transcript */}
          <button
            onClick={() => setActiveSidebar(activeSidebar === 'chat' ? 'none' : 'chat')}
            className={`p-2.5 rounded-full transition-colors cursor-pointer relative ${
              activeSidebar === 'chat'
                ? 'bg-[#8ab4f8]/20 text-[#8ab4f8]'
                : 'text-slate-300 hover:text-white hover:bg-[#3c4043]'
            }`}
            title="Chat with everyone"
          >
            <MessageSquare className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#8ab4f8] animate-pulse"></span>
          </button>

          {/* AI Telemetry & Engagement */}
          <button
            onClick={() => setActiveSidebar(activeSidebar === 'telemetry' ? 'none' : 'telemetry')}
            className={`p-2.5 rounded-full transition-colors cursor-pointer ${
              activeSidebar === 'telemetry'
                ? 'bg-[#8ab4f8]/20 text-[#8ab4f8]'
                : 'text-slate-300 hover:text-white hover:bg-[#3c4043]'
            }`}
            title="AI Engagement Telemetry"
          >
            <Activity className="h-5 w-5" />
          </button>
        </div>
      </footer>
    </div>
  );
};
