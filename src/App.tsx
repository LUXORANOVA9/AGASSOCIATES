import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { MarketingLanding } from './components/home/MarketingLanding';
import { ApplicantDashboard } from './components/applicant/ApplicantDashboard';
import { AdvisorCockpit } from './components/admin/AdvisorCockpit';
import { BankPortal } from './components/bank/BankPortal';
import { Building2, UserCircle2, Briefcase, Landmark } from 'lucide-react';

function Navigation() {
  const location = useLocation();
  const getLinkStyle = (path: string) => {
    const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
    return `flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`;
  };

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="bg-indigo-700 text-white p-1.5 rounded-lg">
          <Building2 size={24} />
        </div>
        <div className="flex flex-col">
          <h1 className="text-lg font-serif font-bold text-slate-900 leading-none">AG Associates</h1>
          <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">Home Loan Origination</span>
        </div>
      </div>
      <nav className="flex space-x-2 border p-1 rounded-lg bg-slate-50 border-slate-200">
        <Link to="/" className={getLinkStyle('/')}>
           🌐 Marketing
        </Link>
        <Link to="/applicant" className={getLinkStyle('/applicant')}>
           <UserCircle2 size={16} /> Applicant
        </Link>
        <Link to="/admin" className={getLinkStyle('/admin')}>
           <Briefcase size={16} /> Advisor
        </Link>
        <Link to="/bank" className={getLinkStyle('/bank')}>
           <Landmark size={16} /> Bank Portal
        </Link>
      </nav>
    </header>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
        <Navigation />
        <main className="flex-1 flex flex-col w-full">
          <Routes>
            <Route path="/" element={<MarketingLanding />} />
            <Route path="/applicant/*" element={<ApplicantDashboard />} />
            <Route path="/admin/*" element={<AdvisorCockpit />} />
            <Route path="/bank/*" element={<BankPortal />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
