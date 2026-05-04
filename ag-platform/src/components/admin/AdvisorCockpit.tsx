
import { useState, useEffect } from 'react';
import { MessageSquare, Send, AlertCircle, Loader2 } from 'lucide-react';
import { Case, CaseStatus } from '../../types/domain';

export function AdvisorCockpit() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCases() {
      try {
        const res = await fetch('/api/cases');
        const data = await res.json();
        if (Array.isArray(data)) {
          setCases(data);
        } else {
          console.error('Expected array from /api/cases, got:', data);
          setCases([]);
        }
      } catch (err) {
        console.error('Failed to fetch cases', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCases();
  }, []);

  const updateCaseStatus = async (id: string, newStatus: CaseStatus) => {
    try {
      const res = await fetch(`/api/cases/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setCases(cases.map(c => c.id === id ? { ...c, status: newStatus } : c));
      }
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const getCasesByStatus = (statusGroup: CaseStatus[]) => {
    return cases.filter(c => statusGroup.includes(c.status));
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="flex h-full bg-slate-50 relative p-6 w-full">
      <div className="w-full flex flex-col space-y-6">
        
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-serif font-bold text-slate-900">Legal Ops Pipeline</h2>
            <p className="text-sm text-slate-500 mt-1">Advisor Cockpit view</p>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-slate-200">
              <span className="text-2xl font-mono font-bold text-slate-900">{cases.length}</span>
              <span className="text-xs text-slate-500 font-medium uppercase leading-tight">Active<br/>Cases</span>
            </div>
          </div>
        </header>

        {/* Kanban Board */}
        <div className="flex-1 flex gap-6 overflow-x-auto pb-4">
           {/* Column 1: Intake & Docs */}
           <div className="min-w-[320px] max-w-[320px] flex flex-col bg-slate-100 rounded-xl p-3 border border-slate-200">
             <div className="flex items-center justify-between mb-4 px-2 pt-2">
               <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Document Collection</h3>
               <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium">
                 {getCasesByStatus([CaseStatus.RECEIVED, CaseStatus.ASSIGNED, CaseStatus.DOCUMENT_COLLECTION]).length}
               </span>
             </div>
             
             <div className="space-y-3">
               {getCasesByStatus([CaseStatus.RECEIVED, CaseStatus.ASSIGNED, CaseStatus.DOCUMENT_COLLECTION]).map(c => (
                 <CaseCard key={c.id} kase={c} onUpdateStatus={updateCaseStatus} />
               ))}
               {getCasesByStatus([CaseStatus.RECEIVED, CaseStatus.ASSIGNED, CaseStatus.DOCUMENT_COLLECTION]).length === 0 && (
                 <p className="text-xs text-slate-400 text-center py-8">No cases in collection</p>
               )}
             </div>
           </div>

           {/* Column 2: In Progress / Search */}
           <div className="min-w-[320px] max-w-[320px] flex flex-col bg-slate-100 rounded-xl p-3 border border-slate-200">
             <div className="flex items-center justify-between mb-4 px-2 pt-2">
               <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Processing</h3>
               <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-medium">
                 {getCasesByStatus([CaseStatus.IN_PROGRESS, CaseStatus.PENDING_REGISTRATION]).length}
               </span>
             </div>
             
             <div className="space-y-3">
               {getCasesByStatus([CaseStatus.IN_PROGRESS, CaseStatus.PENDING_REGISTRATION]).map(c => (
                 <CaseCard key={c.id} kase={c} onUpdateStatus={updateCaseStatus} />
               ))}
               {getCasesByStatus([CaseStatus.IN_PROGRESS, CaseStatus.PENDING_REGISTRATION]).length === 0 && (
                 <p className="text-xs text-slate-400 text-center py-8">No active processing</p>
               )}
             </div>
           </div>

           {/* Column 3: Quality & Delivery */}
           <div className="min-w-[320px] max-w-[320px] flex flex-col bg-slate-100 rounded-xl p-3 border border-slate-200">
             <div className="flex items-center justify-between mb-4 px-2 pt-2">
               <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Review & Delivery</h3>
               <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium">
                 {getCasesByStatus([CaseStatus.REGISTERED, CaseStatus.QUALITY_CHECK, CaseStatus.DELIVERED]).length}
               </span>
             </div>
             
             <div className="space-y-3">
               {getCasesByStatus([CaseStatus.REGISTERED, CaseStatus.QUALITY_CHECK, CaseStatus.DELIVERED]).map(c => (
                 <CaseCard key={c.id} kase={c} onUpdateStatus={updateCaseStatus} />
               ))}
               {getCasesByStatus([CaseStatus.REGISTERED, CaseStatus.QUALITY_CHECK, CaseStatus.DELIVERED]).length === 0 && (
                 <p className="text-xs text-slate-400 text-center py-8">None pending delivery</p>
               )}
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function CaseCard({ kase, onUpdateStatus }: { kase: Case, onUpdateStatus: (id: string, status: CaseStatus) => void }) {
  const isUrgent = kase.sla_deadline && new Date(kase.sla_deadline) < new Date();
  
  const handleNextStatus = () => {
    let nextStatus = kase.status;
    switch(kase.status) {
      case CaseStatus.RECEIVED:
      case CaseStatus.ASSIGNED:
        nextStatus = CaseStatus.DOCUMENT_COLLECTION; break;
      case CaseStatus.DOCUMENT_COLLECTION:
        nextStatus = CaseStatus.IN_PROGRESS; break;
      case CaseStatus.IN_PROGRESS:
      case CaseStatus.PENDING_REGISTRATION:
      case CaseStatus.REGISTERED:
        nextStatus = CaseStatus.QUALITY_CHECK; break;
      case CaseStatus.QUALITY_CHECK:
        nextStatus = CaseStatus.DELIVERED; break;
      default:
        return;
    }
    if (nextStatus !== kase.status) {
      onUpdateStatus(kase.id, nextStatus);
    }
  };

  return (
    <div className={`bg-white p-4 rounded-xl border shadow-sm ${isUrgent ? 'border-amber-300' : 'border-slate-200'}`}>
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-semibold text-slate-900 leading-tight">{kase.borrower_name}</h4>
        <span className="font-mono text-xs font-bold text-slate-700">₹ {(kase.loan_amount / 10000000).toFixed(2)} Cr</span>
      </div>
      <p className="text-xs text-slate-500 mb-4">{kase.case_type.replace(/_/g, ' ')}</p>
      
      {isUrgent && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 p-2 rounded-md mb-3">
          <AlertCircle size={14} /> Delayed SLA
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-500 line-clamp-1">{kase.status.replace(/_/g, ' ')}</span>
        <div className="flex gap-2">
          <button 
            onClick={handleNextStatus}
            className="bg-indigo-600 hover:bg-indigo-700 text-white p-1.5 rounded-md transition" 
            title="Advance Status"
          >
            <Send size={14} />
          </button>
          <button className="text-slate-400 hover:text-indigo-600 transition" title="Communicate">
            <MessageSquare size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
