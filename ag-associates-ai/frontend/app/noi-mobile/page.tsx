'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderClosed,
  Camera,
  Activity,
  Settings,
  ChevronRight,
  Scan,
  Upload,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Wifi,
  WifiOff,
  X,
  ArrowLeft,
  FileText,
  MapPin,
  User,
  LogOut,
  RefreshCw,
  Circle,
  Download,
} from 'lucide-react';

type Tab = 'cases' | 'scanner' | 'activity' | 'settings';
type CaseStatus = 'pending' | 'verified' | 'filing' | 'complete' | 'escalated';
type EscalationTier = 1 | 2 | 3 | null;

interface MobileCase {
  id: string;
  shortId: string;
  bank: string;
  borrower: string;
  property: string;
  amount: number;
  status: CaseStatus;
  progress: number;
  escalation: EscalationTier;
  slaDays: number;
  pendingDocuments: string[];
  assignedAt: string;
}

const MOCK_MOBILE_CASES: MobileCase[] = [
  { id: 'KOTAK-NOI-2026-0042', shortId: 'KTK-042', bank: 'Kotak Mahindra', borrower: 'Rajesh Sharma', property: 'Flat 302, Vasant Vihar, Thane W', amount: 4500000, status: 'filing', progress: 72, escalation: null, slaDays: 23, pendingDocuments: [], assignedAt: '2026-04-28' },
  { id: 'AXIS-NOI-2026-0039', shortId: 'AXS-039', bank: 'Axis Finance', borrower: 'Priya Mehta', property: 'Bungalow 15, Hiranandani Estate', amount: 12000000, status: 'escalated', progress: 45, escalation: 2, slaDays: 26, pendingDocuments: ['PAN Card', 'Index II'], assignedAt: '2026-04-30' },
  { id: 'ICICI-NOI-2026-0045', shortId: 'ICI-045', bank: 'ICICI Bank', borrower: 'Vikram Patil', property: 'Shop 5, Galaxy Arcade, Thane', amount: 7800000, status: 'pending', progress: 18, escalation: null, slaDays: 28, pendingDocuments: ['Bank Statement', 'Property Card', 'ID Proof'], assignedAt: '2026-05-03' },
  { id: 'KVN-NOI-2026-0038', shortId: 'KVN-038', bank: 'Karur Vysya', borrower: 'Sunil Jadhav', property: 'Plot 45, Wagle Estate', amount: 2500000, status: 'pending', progress: 8, escalation: 1, slaDays: 29, pendingDocuments: ['Index II', 'Selfie'], assignedAt: '2026-05-04' },
  { id: 'MUTHOOT-NOI-2026-0037', shortId: 'MUT-037', bank: 'Muthoot Homefin', borrower: 'Anita Deshmukh', property: 'Flat 201, Lake Gardens', amount: 3500000, status: 'complete', progress: 100, escalation: null, slaDays: 16, pendingDocuments: [], assignedAt: '2026-04-20' },
  { id: 'AXIS-NOI-2026-0041', shortId: 'AXS-041', bank: 'Axis Finance', borrower: 'Rohit Khandelwal', property: 'Office 7, Corporate Park', amount: 9500000, status: 'verified', progress: 34, escalation: null, slaDays: 27, pendingDocuments: ['Property Card'], assignedAt: '2026-05-02' },
];

