'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scale,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Search,
  ExternalLink,
  ChevronRight,
  Shield,
  Camera,
  UserCheck,
  Cpu,
  Calculator,
  MessageSquare,
  Phone,
  ArrowUpRight,
  X,
  GripHorizontal,
} from 'lucide-react';

type PipelineStage = 'intake' | 'verification' | 'valuation' | 'filing' | 'acknowledged';
type EscalationTier = 1 | 2 | 3 | null;

interface NoiCase {
  id: string;
  bank: string;
  borrower: string;
  loanAmount: number;
  stage: PipelineStage;
  progress: number;
  grn: string | null;
  utr: string | null;
  createdAt: string;
  slaDeadline: string;
  escalation: EscalationTier;
  escalationReason: string | null;
  assignedAgent: string;
  priority: 'high' | 'medium' | 'low';
}

const PIPELINE_STAGES: { key: PipelineStage; label: string; icon: typeof Scale }[] = [
  { key: 'intake', label: 'Intake', icon: FileText },
  { key: 'verification', label: 'Verification', icon: UserCheck },
  { key: 'valuation', label: 'Valuation', icon: Calculator },
  { key: 'filing', label: 'Filing', icon: Cpu },
  { key: 'acknowledged', label: 'Acknowledged', icon: CheckCircle },
];

const AGENTS: Record<PipelineStage, string> = {
  intake: 'Aisha (Gatekeeper)',
  verification: 'Vyasa (Reader)',
  valuation: 'Auditor (Bouncer)',
  filing: 'Executor (RPA)',
  acknowledged: 'Sentinel (QC)',
};

const MOCK_CASES: NoiCase[] = [
  {
    id: 'KOTAK-NOI-2026-0042',
    bank: 'Kotak Mahindra',
    borrower: 'Rajesh Sharma',
    loanAmount: 4500000,
    stage: 'filing',
    progress: 72,
    grn: 'GRN-2026-0317-8842',
    utr: null,
    createdAt: '2026-04-28T09:15:00Z',
    slaDeadline: '2026-05-28T09:15:00Z',
    escalation: null,
    escalationReason: null,
    assignedAgent: 'Executor (RPA)',
    priority: 'high',
  },
  {
    id: 'AXIS-NOI-2026-0039',
    bank: 'Axis Finance',
    borrower: 'Priya Mehta',
    loanAmount: 12000000,
    stage: 'valuation',
    progress: 45,
    grn: null,
    utr: null,
    createdAt: '2026-04-30T11:30:00Z',
    slaDeadline: '2026-05-30T11:30:00Z',
    escalation: 2,
    escalationReason: 'PAN verification mismatch — name on PAN differs from Aadhaar',
    assignedAgent: 'Auditor (Bouncer)',
    priority: 'high',
  },
  {
    id: 'ICICI-NOI-2026-0045',
    bank: 'ICICI Bank',
    borrower: 'Vikram Patil',
    loanAmount: 7800000,
    stage: 'intake',
    progress: 18,
    grn: null,
    utr: null,
    createdAt: '2026-05-03T14:00:00Z',
    slaDeadline: '2026-06-02T14:00:00Z',
    escalation: null,
    escalationReason: null,
    assignedAgent: 'Aisha (Gatekeeper)',
    priority: 'medium',
  },
  {
    id: 'KVN-NOI-2026-0039',
    bank: 'Karur Vysya',
    borrower: 'Sunil Jadhav',
    loanAmount: 2500000,
    stage: 'intake',
    progress: 8,
    grn: null,
    utr: null,
    createdAt: '2026-05-04T16:45:00Z',
    slaDeadline: '2026-06-03T16:45:00Z',
    escalation: 1,
    escalationReason: 'Missing Index II document — auto-follow-up sent via WhatsApp',
    assignedAgent: 'Aisha (Gatekeeper)',
    priority: 'low',
  },
  {
    id: 'MUTHOOT-NOI-2026-0039',
    bank: 'Muthoot Homefin',
    borrower: 'Anita Deshmukh',
    loanAmount: 3500000,
    stage: 'acknowledged',
    progress: 100,
    grn: 'GRN-2026-0312-5521',
    utr: 'HDFC250426003912',
    createdAt: '2026-04-20T10:00:00Z',
    slaDeadline: '2026-05-20T10:00:00Z',
    escalation: null,
    escalationReason: null,
    assignedAgent: 'Sentinel (QC)',
    priority: 'low',
  },
  {
    id: 'AXIS-NOI-2026-0041',
    bank: 'Axis Finance',
    borrower: 'Rohit Khandelwal',
    loanAmount: 9500000,
    stage: 'verification',
    progress: 34,
    grn: null,
    utr: null,
    createdAt: '2026-05-02T08:30:00Z',
    slaDeadline: '2026-06-01T08:30:00Z',
    escalation: null,
    escalationReason: null,
    assignedAgent: 'Vyasa (Reader)',
    priority: 'medium',
  },
];

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  const deadline = new Date(dateStr);
  return Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

