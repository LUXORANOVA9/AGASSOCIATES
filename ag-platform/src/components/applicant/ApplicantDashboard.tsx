import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, UploadCloud, FileText, Loader2 } from 'lucide-react';
import { Case } from '../../types/domain';

export function ApplicantDashboard() {
  const [activeCase, setActiveCase] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCases() {
      try {
        const res = await fetch('/api/cases');
        const data = await res.json();
        // Just grab the first active case for demo purposes
        if (Array.isArray(data) && data.length > 0) {
          setActiveCase(data[0]);
        }
      } catch (err) {
        console.error('Failed to fetch cases', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCases();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  if (!activeCase) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-slate-500">
        No active applications found.
      </div>
    );
  }

  // Derive steps based on case status
  const isDocCollection = ['RECEIVED', 'ASSIGNED', 'DOCUMENT_COLLECTION'].includes(activeCase.status);
  const isReview = ['IN_PROGRESS', 'PENDING_REGISTRATION', 'REGISTERED', 'QUALITY_CHECK'].includes(activeCase.status);
  const isSanctioned = ['DELIVERED', 'CLOSED'].includes(activeCase.status);

  return (
    <div className="flex flex-col h-full bg-slate-50 relative p-6">
      <div className="max-w-4xl w-full mx-auto space-y-6">
        
        <header className="mb-8">
          <h2 className="text-2xl font-serif font-bold text-slate-900">Application Dashboard</h2>
          <p className="text-slate-600 mt-1">Loan Ref: <span className="font-mono text-slate-800">#{activeCase.case_number}</span></p>
        </header>

        {/* Milestone Tracker */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <Milestone step={1} title="Identity & KYC" active={false} completed={true} />
          <div className="h-[2px] flex-1 bg-indigo-600 mx-4"></div>
          <Milestone step={2} title="Docs Vault" active={isDocCollection} completed={!isDocCollection} />
          <div className="h-[2px] flex-1 bg-slate-200 mx-4" style={{ backgroundColor: !isDocCollection ? '#4f46e5' : '#e2e8f0' }}></div>
          <Milestone step={3} title="Lender Review" active={isReview} completed={isSanctioned} />
          <div className="h-[2px] flex-1 bg-slate-200 mx-4" style={{ backgroundColor: isSanctioned ? '#4f46e5' : '#e2e8f0' }}></div>
          <Milestone step={4} title="Sanctioned" active={false} completed={isSanctioned} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Action Required */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
             <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
               <UploadCloud className="text-indigo-600" size={20} /> Required Documents
             </h3>
             <ul className="space-y-4 flex-1">
               <li className="flex items-start justify-between border-b border-slate-100 pb-3">
                 <div>
                   <p className="font-medium text-slate-800">Salary Slips (Last 3 months)</p>
                   <p className="text-xs text-slate-500">PDF or Images accepted</p>
                 </div>
                 <button className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition">
                   Upload
                 </button>
               </li>
               <li className="flex items-start justify-between border-b border-slate-100 pb-3">
                 <div>
                   <p className="font-medium text-slate-800">ITR V (AY 2023-24)</p>
                   <p className="text-xs text-slate-500">From Income Tax Portal</p>
                 </div>
                 <button className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition">
                   Upload
                 </button>
               </li>
             </ul>
             
             <div className="mt-6 bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-600">
               Or use <span className="font-semibold text-slate-800">Account Aggregator</span> to fetch your banking data securely via Finvu.
               <button className="mt-2 w-full py-2 bg-slate-900 text-white rounded-lg font-medium">Link Bank Account Securely</button>
             </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
             <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
               <FileText className="text-indigo-600" size={20} /> Vault History
             </h3>
             <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">Aadhaar XML Verified</p>
                    <p className="text-xs text-slate-500">Fetched from DigiLocker • 2 hrs ago</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">PAN Record Match</p>
                    <p className="text-xs text-slate-500">NSDL Central DB • 2 hrs ago</p>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Milestone({ title, active, completed }: { step: number, title: string, active: boolean, completed: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-2 ${active || completed ? 'text-indigo-700' : 'text-slate-400'}`}>
      {completed ? <CheckCircle2 className="text-indigo-600 bg-white" size={24} /> : 
       active ? <Circle className="text-indigo-600 fill-indigo-50" size={24} /> : 
       <Circle className="text-slate-300" size={24} />}
      <span className="text-xs font-semibold uppercase tracking-wider text-center">{title}</span>
    </div>
  );
}
