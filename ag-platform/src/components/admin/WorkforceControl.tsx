import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Bot, Activity, Plus, ClipboardList } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BrainstormHub } from './BrainstormHub';
import { supabase } from '../../lib/supabase';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface WorkforceMember {
  id: string;
  name: string;
  type: 'human' | 'agent';
  role: string;
  status: string;
  load_score: number;
}

export function WorkforceControl() {
  const [members, setMembers] = useState<WorkforceMember[]>([]);

  useEffect(() => {
    const fetchWorkforce = async () => {
      const { data } = await supabase
        .from('workforce')
        .select('*');
      
      if (data) {
        setMembers(data);
      }
    };

    fetchWorkforce();

    // Realtime subscription for status/load updates
    const channel = supabase
      .channel('workforce_status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workforce' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setMembers(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAssignTask = async (memberId: string) => {
    const description = prompt('Enter task description:');
    if (!description) return;

    const backendUrl = import.meta.env.VITE_AI_BACKEND_URL || 'http://localhost:8000';
    const adminKey = 'dev-admin-key-123'; // Replace with real key from store/env

    try {
      const response = await fetch(`${backendUrl}/workforce/tasks/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-voice-admin-key': adminKey
        },
        body: JSON.stringify({
          staff_id: memberId,
          description,
          priority: 'med'
        })
      });

      const result = await response.json();
      if (result.ok) {
        alert(result.message);
      } else {
        alert('Failed to assign task: ' + result.detail);
      }
    } catch (error) {
      console.error('Error assigning task:', error);
      alert('Error connecting to backend');
    }
  };

  const agents = members.filter(m => m.type === 'agent');
  const staff = members.filter(m => m.type === 'human');

  return (
    <div className="flex-1 p-8 bg-slate-50 min-h-screen">
      <header className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900">Unified Workforce Control</h1>
          <p className="text-slate-500 mt-1">Manage agentic and human staff from a single plane.</p>
        </div>
        <div className="flex gap-4">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm transition">
            <Activity size={18} /> System Health
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition">
            <Plus size={18} /> New Assignment
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Left: AI Agents */}
        <section className="xl:col-span-4 space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Bot size={18} className="text-indigo-500" /> AI Agents
            </h2>
            <span className="text-xs font-mono text-slate-400">{agents.length} ACTIVE</span>
          </div>
          {agents.map((agent) => (
            <div key={agent.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                    <Bot size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{agent.name}</h3>
                    <p className="text-xs text-slate-500 font-medium">{agent.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-tight">{agent.status}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500 font-medium">Task Load</span>
                    <span className="text-slate-900 font-bold">{agent.load_score}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${agent.load_score}%` }}
                      className={cn(
                        "h-full rounded-full",
                        agent.load_score > 80 ? "bg-amber-500" : "bg-indigo-500"
                      )}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-50">
                  <button 
                    onClick={() => handleAssignTask(agent.id)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition"
                  >
                    <ClipboardList size={14} /> Assign Task
                  </button>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Center: Brainstorm Hub */}
        <section className="xl:col-span-4 flex flex-col h-[800px]">
          <BrainstormHub />
        </section>

        {/* Right: Human Staff */}
        <section className="xl:col-span-4 space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Users size={18} className="text-amber-500" /> Human Staff
            </h2>
            <span className="text-xs font-mono text-slate-400">{staff.length} REGISTERED</span>
          </div>
          {staff.map((member) => (
            <div key={member.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100 overflow-hidden">
                    <img
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name}`}
                      alt={member.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{member.name}</h3>
                    <p className="text-xs text-slate-500 font-medium">{member.role}</p>
                  </div>
                </div>
                <div className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full",
                  member.status === 'online' ? "bg-emerald-50 border-emerald-100" : "bg-slate-100 border-slate-200"
                )}>
                  <div className={cn("w-1.5 h-1.5 rounded-full", member.status === 'online' ? "bg-emerald-500 animate-pulse" : "bg-slate-400")} />
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-tight",
                    member.status === 'online' ? "text-emerald-700" : "text-slate-500"
                  )}>{member.status}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleAssignTask(member.id)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition"
                  >
                    <ClipboardList size={12} /> Assign Task
                  </button>
                  <button className="flex-1 text-[10px] font-bold uppercase tracking-widest py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition">Message</button>
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