function CaseCard({ caseData, selected, onSelect }: { caseData: NoiCase; selected: boolean; onSelect: () => void }) {
  const stageIndex = PIPELINE_STAGES.findIndex(s => s.key === caseData.stage);
  const slaDays = daysUntil(caseData.slaDeadline);
  const isUrgent = slaDays <= 7;
  const isWarning = slaDays <= 14 && slaDays > 7;
  const isComplete = caseData.stage === 'acknowledged';

  return (
    <motion.button
      variants={item}
      onClick={onSelect}
      className={`w-full text-left glass-gold glass-gold-hover rounded-xl p-5 transition-all duration-300 ${
        selected
          ? 'border-gold/40 glow-gold'
          : 'border-transparent'
      } ${isUrgent ? 'border-red-500/20' : ''}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-2 h-2 rounded-full ${
            isComplete ? 'bg-gold' : isUrgent ? 'bg-red-400' : isWarning ? 'bg-amber-400' : 'bg-gold/50'
          }`} />
          <span className="text-xs font-mono text-gold-muted">{caseData.id}</span>
        </div>
        <div className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${
          caseData.bank === 'Kotak Mahindra' ? 'bg-blue-500/10 text-blue-300' :
          caseData.bank === 'Axis Finance' ? 'bg-red-500/10 text-red-300' :
          caseData.bank === 'ICICI Bank' ? 'bg-purple-500/10 text-purple-300' :
          caseData.bank === 'Karur Vysya' ? 'bg-emerald-500/10 text-emerald-300' :
          'bg-amber-500/10 text-amber-300'
        }`}>
          {caseData.bank}
        </div>
      </div>

      <h3 className="text-white font-medium text-base mb-1 font-display">{caseData.borrower}</h3>
      <p className="text-gray-500 text-xs mb-3">{formatCurrency(caseData.loanAmount)}</p>

      <div className="mb-3">
        <div className="flex justify-between text-[10px] font-mono text-gray-500 mb-1">
          <span>{PIPELINE_STAGES[stageIndex]?.label}</span>
          <span>{caseData.progress}%</span>
        </div>
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${caseData.progress}%` }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className={`h-full rounded-full ${
              isComplete ? 'bg-gold' : isUrgent ? 'bg-red-400' : 'bg-gold/60'
            }`}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Clock className={`w-3 h-3 ${isUrgent ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-gray-500'}`} />
          <span className={`text-xs font-mono ${
            isUrgent ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-gray-500'
          }`}>
            {slaDays}d remaining
          </span>
        </div>
        {caseData.escalation && (
          <div className={`flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded ${
            caseData.escalation === 3 ? 'bg-red-500/15 text-red-400' :
            caseData.escalation === 2 ? 'bg-amber-500/15 text-amber-400' :
            'bg-blue-500/10 text-blue-300'
          }`}>
            <AlertTriangle className="w-2.5 h-2.5" />
            T{caseData.escalation}
          </div>
        )}
        {caseData.grn && (
          <span className="text-[10px] font-mono text-gold/60">GRN ✓</span>
        )}
      </div>
    </motion.button>
  );
}

