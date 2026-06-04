import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Sparkles, Terminal, ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';

interface Message {
  id: string;
  sender_type: 'human' | 'agent';
  sender_name: string;
  content: string;
  created_at: string;
}

export function BrainstormHub({ caseId = '00000000-0000-0000-0000-000000000000' }: { caseId?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    // 1. Fetch initial messages
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('brainstorm_messages')
        .select(`
          id,
          content,
          created_at,
          workforce (
            name,
            type
          )
        `)
        .eq('case_id', caseId)
        .order('created_at', { ascending: true });

      if (data) {
        const formatted = data.map((m: any) => ({
          id: m.id,
          content: m.content,
          sender_name: m.workforce.name,
          sender_type: m.workforce.type,
          created_at: m.created_at
        }));
        setMessages(formatted);
      }
    };

    fetchMessages();

    // 2. Subscribe to new messages
    const channel = supabase
      .channel(`brainstorm:${caseId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'brainstorm_messages',
          filter: `case_id=eq.${caseId}`
        },
        async (payload) => {
          // Fetch the workforce details for the new message
          const { data: workforce } = await supabase
            .from('workforce')
            .select('name, type')
            .eq('id', payload.new.sender_id)
            .single();

          if (workforce) {
            const newMessage: Message = {
              id: payload.new.id,
              content: payload.new.content,
              sender_name: workforce.name,
              sender_type: workforce.type,
              created_at: payload.new.created_at
            };
            setMessages((prev) => [...prev, newMessage]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [caseId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !user) return;

    // Get the workforce ID for the current human user
    const { data: member } = await supabase
      .from('workforce')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!member) return;

    const { error } = await supabase
      .from('brainstorm_messages')
      .insert({
        case_id: caseId,
        sender_id: member.id,
        content: input
      });

    if (!error) {
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-indigo-500/10">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Collaboration Hub</h3>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Case: {caseId || 'GLOBAL_STRATEGY'}</p>
          </div>
        </div>
        <div className="flex gap-2">
           <div className="w-2 h-2 rounded-full bg-emerald-500" />
           <span className="text-[10px] font-bold text-slate-400 uppercase">3 Active</span>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/5 via-transparent to-transparent"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${msg.sender_type === 'human' ? 'items-end' : 'items-start'}`}
            >
              <div className={`flex items-center gap-2 mb-1.5 ${msg.sender_type === 'human' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-white scale-75 ${msg.sender_type === 'human' ? 'bg-amber-500 shadow-lg shadow-amber-500/20' : 'bg-indigo-500 shadow-lg shadow-indigo-500/20'}`}>
                  {msg.sender_type === 'human' ? <User size={12} /> : <Bot size={12} />}
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{msg.sender_name}</span>
                <span className="text-[9px] text-slate-600 font-mono">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed transition-all ${
                msg.sender_type === 'human' 
                  ? 'bg-indigo-600 text-white rounded-tr-none border border-indigo-500/50 shadow-lg shadow-indigo-600/10' 
                  : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700 shadow-xl'
              }`}>
                {msg.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {/* Agent thinking status can be integrated here */}
      </div>

      {/* Input Area */}
      <div className="p-6 bg-slate-900/80 border-t border-slate-800">
        <div className="relative group">
          <div className="absolute inset-0 bg-indigo-500/10 rounded-2xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message or command..."
            className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-4 pl-5 pr-14 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-all relative z-10 shadow-inner"
          />
          <button
            onClick={handleSend}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-colors z-20 shadow-lg shadow-indigo-500/30 active:scale-95"
          >
            <Send size={18} />
          </button>
        </div>
        <div className="flex items-center justify-between mt-4">
           <div className="flex gap-4">
              <button className="text-[10px] font-bold text-slate-500 uppercase hover:text-indigo-400 transition flex items-center gap-1">
                <Terminal size={12} /> Attach Case
              </button>
              <button className="text-[10px] font-bold text-slate-500 uppercase hover:text-indigo-400 transition flex items-center gap-1">
                <ShieldAlert size={12} /> Escalate
              </button>
           </div>
           <span className="text-[9px] text-slate-600 font-mono">End-to-End Encrypted</span>
        </div>
      </div>
    </div>
  );
}
