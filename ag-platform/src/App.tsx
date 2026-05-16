import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { MarketingLanding } from './components/home/MarketingLanding';
import { ApplicantDashboard } from './components/applicant/ApplicantDashboard';
import { AdvisorCockpit } from './components/admin/AdvisorCockpit';
import { BankPortal } from './components/bank/BankPortal';
import { LoginPage } from './components/auth/LoginPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { WorkforceControl } from './components/admin/WorkforceControl';
import { useAuthStore } from './store/useAuthStore';
import { Building2, UserCircle2, Briefcase, Landmark, LogOut } from 'lucide-react';
import { TimeTracker } from './components/collaboration/TimeTracker';

function Navigation() {
  const location = useLocation();
  const { user, signOut } = useAuthStore();
  
  const getLinkStyle = (path: string) => {
    const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
    return `flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`;
  };

  if (location.pathname === '/login') return null;

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
      <nav className="flex items-center space-x-2 border p-1 rounded-lg bg-slate-50 border-slate-200">
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
        {user && (
          <button 
            onClick={() => signOut()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md text-red-600 hover:bg-red-50 transition"
          >
            <LogOut size={16} /> Logout
          </button>
        )}
      </nav>
    </header>
  );
}

function App() {
  const initializeAuth = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
        <Navigation />
        <main className="flex-1 flex flex-col w-full">
          <Routes>
            <Route path="/" element={<MarketingLanding />} />
            <Route path="/login" element={<LoginPage />} />
            
            <Route path="/applicant/*" element={
              <ProtectedRoute allowedRoles={['applicant', 'admin']}>
                <ApplicantDashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/admin/*" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Routes>
                  <Route index element={<AdvisorCockpit />} />
                  <Route path="workforce" element={<WorkforceControl />} />
                </Routes>
              </ProtectedRoute>
            } />
            
            <Route path="/bank/*" element={
              <ProtectedRoute allowedRoles={['staff', 'admin']}>
                <BankPortal />
              </ProtectedRoute>
            } />

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        
        {/* Global Floating Time Tracker for Advocates */}
        <TimeTracker />
      </div>
    </BrowserRouter>
  );
}

export default App;