const STATUS_CONFIG: Record<CaseStatus, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending: { label: 'Pending', color: 'text-gray-400', bg: 'bg-gray-500/10', icon: Clock },
  verified: { label: 'Verified', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: CheckCircle2 },
  filing: { label: 'Filing', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Upload },
  complete: { label: 'Complete', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
  escalated: { label: 'Escalated', color: 'text-red-400', bg: 'bg-red-500/10', icon: AlertTriangle },
};

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function TabBar({ active, onTab }: { active: Tab; onTab: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string; icon: typeof FolderClosed }[] = [
    { key: 'cases', label: 'Cases', icon: FolderClosed },
    { key: 'scanner', label: 'Scan', icon: Camera },
    { key: 'activity', label: 'Activity', icon: Activity },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-2xl border-t border-white/[0.06] pb-safe">
      <div className="flex items-center justify-around px-2 pt-2 pb-1">
        {tabs.map(t => {
          const isActive = active === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => onTab(t.key)}
              className="flex flex-col items-center gap-0.5 py-1 px-3 min-w-[64px] touch-manipulation"
            >
              <div className={`p-1.5 rounded-xl transition-all duration-300 ${
                isActive ? 'bg-gold/10' : ''
              }`}>
                <Icon className={`w-5 h-5 transition-colors duration-300 ${
                  isActive ? 'text-gold' : 'text-gray-600'
                }`} />
              </div>
              <span className={`text-[10px] font-medium transition-colors duration-300 ${
                isActive ? 'text-gold' : 'text-gray-600'
              }`}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function CasesTab() {
  const [cases, setCases] = useState(MOCK_MOBILE_CASES);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCase, setSelectedCase] = useState<MobileCase | null>(null);
  const [filter, setFilter] = useState<CaseStatus | 'all'>('all');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 1200));
    setRefreshing(false);
  }, []);

  const filtered = filter === 'all' ? cases : cases.filter(c => c.status === filter);
  const pending = cases.filter(c => c.status === 'pending' || c.status === 'verified' || c.status === 'filing').length;

  const statusFilters: { key: CaseStatus | 'all'; label: string }[] = [
    { key: 'all', label: `All (${cases.length})` },
    { key: 'pending', label: `Pending (${cases.filter(c => c.status === 'pending').length})` },
    { key: 'verified', label: `Verified (${cases.filter(c => c.status === 'verified').length})` },
    { key: 'escalated', label: `Esc (${cases.filter(c => c.status === 'escalated').length})` },
  ];

  if (selectedCase) {
    const c = selectedCase;
    const cfg = STATUS_CONFIG[c.status];
    const Icon = cfg.icon;

    return (
      <div className="pb-24">
        <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-xl border-b border-white/[0.06]">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={() => setSelectedCase(null)} className="p-2 -ml-2 touch-manipulation">
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{c.borrower}</p>
              <p className="text-gray-500 text-[11px] font-mono truncate">{c.id}</p>
            </div>
            <div className={`px-2.5 py-1 rounded-lg ${cfg.bg}`}>
              <div className="flex items-center gap-1.5">
                <Icon className={`w-3 h-3 ${cfg.color}`} />
                <span className={`text-[11px] font-medium ${cfg.color}`}>{cfg.label}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">Bank</p>
                <p className="text-white text-sm mt-0.5">{c.bank}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">Loan Amount</p>
                <p className="text-white text-sm mt-0.5">{formatCurrency(c.amount)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">Property</p>
                <p className="text-white text-sm mt-0.5">{c.property}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">SLA Remaining</p>
                <p className={`text-sm mt-0.5 font-mono ${c.slaDays <= 7 ? 'text-red-400' : c.slaDays <= 14 ? 'text-amber-400' : 'text-emerald-400'}`}>{c.slaDays} days</p>
              </div>
              <div>
                <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">Assigned</p>
                <p className="text-white text-sm mt-0.5">{c.assignedAt}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
            <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mb-3">Progress</p>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${c.progress}%` }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                className={`h-full rounded-full ${
                  c.status === 'complete' ? 'bg-emerald-400' :
                  c.status === 'escalated' ? 'bg-red-400' :
                  'bg-gold'
                }`}
              />
            </div>
            <p className="text-right text-[11px] font-mono text-gray-500 mt-1">{c.progress}%</p>
          </div>

          {c.pendingDocuments.length > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4">
              <p className="text-[10px] font-mono text-amber-400 uppercase tracking-wider mb-2">Required Documents</p>
              <div className="space-y-2">
                {c.pendingDocuments.map(doc => (
                  <div key={doc} className="flex items-center gap-3 text-sm">
                    <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center">
                      <FileText className="w-3 h-3 text-amber-400" />
                    </div>
                    <span className="text-gray-300 flex-1">{doc}</span>
                    <button className="text-gold text-xs font-medium touch-manipulation">Upload</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {c.escalation && (
            <div className={`rounded-xl p-4 border ${
              c.escalation === 3 ? 'bg-red-500/10 border-red-500/20' :
              c.escalation === 2 ? 'bg-amber-500/10 border-amber-500/20' :
              'bg-blue-500/10 border-blue-500/20'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className={`w-4 h-4 ${
                  c.escalation === 3 ? 'text-red-400' :
                  c.escalation === 2 ? 'text-amber-400' : 'text-blue-300'
                }`} />
                <span className={`text-xs font-medium ${
                  c.escalation === 3 ? 'text-red-400' :
                  c.escalation === 2 ? 'text-amber-400' : 'text-blue-300'
                }`}>
                  Tier {c.escalation} — {c.escalation === 3 ? 'Critical' : c.escalation === 2 ? 'Needs Review' : 'Auto-Resolution'}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button className="flex-1 h-12 bg-gold/10 border border-gold/20 rounded-xl text-gold text-sm font-medium touch-manipulation active:bg-gold/20 transition-colors">
              Scan Challan
            </button>
            <button className="flex-1 h-12 bg-white/[0.04] border border-white/[0.08] rounded-xl text-gray-300 text-sm font-medium touch-manipulation active:bg-white/[0.08] transition-colors">
              Update Status
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24" style={{ WebkitTapHighlightColor: 'transparent' }}>
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h1 className="text-xl font-display text-white">NOI Cases</h1>
              <p className="text-gray-500 text-xs font-mono mt-0.5">{pending} active · SRO Thane (W)</p>
            </div>
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] active:bg-white/[0.08] touch-manipulation"
            >
              <RefreshCw className={`w-4 h-4 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-none -mx-4 px-4">
            {statusFilters.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all touch-manipulation ${
                  filter === f.key
                    ? 'bg-gold/15 text-gold border border-gold/25'
                    : 'bg-white/[0.03] text-gray-500 border border-white/[0.06]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-16 text-center"
            >
              <FolderClosed className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No cases match filter</p>
            </motion.div>
          ) : (
            filtered.map((c, i) => {
              const cfg = STATUS_CONFIG[c.status];
              const Icon = cfg.icon;
              return (
                <motion.div
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                  onClick={() => setSelectedCase(c)}
                  className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06] active:bg-white/[0.06] transition-colors touch-manipulation cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-white text-sm font-medium truncate">{c.borrower}</h3>
                        <span className="text-gray-600 text-[11px] font-mono shrink-0">{c.shortId}</span>
                      </div>
                      <p className="text-gray-500 text-xs truncate">{c.bank}</p>
                    </div>
                    <div className={`shrink-0 px-2 py-0.5 rounded-md ${cfg.bg}`}>
                      <div className="flex items-center gap-1">
                        <Icon className={`w-3 h-3 ${cfg.color}`} />
                        <span className={`text-[10px] font-medium ${cfg.color}`}>{cfg.label}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{formatCurrency(c.amount)}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span className={c.slaDays <= 7 ? 'text-red-400' : c.slaDays <= 14 ? 'text-amber-400' : ''}>
                        {c.slaDays}d
                      </span>
                    </span>
                    {c.pendingDocuments.length > 0 && (
                      <span className="text-amber-400/70">{c.pendingDocuments.length} docs</span>
                    )}
                  </div>

                  <div className="mt-3 h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${c.progress}%` }}
                      transition={{ duration: 0.8, delay: 0.1 }}
                      className={`h-full rounded-full ${
                        c.status === 'complete' ? 'bg-emerald-400' :
                        c.status === 'escalated' ? 'bg-red-400' :
                        'bg-gold/60'
                      }`}
                    />
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ScannerTab() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captured, setCaptured] = useState<string[]>([]);
  const [mode, setMode] = useState<'camera' | 'upload'>('upload');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [stream]);

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } });
      setStream(s);
      setMode('camera');
      if (videoRef.current) videoRef.current.srcObject = s;
      setTimeout(() => setScanning(true), 500);
    } catch {
      setMode('upload');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCaptured(prev => [dataUrl, ...prev]);
  };

  const stopCamera = () => {
    if (stream) stream.getTracks().forEach(t => t.stop());
    setStream(null);
    setMode('upload');
    setScanning(false);
  };

  return (
    <div className="pb-24 min-h-screen">
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="px-4 h-14 flex items-center justify-between">
          <h1 className="text-white font-display text-lg">Document Scanner</h1>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Scan className="w-3.5 h-3.5" />
            <span>{captured.length} captured</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {mode === 'camera' ? (
          <div className="relative rounded-xl overflow-hidden bg-black">
            <video ref={videoRef} autoPlay playsInline className="w-full aspect-[3/4] object-cover" />
            {scanning && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-[10%] right-[10%] h-0.5 bg-gold/60 shadow-[0_0_12px_rgba(201,168,76,0.4)]">
                  <motion.div
                    animate={{ y: [0, 200, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    className="absolute -top-1 left-0 right-0 h-3 bg-gradient-to-b from-transparent via-gold/20 to-transparent"
                  />
                </div>
                <div className="absolute inset-[15%] border border-gold/30 rounded-lg" />
                <div className="absolute top-[15%] left-[15%] w-3 h-3 border-t-2 border-l-2 border-gold/50" />
                <div className="absolute top-[15%] right-[15%] w-3 h-3 border-t-2 border-r-2 border-gold/50" />
                <div className="absolute bottom-[15%] left-[15%] w-3 h-3 border-b-2 border-l-2 border-gold/50" />
                <div className="absolute bottom-[15%] right-[15%] w-3 h-3 border-b-2 border-r-2 border-gold/50" />
                <p className="absolute bottom-[8%] left-1/2 -translate-x-1/2 text-gold text-xs font-mono tracking-wider uppercase bg-black/60 px-3 py-1 rounded-full">
                  Align Challan QR
                </p>
              </div>
            )}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-6">
              <button onClick={capturePhoto} className="w-16 h-16 rounded-full border-2 border-white flex items-center justify-center active:scale-90 transition-transform touch-manipulation">
                <div className="w-12 h-12 rounded-full bg-white" />
              </button>
              <button onClick={stopCamera} className="absolute -right-20 p-2 touch-manipulation">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              onClick={startCamera}
              className="w-full h-48 rounded-xl border-2 border-dashed border-white/[0.08] flex flex-col items-center justify-center gap-3 active:bg-white/[0.03] transition-colors touch-manipulation"
            >
              <Camera className="w-8 h-8 text-gray-600" />
              <div className="text-center">
                <p className="text-white text-sm font-medium">Open Camera</p>
                <p className="text-gray-500 text-xs mt-0.5">Scan challan QR code or documents</p>
              </div>
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/[0.06]" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-black px-3 text-[10px] font-mono text-gray-600 uppercase">or upload from gallery</span>
              </div>
            </div>

            <label className="flex items-center justify-center gap-2 w-full h-12 bg-white/[0.04] border border-white/[0.08] rounded-xl text-gray-300 text-sm font-medium active:bg-white/[0.08] touch-manipulation cursor-pointer">
              <Upload className="w-4 h-4" />
              Choose Files
              <input type="file" accept="image/*" multiple className="hidden" onChange={e => {
                const files = Array.from(e.target.files || []);
                files.forEach(f => {
                  const reader = new FileReader();
                  reader.onload = () => setCaptured(prev => [reader.result as string, ...prev]);
                  reader.readAsDataURL(f);
                });
              }} />
            </label>
          </>
        )}

        {captured.length > 0 && (
          <div>
            <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mb-2">Captured Documents</p>
            <div className="grid grid-cols-3 gap-2">
              {captured.map((img, i) => (
                <div key={i} className="relative aspect-[3/4] rounded-lg overflow-hidden bg-white/[0.03] border border-white/[0.06]">
                  <img src={img} alt={`Capture ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => setCaptured(prev => prev.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
                  >
                    <X className="w-3 h-3 text-gray-400" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                    <p className="text-[9px] text-gray-400 font-mono">Doc {i + 1}</p>
                  </div>
                </div>
              ))}
            </div>

            <button className="w-full h-12 mt-4 bg-gold/10 border border-gold/20 rounded-xl text-gold text-sm font-medium active:bg-gold/20 transition-colors touch-manipulation">
              Upload All ({captured.length} docs)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityTab() {
  const [online] = useState(true);
  const activities = [
    { action: 'Challan scanned', case: 'KTK-042', time: '2 min ago', status: 'synced' },
    { action: 'Status updated → Filing', case: 'ICI-045', time: '15 min ago', status: 'synced' },
    { action: 'Document uploaded', case: 'AXS-039', time: '1h ago', status: 'synced' },
    { action: 'Case assigned', case: 'MUT-037', time: '3h ago', status: 'synced' },
    { action: 'Photo captured', case: 'KVN-038', time: '4h ago', status: 'pending' },
    { action: 'Location checkpoint', case: 'SRO Thane', time: '5h ago', status: 'synced' },
  ];

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="px-4 h-14 flex items-center justify-between">
          <div>
            <h1 className="text-white font-display text-lg">Activity</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs ${
              online ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {online ? 'Live' : 'Offline'}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06] mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white text-sm font-medium">Today&apos;s Route</p>
              <p className="text-gray-500 text-xs mt-0.5">SRO Thane · 3 checkpoints</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-gold" />
            </div>
          </div>
          <div className="space-y-0">
            {['AG Associates Office', 'SRO Thane (W)', 'Axis Finance Branch'].map((loc, i) => (
              <div key={loc} className="flex items-center gap-3 py-2">
                <div className="flex flex-col items-center">
                  <div className={`w-2.5 h-2.5 rounded-full ${i < 2 ? 'bg-gold/60' : 'bg-gray-600'}`} />
                  {i < 2 && <div className="w-px h-4 bg-white/[0.06]" />}
                </div>
                <div>
                  <p className="text-sm text-white">{loc}</p>
                  <p className="text-[10px] font-mono text-gray-600">{i === 0 ? '08:30 AM' : i === 1 ? '10:15 AM' : 'Pending'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mb-3">Live Feed</p>
        <div className="space-y-2">
          {activities.map((a, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-xl">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                a.status === 'synced' ? 'bg-emerald-500' : 'bg-amber-500'
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm">{a.action}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="font-mono">{a.case}</span>
                  <span>{a.time}</span>
                </div>
              </div>
              {a.status === 'pending' && (
                <div className="flex items-center gap-1 text-[10px] text-amber-400">
                  <RefreshCw className="w-3 h-3" />
                  Syncing
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="px-4 h-14 flex items-center">
          <h1 className="text-white font-display text-lg">Settings</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
              <User className="w-5 h-5 text-gold" />
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-medium">Field Executive</p>
              <p className="text-gray-500 text-xs">SRO Thane (W) · Panel Agent</p>
            </div>
            <LogOut className="w-4 h-4 text-gray-600" />
          </div>
        </div>

        <div className="bg-white/[0.03] rounded-xl overflow-hidden border border-white/[0.06]">
          {[
            { label: 'Offline Queue', value: '3 pending', icon: Download },
            { label: 'Storage Used', value: '24 MB', icon: Upload },
            { label: 'Last Sync', value: '2 min ago', icon: RefreshCw },
            { label: 'App Version', value: '2.0.26', icon: FileText },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className={`flex items-center gap-3 px-4 py-3.5 ${i < 3 ? 'border-b border-white/[0.04]' : ''}`}>
                <Icon className="w-4 h-4 text-gray-600" />
                <span className="text-sm text-gray-400 flex-1">{item.label}</span>
                <span className="text-sm text-white">{item.value}</span>
              </div>
            );
          })}
        </div>

        <div className="bg-white/[0.03] rounded-xl overflow-hidden border border-white/[0.06]">
          <div className="px-4 py-3 border-b border-white/[0.04]">
            <p className="text-xs text-gray-500 font-medium">Notifications</p>
          </div>
          {[
            { label: 'Case Assignments', enabled: true },
            { label: 'Escalation Alerts', enabled: true },
            { label: 'Sync Complete', enabled: false },
            { label: 'Daily Summary', enabled: true },
          ].map(n => (
            <div key={n.label} className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.04] last:border-0">
              <span className="text-sm text-gray-300">{n.label}</span>
              <div className={`w-10 h-5 rounded-full p-0.5 transition-colors ${n.enabled ? 'bg-gold/40' : 'bg-white/[0.08]'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${n.enabled ? 'translate-x-5' : ''}`} />
              </div>
            </div>
          ))}
        </div>

        <button className="w-full h-12 rounded-xl border border-red-500/20 text-red-400 text-sm font-medium active:bg-red-500/5 transition-colors touch-manipulation">
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default function NoiMobilePage() {
  const [activeTab, setActiveTab] = useState<Tab>('cases');
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const handler = () => setOffline(!navigator.onLine);
    window.addEventListener('online', handler);
    window.addEventListener('offline', handler);
    return () => {
      window.removeEventListener('online', handler);
      window.removeEventListener('offline', handler);
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-x-hidden" style={{ WebkitTapHighlightColor: 'transparent' }}>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] orb-gold opacity-20" />
      </div>

      {offline && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500/10 backdrop-blur-xl border-b border-amber-500/20">
          <div className="flex items-center justify-center gap-2 py-1.5 px-4">
            <WifiOff className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-amber-400 text-xs font-medium">You are offline — changes will sync when reconnected</span>
          </div>
        </div>
      )}

      <div className={offline ? 'pt-8' : ''}>
        {activeTab === 'cases' && <CasesTab />}
        {activeTab === 'scanner' && <ScannerTab />}
        {activeTab === 'activity' && <ActivityTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>

      <TabBar active={activeTab} onTab={setActiveTab} />

      <style jsx global>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 0px); }
        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
        }
      `}</style>
    </div>
  );
}
