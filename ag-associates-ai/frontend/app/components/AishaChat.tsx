'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Send,
  Bot,
  User,
  X,
  Loader2,
  ChevronDown,
  Trash2,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

interface AishaResponse {
  conversation_id: string;
  user_id: string;
  response: string;
  intent: string;
  data?: Record<string, unknown>;
}

interface AishaChatProps {
  onClose?: () => void;
  embedded?: boolean;
}

export default function AishaChat({ onClose, embedded }: AishaChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [streamConnected, setStreamConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<EventSource | null>(null);
  const lastMessageIdRef = useRef(0);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, []);

  const handleScroll = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setShowScrollBtn(!atBottom);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const connectStream = useCallback((convId: string) => {
    if (streamRef.current) {
      streamRef.current.close();
    }

    const es = new EventSource(
      `${API_BASE_URL}/api/aisha/chat/${convId}/stream?after_id=${lastMessageIdRef.current}`
    );

    es.onopen = () => setStreamConnected(true);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const msg: Message = {
          id: data.id,
          role: data.role,
          content: data.content,
        };
        if (data.id > lastMessageIdRef.current) {
          lastMessageIdRef.current = data.id;
        }
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === msg.id);
          return exists ? prev : [...prev, msg];
        });
      } catch {
        // ignore parse errors on keepalive comments
      }
    };

    es.onerror = () => {
      setStreamConnected(false);
      setTimeout(() => {
        if (conversationId) connectStream(conversationId);
      }, 3000);
    };

    streamRef.current = es;
  }, [conversationId]);

  useEffect(() => {
    if (conversationId) {
      connectStream(conversationId);
    }
    return () => {
      streamRef.current?.close();
    };
  }, [conversationId, connectStream]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput('');
    setSending(true);
    setError(null);

    const tempId = Date.now();
    const optimistic: Message = {
      id: tempId,
      role: 'user',
      content: text,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(`${API_BASE_URL}/api/aisha/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversation_id: conversationId,
          platform: 'web',
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const data: AishaResponse = await res.json();

      if (!conversationId && data.conversation_id) {
        setConversationId(data.conversation_id);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to send message';
      setError(errMsg);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    streamRef.current?.close();
    setMessages([]);
    setConversationId(null);
    lastMessageIdRef.current = 0;
    setError(null);
  };

  const containerClasses = embedded
    ? 'flex flex-col h-full'
    : 'fixed bottom-6 right-6 w-[420px] h-[640px] flex flex-col glass-strong rounded-2xl shadow-2xl z-50';

  return (
    <motion.div
      initial={embedded ? false : { opacity: 0, scale: 0.9, y: 20 }}
      animate={embedded ? undefined : { opacity: 1, scale: 1, y: 0 }}
      exit={embedded ? undefined : { opacity: 0, scale: 0.9, y: 20 }}
      className={containerClasses}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-accent-purple/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-accent-purple" />
            </div>
            <div
              className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-dark-bg ${
                streamConnected ? 'bg-accent-green' : 'bg-gray-500'
              }`}
            />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm leading-tight">Aisha</h3>
            <p className="text-gray-500 text-xs leading-tight">
              {streamConnected ? 'Online' : 'Connecting...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearChat}
            className="p-2 rounded-lg hover:bg-white/[0.06] text-gray-500 hover:text-gray-300 transition-colors"
            title="Clear conversation"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/[0.06] text-gray-500 hover:text-gray-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth"
      >
        {messages.length === 0 && !sending && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-accent-purple/10 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-accent-purple" />
            </div>
            <h4 className="text-white font-semibold mb-2">Chat with Aisha</h4>
            <p className="text-gray-500 text-sm leading-relaxed">
              Ask me about case status, draft legal documents, check NOI progress,
              or get help with firm operations.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-2 w-full max-w-[280px]">
              {[
                'What is the status of my cases?',
                'Draft a rental agreement',
                'Generate a GRAS challan',
                'Show recent activities',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                  }}
                  className="text-left text-sm text-gray-400 hover:text-white p-3 rounded-xl glass hover:bg-white/[0.08] transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={msg.id || i}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${
                  msg.role === 'user'
                    ? 'bg-accent-blue/20'
                    : 'bg-accent-purple/20'
                }`}
              >
                {msg.role === 'user' ? (
                  <User className="w-4 h-4 text-accent-blue" />
                ) : (
                  <Bot className="w-4 h-4 text-accent-purple" />
                )}
              </div>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-accent-blue/10 text-white border border-accent-blue/20'
                    : 'glass text-gray-200'
                }`}
              >
                {msg.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {sending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-lg bg-accent-purple/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-accent-purple" />
            </div>
            <div className="glass rounded-2xl px-4 py-3">
              <div className="flex gap-1.5">
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
                  className="w-2 h-2 rounded-full bg-accent-purple"
                />
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
                  className="w-2 h-2 rounded-full bg-accent-purple"
                />
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
                  className="w-2 h-2 rounded-full bg-accent-purple"
                />
              </div>
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20"
          >
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollBtn && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => scrollToBottom()}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 p-2 rounded-full glass-strong hover:bg-white/[0.12] transition-colors"
          >
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="shrink-0 border-t border-white/[0.06] p-4">
        <div className="flex items-end gap-2 glass rounded-xl p-1.5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Aisha..."
            rows={1}
            className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm px-3 py-2 outline-none resize-none max-h-32"
            style={{ fieldSizing: 'content' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="p-2.5 rounded-lg bg-accent-blue hover:bg-accent-blue/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-white" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-gray-600 text-center mt-2">
          Powered by AG Associates AI
        </p>
      </div>
    </motion.div>
  );
}
