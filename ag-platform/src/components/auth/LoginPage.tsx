import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Mail, Lock, Eye, EyeOff, ShieldCheck, Users, User, ArrowRight, Loader2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Role = 'admin' | 'staff' | 'applicant';

export function LoginPage() {
  const [role, setRole] = useState<Role>('applicant');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // In a real app, you'd check if the role matches the user's role in Supabase
      // For this demo, we'll just redirect based on the selected role
      if (data.user) {
        navigate(role === 'admin' ? '/admin' : role === 'staff' ? '/bank' : '/applicant');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  const roles: { id: Role; label: string; icon: any }[] = [
    { id: 'applicant', label: 'Applicant', icon: User },
    { id: 'staff', label: 'Staff', icon: Users },
    { id: 'admin', label: 'Admin', icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-500/10 rounded-full blur-[120px]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-20 pointer-events-none">
         <div className="w-full h-full" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #334155 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10"
      >
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-gradient-to-br from-amber-400 to-amber-600 p-3 rounded-2xl shadow-lg shadow-amber-500/20 mb-4">
            <Building2 className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-serif font-bold text-white tracking-tight">AG Associates</h1>
          <p className="text-slate-400 text-sm mt-1 uppercase tracking-[0.2em] font-mono">Legal & Home Loans</p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
          
          <div className="relative">
            <h2 className="text-2xl font-semibold text-white mb-6 text-center">Secure Portal Access</h2>

            {/* Role Selector */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              {roles.map((r) => {
                const Icon = r.icon;
                const isActive = role === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setRole(r.id)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-300",
                      isActive 
                        ? "bg-amber-500/10 border-amber-500/50 text-amber-500" 
                        : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600 hover:bg-slate-800"
                    )}
                  >
                    <Icon size={20} />
                    <span className="text-xs font-medium">{r.label}</span>
                    {isActive && (
                      <motion.div 
                        layoutId="activeRole"
                        className="absolute inset-0 rounded-xl border-2 border-amber-500 pointer-events-none"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300 ml-1">Username or Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-amber-500 transition-colors" size={18} />
                  <input 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-sm font-medium text-slate-300">Password</label>
                  <button type="button" className="text-xs text-amber-500 hover:text-amber-400 font-medium">Forgot Password?</button>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-amber-500 transition-colors" size={18} />
                  <input 
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3.5 pl-12 pr-12 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all"
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg p-3 text-center">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-2 ml-1">
                <input type="checkbox" className="rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500/20" id="remember" />
                <label htmlFor="remember" className="text-xs text-slate-400">Remember me</label>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-900 font-bold py-4 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 group"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    LOGIN TO YOUR ACCOUNT
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
              <Lock size={12} className="text-amber-500/50" />
              Protected by 256-bit SSL encryption. <span className="text-amber-500/50">Secure Access.</span>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