function StageIndicator({ current, stage }: { current: PipelineStage; stage: typeof PIPELINE_STAGES[0] }) {
  const stageIndex = PIPELINE_STAGES.findIndex(s => s.key === current);
  const thisIndex = PIPELINE_STAGES.findIndex(s => s.key === stage.key);
  const isComplete = thisIndex < stageIndex;
  const isActive = thisIndex === stageIndex;
  const Icon = stage.icon;

  return (
    <div className="flex items-center gap-3">
      <div className={`relative flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500 ${
        isComplete ? 'bg-gold/20 border border-gold/40' :
        isActive ? 'bg-gold/10 border border-gold/50 shadow-[0_0_12px_rgba(201,168,76,0.2)]' :
        'bg-white/[0.03] border border-white/[0.06]'
      }`}>
        <Icon className={`w-4 h-4 ${
          isComplete ? 'text-gold' :
          isActive ? 'text-gold-light' :
          'text-gray-600'
        }`} />
        {isActive && (
          <motion.span
            layoutId="active-pulse"
            className="absolute inset-0 rounded-full border border-gold/30"
            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium ${isComplete ? 'text-gold' : isActive ? 'text-white' : 'text-gray-500'}`}>
          {stage.label}
        </p>
        <p className="text-[10px] font-mono text-gray-600 truncate">
          {AGENTS[stage.key]}
        </p>
      </div>
      {isComplete && <CheckCircle className="w-3.5 h-3.5 text-gold flex-shrink-0" />}
    </div>
  );
}

function SLACountdown({ deadline, createdAt }: { deadline: string; createdAt: string }) {
  const [now, setNow] = useState(new Date());
  const slaDays = daysUntil(deadline);
  const totalDays = Math.ceil((new Date(deadline).getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
  const elapsed = totalDays - slaDays;
  const pct = Math.min(100, Math.max(0, (elapsed / totalDays) * 100));
  const isUrgent = slaDays <= 7;
  const isWarning = slaDays <= 14 && slaDays > 7;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="glass-gold rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className={`w-4 h-4 ${isUrgent ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-gold'}`} />
          <span className="text-xs font-medium text-gray-400">Section 89B SLA</span>
        </div>
        <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${
          isUrgent ? 'bg-red-500/15 text-red-400' :
          isWarning ? 'bg-amber-500/15 text-amber-400' :
          'bg-gold/10 text-gold'
        }`}>
          {isUrgent ? 'Critical' : isWarning ? 'Warning' : 'On Track'}
        </span>
      </div>

      <div className="text-center mb-4">
        <motion.span
          key={slaDays}
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`text-4xl font-display font-bold ${isUrgent ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-gold'}`}
        >
          {slaDays}
        </motion.span>
        <p className="text-gray-500 text-xs mt-1">days remaining of {totalDays}</p>
      </div>

      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
          className={`h-full rounded-full ${isUrgent ? 'bg-red-400' : isWarning ? 'bg-amber-400' : 'bg-gold/60'}`}
        />
      </div>
    </div>
  );
}

function EscalationMatrix({ cases }: { cases: NoiCase[] }) {
  const tiers = [
    {
      tier: 1,
      label: 'Auto-Resolution',
      icon: MessageSquare,
      desc: 'Missing documents, blurry photos — AI auto-messages client via WhatsApp',
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      cases: cases.filter(c => c.escalation === 1),
    },
    {
      tier: 2,
      label: 'Dashboard Flag',
      icon: Shield,
      desc: 'Name mismatch, API timeout — flagged as NEEDS_REVIEW',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      cases: cases.filter(c => c.escalation === 2),
    },
    {
      tier: 3,
      label: 'Critical Escalation',
      icon: Phone,
      desc: 'Stamp duty mismatch, 30-day SLA breach risk — WhatsApp alert to founder',
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      cases: cases.filter(c => c.escalation === 3),
    },
  ];

  return (
    <div className="glass-gold rounded-xl p-5">
      <div className="flex items-center gap-2 mb-5">
        <AlertTriangle className="w-4 h-4 text-gold" />
        <h3 className="text-white font-display text-base">3-Tier Escalation Matrix</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {tiers.map(t => (
          <div key={t.tier} className={`${t.bg} ${t.border} border rounded-lg p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <t.icon className={`w-4 h-4 ${t.color}`} />
              <span className={`text-xs font-medium ${t.color}`}>Tier {t.tier}</span>
            </div>
            <p className="text-white font-medium text-sm mb-1">{t.label}</p>
            <p className="text-gray-500 text-[11px] leading-relaxed mb-3">{t.desc}</p>
            <div className="flex items-center gap-1.5">
              <span className={`text-lg font-display font-bold ${t.color}`}>{t.cases.length}</span>
              <span className="text-gray-600 text-[10px]">active</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NoiCasesPage() {
  const [cases] = useState<NoiCase[]>(MOCK_CASES);
  const [selectedId, setSelectedId] = useState<string>(cases[0]?.id ?? '');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBank, setFilterBank] = useState<string>('all');
  const [filterStage, setFilterStage] = useState<PipelineStage | 'all'>('all');

  const selected = cases.find(c => c.id === selectedId) ?? cases[0];
  const filtered = cases.filter(c => {
    if (filterBank !== 'all' && c.bank !== filterBank) return false;
    if (filterStage !== 'all' && c.stage !== filterStage) return false;
    if (searchQuery && !c.borrower.toLowerCase().includes(searchQuery.toLowerCase()) && !c.id.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const banks = [...new Set(cases.map(c => c.bank))];

  return (
    <div className="min-h-screen bg-black noise-overlay">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-48 -right-48 w-[600px] h-[600px] orb-gold opacity-40" />
        <div className="absolute -bottom-48 -left-48 w-[500px] h-[500px] orb-gold opacity-30" />
      </div>

      <div className="relative z-10 max-w-[1440px] mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-start justify-between mb-10"
        >
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center">
                <Scale className="w-5 h-5 text-gold" />
              </div>
              <div>
                <h1 className="text-2xl font-display text-white tracking-tight">
                  NOI Pipeline
                </h1>
                <p className="text-gray-500 text-xs font-mono">
                  Notice of Intimation · Section 89B Registration Act
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="w-1.5 h-1.5 rounded-full bg-gold/60" />
              {cases.filter(c => c.stage !== 'acknowledged').length} active
            </div>
            <div className="h-6 w-px bg-white/[0.06]" />
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60" />
              {cases.filter(c => c.stage === 'acknowledged').length} filed
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex items-center gap-3 flex-wrap"
            >
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search borrower or case ID..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gold/30 focus:shadow-[0_0_0_3px_rgba(201,168,76,0.06)] transition-all"
                />
              </div>
              <select
                value={filterBank}
                onChange={e => setFilterBank(e.target.value)}
                className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-gray-400 focus:outline-none focus:border-gold/30"
              >
                <option value="all">All Banks</option>
                {banks.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <select
                value={filterStage}
                onChange={e => setFilterStage(e.target.value as PipelineStage | 'all')}
                className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-gray-400 focus:outline-none focus:border-gold/30"
              >
                <option value="all">All Stages</option>
                {PIPELINE_STAGES.map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </motion.div>

            <motion.div
              variants={container}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {filtered.length === 0 ? (
                <div className="glass-gold rounded-xl p-10 text-center">
                  <Search className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No cases match your filters</p>
                </div>
              ) : (
                filtered.map(c => (
                  <CaseCard
                    key={c.id}
                    caseData={c}
                    selected={c.id === selectedId}
                    onSelect={() => setSelectedId(c.id)}
                  />
                ))
              )}
            </motion.div>
          </div>

          <div className="space-y-4">
            <AnimatePresence mode="wait">
              {selected && (
                <motion.div
                  key={selected.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="sticky top-8 space-y-4"
                >
                  <div className="glass-gold-strong rounded-xl p-5 liquid-edge">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-[10px] font-mono text-gold/60 uppercase tracking-widest mb-1">
                          Case Details
                        </p>
                        <h2 className="text-white font-display text-lg leading-tight">{selected.borrower}</h2>
                        <p className="text-gray-500 text-xs font-mono mt-0.5">{selected.id}</p>
                      </div>
                      <div className={`px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider ${
                        selected.priority === 'high' ? 'bg-red-500/10 text-red-400' :
                        selected.priority === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-blue-500/10 text-blue-300'
                      }`}>
                        {selected.priority}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <div className="bg-white/[0.02] rounded-lg p-3">
                        <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mb-1">Bank</p>
                        <p className="text-white text-sm">{selected.bank}</p>
                      </div>
                      <div className="bg-white/[0.02] rounded-lg p-3">
                        <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mb-1">Loan</p>
                        <p className="text-white text-sm">{formatCurrency(selected.loanAmount)}</p>
                      </div>
                      <div className="bg-white/[0.02] rounded-lg p-3">
                        <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mb-1">Created</p>
                        <p className="text-white text-sm">{formatDate(selected.createdAt)}</p>
                      </div>
                      <div className="bg-white/[0.02] rounded-lg p-3">
                        <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mb-1">Agent</p>
                        <p className="text-white text-sm truncate">{selected.assignedAgent}</p>
                      </div>
                    </div>

                    {selected.grn && (
                      <div className="bg-gold/5 border border-gold/10 rounded-lg px-4 py-3 mb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">GRN</p>
                            <p className="text-gold text-sm font-mono mt-0.5">{selected.grn}</p>
                          </div>
                          <CheckCircle className="w-4 h-4 text-gold" />
                        </div>
                        {selected.utr && (
                          <div className="mt-2 pt-2 border-t border-gold/10">
                            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">UTR</p>
                            <p className="text-white text-sm font-mono mt-0.5">{selected.utr}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {selected.escalation && (
                      <div className={`rounded-lg px-4 py-3 mb-4 ${
                        selected.escalation === 3 ? 'bg-red-500/10 border border-red-500/20' :
                        selected.escalation === 2 ? 'bg-amber-500/10 border border-amber-500/20' :
                        'bg-blue-500/10 border border-blue-500/20'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className={`w-3.5 h-3.5 ${
                            selected.escalation === 3 ? 'text-red-400' :
                            selected.escalation === 2 ? 'text-amber-400' : 'text-blue-300'
                          }`} />
                          <span className={`text-[10px] font-mono uppercase tracking-wider ${
                            selected.escalation === 3 ? 'text-red-400' :
                            selected.escalation === 2 ? 'text-amber-400' : 'text-blue-300'
                          }`}>
                            Tier {selected.escalation} Escalation
                          </span>
                        </div>
                        <p className="text-gray-400 text-xs">{selected.escalationReason}</p>
                      </div>
                    )}

                    <div className="space-y-1">
                      {PIPELINE_STAGES.map(s => (
                        <StageIndicator key={s.key} current={selected.stage} stage={s} />
                      ))}
                    </div>
                  </div>

                  <SLACountdown deadline={selected.slaDeadline} createdAt={selected.createdAt} />

                  <EscalationMatrix cases={cases} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
