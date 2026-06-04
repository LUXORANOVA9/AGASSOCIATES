import { useState, useEffect } from 'react';
import { Send, AlertCircle, Loader2, AlertTriangle, CheckCircle, UserCheck } from 'lucide-react';
import { Case, CaseStatus, HITLTask } from '../../types/domain';

export function AdvisorCockpit() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'kanban' | 'hitl'>('kanban');
  const [hitlTasks, setHitlTasks] = useState<HITLTask[]>([]);
  const [hitlLoading, setHitlLoading] = useState(false);

  useEffect(() => {
    async function fetchCases() {
      try {
        setError(null);
        const res = await fetch('/api/cases');
        if (!res.ok) throw new Error('Failed to load case pipeline');
        const data = await res.json();
        
        if (Array.isArray(data)) {
          setCases(data);
        } else if (data && data.data) {
          setCases(data.data as Case[]);
        } else {
          throw new Error('Invalid data format received');
        }
      } catch (err: unknown) {
        let msg = 'An unexpected error occurred';
        if (err instanceof Error) {
            msg = err.message;
        }
        setError(msg);
        console.error('Failed to fetch cases', err);
      } finally {
        setLoading(false);
      }
    }

    fetchCases();
  }, []);

  const fetchHITL = async () => {
    try {
      setHitlLoading(true);
      const res = await fetch('/api/hitl/tasks');
      if (res.ok) {
        const data = await res.json();
        setHitlTasks(data.tasks ?? []);
      }
    } catch {
      // Silently fail — HITL isn't critical for the main view
    } finally {
      setHitlLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'hitl') {
      fetchHITL();
      const interval = setInterval(fetchHITL, 15000);
      return () => clearInterval(interval);
    }
  }, [view]);

  const claimTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/hitl/tasks/${taskId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimed_by: 'cockpit_user' }),
      });
      if (res.ok) {
        const data = await res.json();
        setHitlTasks(prev => prev.map(t => t.id === taskId ? data.task : t));
      }
    } catch {
      alert('Failed to claim task');
    }
  };

  const completeTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/hitl/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Manually resolved via cockpit' }),
      });
      if (res.ok) {
        setHitlTasks(prev => prev.filter(t => t.id !== taskId));
      }
    } catch {
      alert('Failed to complete task');
    }
  };

  const updateCaseStatus = async (id: string, newStatus: CaseStatus) => {
    // Optimistic update
    const previousCases = [...cases];
    setCases(cases.map(c => c.id === id ? { ...c, status: newStatus } : c));

    try {
      const res = await fetch(`/api/cases/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        // Revert on failure
        setCases(previousCases);
        alert('Failed to update case status');
      }
    } catch (err) {
      console.error('Failed to update status', err);
      // Revert on failure
      setCases(previousCases);
      alert('Network error while updating case status');
    }
  };

  const getCasesByStatus = (statusGroup: CaseStatus[]) => {
    return cases.filter(c => statusGroup.includes(c.status));
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center space-y-4" role="status" aria-label="Loading cases">
        <Loader2 className="animate-spin text-indigo-600" size={32} aria-hidden="true" />
        <span className="text-slate-500 font-medium">Loading Pipeline...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center" role="alert">
        <AlertCircle className="text-rose-500 mb-4" size={48} aria-hidden="true" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">Connection Error</h2>
        <p className="text-slate-600 mb-6 max-w-md">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-lg transition"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <main className="flex h-full bg-slate-50 relative p-6 w-full">
      <div className="w-full flex flex-col space-y-6">
        
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif font-bold text-slate-900">Legal Ops Pipeline (Banker's Eye)</h1>
            <p className="text-sm text-slate-500 mt-1">Real-time Kanban View</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-200 rounded-lg p-0.5">
              <button
                onClick={() => setView('kanban')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${view === 'kanban' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
              >
                Kanban
              </button>
              <button
                onClick={() => setView('hitl')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition flex items-center gap-1.5 ${view === 'hitl' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
              >
                <AlertTriangle size={14} />
                HITL Queue
                {hitlTasks.filter(t => t.status === 'PENDING').length > 0 && (
                  <span className="bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                    {hitlTasks.filter(t => t.status === 'PENDING').length}
                  </span>
                )}
              </button>
            </div>
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-slate-200" aria-label={`${cases.length} active cases`}>
              <span className="text-2xl font-mono font-bold text-slate-900">{cases.length}</span>
              <span className="text-xs text-slate-500 font-medium uppercase leading-tight">Active<br/>Cases</span>
            </div>
          </div>
        </header>

        {view === 'hitl' ? (
          <section className="flex-1 overflow-y-auto" aria-label="HITL Queue">
            <div className="space-y-3">
              {hitlLoading && hitlTasks.length === 0 && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin text-indigo-600" size={24} />
                </div>
              )}
              {!hitlLoading && hitlTasks.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <CheckCircle size={48} className="mx-auto mb-3 text-emerald-400" />
                  <p className="text-lg font-medium">No pending HITL tasks</p>
                  <p className="text-sm mt-1">All RPA portals are operating normally</p>
                </div>
              )}
              {hitlTasks.map(task => (
                <div key={task.id} className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${task.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                          {task.status}
                        </span>
                        <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{task.portal}</span>
                        <span className="text-xs font-mono text-slate-500">{task.case_id}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-900 mt-1">{task.reason}</p>
                      {task.claimed_by && (
                        <p className="text-xs text-slate-500 mt-1">Claimed by: {task.claimed_by}</p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {task.status === 'PENDING' && (
                        <button
                          onClick={() => claimTask(task.id)}
                          className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg transition"
                        >
                          <UserCheck size={14} /> Claim
                        </button>
                      )}
                      {task.status === 'CLAIMED' && (
                        <button
                          onClick={() => completeTask(task.id)}
                          className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded-lg transition"
                        >
                          <CheckCircle size={14} /> Complete
                        </button>
                      )}
                    </div>
                  </div>
                  {task.payload && Object.keys(task.payload).length > 0 && (
                    <pre className="text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 overflow-x-auto max-h-32">
                      {JSON.stringify(task.payload, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : (
        <section className="flex-1 flex gap-6 overflow-x-auto pb-4" aria-label="Case Pipeline Columns">
           {/* Column 1: Intake */}
           <div className="min-w-[320px] max-w-[320px] flex flex-col bg-slate-100 rounded-xl p-3 border border-slate-200">
             <header className="flex items-center justify-between mb-4 px-2 pt-2">
               <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Intake</h2>
               <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium" aria-label={`${getCasesByStatus([CaseStatus.RECEIVED]).length} cases in Intake`}>
                 {getCasesByStatus([CaseStatus.RECEIVED]).length}
               </span>
             </header>
             
             <div className="space-y-3" role="list" aria-label="Intake Cases">
               {getCasesByStatus([CaseStatus.RECEIVED]).map(c => (
                 <CaseCard key={c.id} kase={c} onUpdateStatus={updateCaseStatus} />
               ))}
               {getCasesByStatus([CaseStatus.RECEIVED]).length === 0 && (
                 <p className="text-xs text-slate-400 text-center py-8">No cases in intake</p>
               )}
             </div>
           </div>

           {/* Column 2: OCR Processing */}
           <div className="min-w-[320px] max-w-[320px] flex flex-col bg-slate-100 rounded-xl p-3 border border-slate-200">
             <header className="flex items-center justify-between mb-4 px-2 pt-2">
               <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">OCR Processing</h2>
               <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium" aria-label={`${getCasesByStatus([CaseStatus.DOCUMENT_COLLECTION, CaseStatus.ASSIGNED]).length} cases in OCR Processing`}>
                 {getCasesByStatus([CaseStatus.DOCUMENT_COLLECTION, CaseStatus.ASSIGNED]).length}
               </span>
             </header>

             <div className="space-y-3" role="list" aria-label="OCR Processing Cases">
               {getCasesByStatus([CaseStatus.DOCUMENT_COLLECTION, CaseStatus.ASSIGNED]).map(c => (
                 <CaseCard key={c.id} kase={c} onUpdateStatus={updateCaseStatus} />
               ))}
               {getCasesByStatus([CaseStatus.DOCUMENT_COLLECTION, CaseStatus.ASSIGNED]).length === 0 && (
                 <p className="text-xs text-slate-400 text-center py-8">No active processing</p>
               )}
             </div>
           </div>

           {/* Column 3: Validation */}
           <div className="min-w-[320px] max-w-[320px] flex flex-col bg-slate-100 rounded-xl p-3 border border-slate-200">
             <header className="flex items-center justify-between mb-4 px-2 pt-2">
               <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Validation</h2>
               <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-medium" aria-label={`${getCasesByStatus([CaseStatus.IN_PROGRESS, CaseStatus.PENDING_REGISTRATION]).length} cases in Validation`}>
                 {getCasesByStatus([CaseStatus.IN_PROGRESS, CaseStatus.PENDING_REGISTRATION]).length}
               </span>
             </header>
             
             <div className="space-y-3" role="list" aria-label="Validation Cases">
               {getCasesByStatus([CaseStatus.IN_PROGRESS, CaseStatus.PENDING_REGISTRATION]).map(c => (
                 <CaseCard key={c.id} kase={c} onUpdateStatus={updateCaseStatus} />
               ))}
               {getCasesByStatus([CaseStatus.IN_PROGRESS, CaseStatus.PENDING_REGISTRATION]).length === 0 && (
                 <p className="text-xs text-slate-400 text-center py-8">No cases in validation</p>
               )}
             </div>
           </div>

           {/* Column 4: Awaiting Human Review */}
           <div className="min-w-[320px] max-w-[320px] flex flex-col bg-slate-100 rounded-xl p-3 border border-slate-200">
             <header className="flex items-center justify-between mb-4 px-2 pt-2">
               <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Awaiting Human Review</h2>
               <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium" aria-label={`${getCasesByStatus([CaseStatus.QUALITY_CHECK]).length} cases in Review`}>
                 {getCasesByStatus([CaseStatus.QUALITY_CHECK]).length}
               </span>
             </header>
             
             <div className="space-y-3" role="list" aria-label="Awaiting Human Review Cases">
               {getCasesByStatus([CaseStatus.QUALITY_CHECK]).map(c => (
                 <CaseCard key={c.id} kase={c} onUpdateStatus={updateCaseStatus} />
               ))}
               {getCasesByStatus([CaseStatus.QUALITY_CHECK]).length === 0 && (
                 <p className="text-xs text-slate-400 text-center py-8">No cases awaiting review</p>
               )}
             </div>
           </div>

           {/* Column 5: Ready for IGR */}
           <div className="min-w-[320px] max-w-[320px] flex flex-col bg-slate-100 rounded-xl p-3 border border-slate-200">
             <header className="flex items-center justify-between mb-4 px-2 pt-2">
               <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Ready for IGR</h2>
               <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-medium" aria-label={`${getCasesByStatus([CaseStatus.REGISTERED, CaseStatus.DELIVERED, CaseStatus.CLOSED]).length} cases Ready for IGR`}>
                 {getCasesByStatus([CaseStatus.REGISTERED, CaseStatus.DELIVERED, CaseStatus.CLOSED]).length}
               </span>
             </header>

             <div className="space-y-3" role="list" aria-label="Ready for IGR Cases">
               {getCasesByStatus([CaseStatus.REGISTERED, CaseStatus.DELIVERED, CaseStatus.CLOSED]).map(c => (
                 <CaseCard key={c.id} kase={c} onUpdateStatus={updateCaseStatus} />
               ))}
               {getCasesByStatus([CaseStatus.REGISTERED, CaseStatus.DELIVERED, CaseStatus.CLOSED]).length === 0 && (
                 <p className="text-xs text-slate-400 text-center py-8">No cases ready for IGR</p>
               )}
             </div>
           </div>
        </section>
        )}
      </div>
    </main>
  );
}


function CaseCard({ kase, onUpdateStatus }: { kase: Case; onUpdateStatus: (id: string, status: CaseStatus) => void }) {
  const isUrgent = kase.sla_deadline && new Date(kase.sla_deadline) < new Date();
  
  const handleNextStatus = () => {
    let nextStatus = kase.status;
    switch(kase.status) {
      case CaseStatus.RECEIVED:
        nextStatus = CaseStatus.ASSIGNED; break; // Move to OCR Processing
      case CaseStatus.ASSIGNED:
        nextStatus = CaseStatus.DOCUMENT_COLLECTION; break; // Stay in OCR
      case CaseStatus.DOCUMENT_COLLECTION:
        nextStatus = CaseStatus.IN_PROGRESS; break; // Move to Validation
      case CaseStatus.IN_PROGRESS:
        nextStatus = CaseStatus.PENDING_REGISTRATION; break; // Stay in Validation
      case CaseStatus.PENDING_REGISTRATION:
        nextStatus = CaseStatus.QUALITY_CHECK; break; // Move to Human Review
      case CaseStatus.QUALITY_CHECK:
        nextStatus = CaseStatus.REGISTERED; break; // Move to Ready for IGR
      case CaseStatus.REGISTERED:
        nextStatus = CaseStatus.DELIVERED; break; // Stay in Ready
      case CaseStatus.DELIVERED:
        nextStatus = CaseStatus.CLOSED; break; // Close
      default:
        return;
    }
    if (nextStatus !== kase.status) {
      onUpdateStatus(kase.id, nextStatus);
    }
  };

  return (
    <article role="listitem" className={`bg-white p-4 rounded-xl border shadow-sm ${isUrgent ? 'border-amber-300' : 'border-slate-200'}`}>
      <header className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-slate-900 leading-tight">{kase.borrower_name}</h3>
        <span className="font-mono text-xs font-bold text-slate-700" aria-label={`Loan amount: ${(kase.loan_amount / 10000000).toFixed(2)} Crores`}>
          ₹ {(kase.loan_amount / 10000000).toFixed(2)} Cr
        </span>
      </header>
      <p className="text-xs text-slate-500 mb-4">{kase.case_type.replace(/_/g, ' ')}</p>
      
      {isUrgent && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 p-2 rounded-md mb-3" role="alert">
          <AlertCircle size={14} aria-hidden="true" /> Delayed SLA
        </div>
      )}

      <footer className="flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-500 line-clamp-1">{kase.status.replace(/_/g, ' ')}</span>
        <div className="flex gap-2">
          <button 
            onClick={handleNextStatus}
            className="bg-indigo-600 hover:bg-indigo-700 text-white p-1.5 rounded-md transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" 
            aria-label={`Advance status for ${kase.borrower_name}`}
            title="Advance Status"
          >
            <Send size={14} aria-hidden="true" />
          </button>
        </div>
      </footer>
    </article>
  );
}
