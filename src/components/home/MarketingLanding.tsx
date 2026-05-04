import { useState } from 'react';
import { ArrowRight, Calculator, ShieldCheck, Home, CheckCircle2, ChevronRight, X, Building, RotateCcw, Landmark, Plane } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function MarketingLanding() {
  const [loanAmount, setLoanAmount] = useState(5000000);
  const [tenure, setTenure] = useState(20);
  const interestRate = 8.5; // Expected baseline

  const [isModalOpen, setIsModalOpen] = useState(false);

  const monthlyRate = interestRate / 12 / 100;
  const emi = Math.round(
    loanAmount * monthlyRate * Math.pow(1 + monthlyRate, tenure * 12) /
    (Math.pow(1 + monthlyRate, tenure * 12) - 1)
  );

  return (
    <div className="flex flex-col bg-white">
      {/* Hero Section */}
      <section className="px-6 py-24 md:py-32 max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        <div className="flex flex-col items-start gap-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-full">
            <Home size={16} /> Home Loan Advisory
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-slate-900 leading-[1.1]">
            Your Home Loan,<br/> Structured with Precision.
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed max-w-md">
            AG Associates navigates the Indian home loan ecosystem so you don't have to. We connect you with India’s top lenders under optimal RBI guidelines.
          </p>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-lg font-medium transition mt-2"
          >
            Prequalify in 2 Minutes <ArrowRight size={18} />
          </button>
        </div>
        
        {/* EMI Calculator */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 shadow-sm">
          <h3 className="text-xl font-serif font-semibold text-slate-900 mb-6 flex items-center gap-2">
            <Calculator size={20} className="text-indigo-600" /> EMI Estimator
          </h3>
          
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm font-medium text-slate-700 mb-2">
                <span>Loan Amount</span>
                <span className="font-mono">₹{loanAmount.toLocaleString('en-IN')}</span>
              </div>
              <input 
                type="range" 
                min="1000000" max="50000000" step="100000"
                value={loanAmount} 
                onChange={e => setLoanAmount(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-sm font-medium text-slate-700 mb-2">
                <span>Tenure (Years)</span>
                <span className="font-mono">{tenure} Yrs</span>
              </div>
              <input 
                type="range" 
                min="5" max="30" step="1"
                value={tenure} 
                onChange={e => setTenure(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>
            
            <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl mt-4">
              <span className="text-sm font-medium text-slate-600">Indicative EMI</span>
              <span className="text-2xl font-mono font-bold text-slate-900">
                ₹{emi.toLocaleString('en-IN')}
              </span>
            </div>
            <p className="text-xs text-slate-500 text-center">
              *Calculated at {interestRate}% indicative interest rate. Subject to lender approval.
            </p>
          </div>
        </div>
      </section>

      {/* Services Taxonomy */}
      <section className="bg-slate-50 py-24 px-6 border-y border-slate-200">
        <div className="max-w-7xl mx-auto w-full">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-serif font-bold text-slate-900 mb-4">Advisory Services</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">We structure financing across the full spectrum of residential real estate assets.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: <Home />, title: 'Fresh Home Loan', desc: 'Secure optimal rates for new purchases and under-construction properties.' },
              { icon: <RotateCcw />, title: 'Balance Transfer', desc: 'Refinance your existing loan to a lower rate, reducing EMI and tenure.' },
              { icon: <Landmark />, title: 'Plot Loan', desc: 'Finance land acquisition for self-construction within municipal limits.' },
              { icon: <Building />, title: 'Construction Loan', desc: 'Structured disbursements aligned with construction milestones.' },
              { icon: <Plane />, title: 'NRI Home Loan', desc: 'End-to-end processing for non-resident Indians acquiring property.' },
              { icon: <Calculator />, title: 'Top-Up Loan', desc: 'Leverage equity in your existing property for personal or renovation needs.' },
            ].map((service, idx) => (
              <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer group">
                <div className="text-indigo-600 bg-indigo-50 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition">
                  {service.icon}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{service.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reg Section */}
      <section className="bg-slate-900 text-slate-100 py-20 px-6">
        <div className="max-w-7xl mx-auto w-full text-center">
           <ShieldCheck size={48} className="text-indigo-400 mx-auto mb-6" />
           <h2 className="text-3xl font-serif font-bold mb-4">Regulatory Integrity</h2>
           <p className="text-slate-400 max-w-2xl mx-auto mb-8">
             We operate in strict adherence to the RBI Fair Practices Code. No hidden fees. Complete transparency on lender terms, conditions, and processing structures.
           </p>
           <div className="flex flex-wrap justify-center gap-4 text-sm font-medium text-slate-300">
              <a href="#" className="hover:text-white underline underline-offset-4">Fair Practices Code</a>
              <span className="text-slate-600">•</span>
              <a href="#" className="hover:text-white underline underline-offset-4">MITC Templates</a>
              <span className="text-slate-600">•</span>
              <a href="#" className="hover:text-white underline underline-offset-4">Grievance Redressal</a>
              <span className="text-slate-600">•</span>
              <a href="#" className="hover:text-white underline underline-offset-4">Fee Structure</a>
           </div>
        </div>
      </section>

      {isModalOpen && <LeadCaptureModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
}

function LeadCaptureModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded flex items-center justify-center font-mono">
              {step}
            </span>
            of 3
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-xl font-serif font-bold text-slate-900">Let's start with the basics.</h3>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name (As per PAN)</label>
                <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent" placeholder="e.g. Rahul Sharma" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Number</label>
                <div className="flex">
                  <span className="bg-slate-50 border border-slate-300 border-r-0 rounded-l-lg p-2.5 text-slate-500 font-mono">+91</span>
                  <input type="tel" className="flex-1 w-full border border-slate-300 rounded-r-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent font-mono" placeholder="90000 00000" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-xl font-serif font-bold text-slate-900">Employment & Income</h3>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Employment Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button className="border border-indigo-600 bg-indigo-50 text-indigo-700 rounded-lg p-3 text-sm font-medium transition cursor-pointer">Salaried</button>
                  <button className="border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg p-3 text-sm font-medium transition cursor-pointer">Self-Employed</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Monthly In-Hand Income</label>
                <div className="flex relative">
                  <span className="absolute left-3 top-2.5 text-slate-500 font-mono">₹</span>
                  <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 pl-8 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent font-mono" placeholder="100000" />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 text-center py-6">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-2xl font-serif font-bold text-slate-900">You're Pre-Qualified</h3>
              <p className="text-slate-600">We've generated an indicative offer based on soft bureau pulls. Your advisor will connect via WhatsApp shortly.</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          {step < 3 ? (
             <button 
               onClick={() => setStep(step + 1)}
               className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-lg font-medium transition flex items-center gap-2 w-full justify-center"
             >
               Continue <ChevronRight size={18} />
             </button>
          ) : (
             <button 
               onClick={() => {
                 onClose();
                 navigate('/applicant');
               }}
               className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium transition flex items-center gap-2 w-full justify-center"
             >
               Go to Applicant Portal
             </button>
          )}
        </div>
      </div>
    </div>
  );
}
