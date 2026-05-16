import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Loader2, Play, CheckCircle2, AlertCircle, X, ChevronRight, BarChart3, Search } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function VyasaVoiceControl() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        await processVoiceCommand(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setTranscript(null);
      setResult(null);
      setError(null);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Microphone access denied or not available.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processVoiceCommand = async (audioBlob: Blob) => {
    setIsProcessing(true);
    const formData = new FormData();
    formData.append('file', audioBlob, 'command.wav');

    try {
      // Using relative path assuming proxy or absolute URL for backend
      const API_URL = import.meta.env.VITE_AI_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${API_URL}/voice/command`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to process voice command");

      const data = await response.json();
      setTranscript(data.transcript);
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden max-w-4xl mx-auto w-full">
      <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none">
        <BarChart3 size={120} className="text-cyan-500" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-2xl font-serif font-bold text-white mb-1">Vyasa AI Assistant</h2>
            <p className="text-slate-400 text-sm font-mono tracking-wider uppercase">Voice-to-Action Control</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700">
            <div className={cn("w-2 h-2 rounded-full", isProcessing ? "bg-amber-500 animate-pulse" : "bg-emerald-500")} />
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">System {isProcessing ? 'Busy' : 'Active'}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Central Voice Orb */}
          <div className="flex flex-col items-center justify-center space-y-8">
            <div className="relative group">
              <AnimatePresence>
                {isRecording && (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.5, opacity: 0.3 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="absolute inset-0 bg-cyan-500 rounded-full blur-3xl pointer-events-none"
                  />
                )}
              </AnimatePresence>
              
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                className={cn(
                  "relative w-48 h-48 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl",
                  isRecording 
                    ? "bg-cyan-500 scale-95 shadow-cyan-500/50" 
                    : "bg-gradient-to-br from-slate-800 to-slate-900 border-4 border-slate-700 hover:border-cyan-500/50"
                )}
              >
                <div className={cn(
                  "absolute inset-2 rounded-full border border-white/5",
                  isRecording && "animate-ping"
                )} />
                
                {isRecording ? (
                  <div className="flex flex-col items-center gap-2">
                    <Mic className="text-white animate-pulse" size={48} />
                    <span className="text-[10px] font-bold text-white tracking-widest uppercase">Listening</span>
                  </div>
                ) : isProcessing ? (
                  <Loader2 className="text-cyan-500 animate-spin" size={48} />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <MicOff className="text-slate-500 group-hover:text-cyan-400 transition-colors" size={48} />
                    <span className="text-[10px] font-bold text-slate-500 group-hover:text-cyan-400 tracking-widest uppercase">Hold to Speak</span>
                  </div>
                )}
              </button>
            </div>
            
            <div className="flex gap-4">
              <div className="flex flex-col items-center gap-1">
                <div className="w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                   <motion.div 
                    animate={isRecording ? { x: [-48, 48] } : { x: -48 }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="w-full h-full bg-cyan-500" 
                   />
                </div>
                <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">Audio Stream</span>
              </div>
            </div>
          </div>

          {/* Activity Feed / Results */}
          <div className="space-y-6">
            <div className="bg-slate-800/30 border border-slate-800 rounded-3xl p-6 min-h-[300px] flex flex-col">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800/50">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Search size={14} /> Command Analysis
                </h3>
                {result && <span className="text-[10px] text-emerald-500 font-mono">Success</span>}
              </div>

              <div className="flex-1 space-y-4">
                <AnimatePresence mode="wait">
                  {isRecording ? (
                    <motion.div 
                      key="listening"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-slate-400 italic text-sm animate-pulse"
                    >
                      "Say something like 'Vyasa, status of case MHR-123'..."
                    </motion.div>
                  ) : transcript ? (
                    <motion.div 
                      key="transcript"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-4"
                    >
                      <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                        <p className="text-slate-300 text-sm leading-relaxed">&ldquo;{transcript}&rdquo;</p>
                      </div>

                      {result?.routing && (
                        <div className="space-y-3">
                           <div className="flex items-center gap-3">
                              <div className="bg-cyan-500/10 p-2 rounded-lg">
                                <ChevronRight className="text-cyan-500" size={16} />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">Intent Detected</span>
                                <span className="text-sm font-medium text-white">{result.routing.tool || 'Unknown Action'}</span>
                              </div>
                           </div>

                           {result.execution && (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-2xl"
                              >
                                <div className="flex items-center gap-2 text-emerald-500 mb-2">
                                  <CheckCircle2 size={16} />
                                  <span className="text-xs font-bold uppercase tracking-wide">Execution Result</span>
                                </div>
                                <pre className="text-[10px] text-slate-400 font-mono overflow-auto max-h-32">
                                  {JSON.stringify(result.execution, null, 2)}
                                </pre>
                              </motion.div>
                           )}
                        </div>
                      )}
                    </motion.div>
                  ) : error ? (
                    <motion.div 
                      key="error"
                      className="flex flex-col items-center justify-center gap-3 text-red-400 h-full"
                    >
                      <AlertCircle size={32} />
                      <p className="text-xs text-center font-medium">{error}</p>
                    </motion.div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-4 text-slate-600 h-full">
                      <Mic size={48} className="opacity-20" />
                      <p className="text-xs text-center font-medium">Ready to process your next command.</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
