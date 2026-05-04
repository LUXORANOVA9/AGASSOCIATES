import { useState, useEffect } from 'react';
import { Building, Search, FileText, CheckCircle, Clock } from 'lucide-react';
import { Case, CaseStatus } from '../../types/domain';

export function BankPortal() {
  const [cases, setCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // In a real scenario, this would be scoped to the logged-in bank personnel's bank_id
    // and would fetch /api/bank/cases
    fetch('/api/cases')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCases(data);
        } else if (data && data.data) {
          setCases(data.data as Case[]);
        }
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Failed to fetch cases', error);
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-50 p-6">
      <div className="max-w-6xl w-full mx-auto space-y-6">
        
        <header className="mb-8 flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-serif font-bold text-slate-900 flex items-center gap-2">
              <Building className="text-emerald-700" size={24} /> Partner Bank Portal
            </h2>
            <p className="text-slate-600 mt-1">Read-only view for underwriter evaluation</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search ref # or PAN..." 
              className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-slate-500">Loading cases...</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                  <th className="p-4">Reference No.</th>
                  <th className="p-4">Applicant</th>
                  <th className="p-4">Loan Amount</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Submission Date</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cases.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500">No cases found for this bank.</td></tr>
                ) : (
                  cases.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-mono text-sm text-slate-800">{c.case_number}</td>
                      <td className="p-4 text-sm font-medium text-slate-900">
                        {c.borrower_name}
                      </td>
                      <td className="p-4 text-sm text-slate-600">
                        ₹ {c.loan_amount.toLocaleString()}
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          {c.status === CaseStatus.DELIVERED || c.status === CaseStatus.CLOSED ? (
                            <CheckCircle size={12} className="text-emerald-500" />
                          ) : (
                            <Clock size={12} className="text-amber-500" />
                          )}
                          {c.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-slate-500">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <button className="text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1 border border-emerald-200">
                          <FileText size={14} /> Review Specs
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
