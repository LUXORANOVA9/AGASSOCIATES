import React, { useState } from 'react';

export default function AGAssociatesLanding() {
  const [loanAmount, setLoanAmount] = useState('');
  const [stampDuty, setStampDuty] = useState<number | null>(null);
  const [error, setError] = useState('');

  const calculateDuty = () => {
    const amount = parseFloat(loanAmount);
    if (isNaN(amount) || amount < 0) {
      setError('Please enter a valid positive number');
      setStampDuty(null);
      return;
    }
    setError('');
    
    let duty = 0;
    if (amount <= 500000) {
      duty = amount * 0.001; // 0.1%
    } else {
      duty = amount * 0.002; // 0.2%
    }
    setStampDuty(duty);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  const bankingPartners = [
    'Kotak Mahindra Bank',
    'ICICI Bank',
    'HDFC Bank',
    'State Bank of India',
    'Axis Bank',
    'Bank of Baroda',
    'Punjab National Bank',
    'Union Bank of India'
  ];

  return (
    <div className="min-h-screen bg-[#000000] text-white font-sans selection:bg-amber-400 selection:text-black">
      {/* 1. Header & Navigation */}
      <header className="sticky top-0 z-50 border-b border-amber-400/20 bg-[#000000]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex justify-between items-center h-20">
            <div className="flex items-center gap-4">
              {/* Logo Placeholder */}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-bold text-black text-xl shadow-[0_0_15px_rgba(255,215,0,0.3)]">
                AG
              </div>
              <span className="text-2xl font-bold tracking-wider text-white">
                AG ASSOCIATES
              </span>
            </div>
            <div className="flex items-center gap-8">
              <a href="tel:+919699218421" className="flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors font-semibold text-lg tracking-wide">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                +91 9699218421
              </a>
            </div>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative py-24 lg:py-32 overflow-hidden">
          {/* Subtle glow effect behind hero */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-400/5 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8">
              Premier Legal Solutions in <br className="hidden md:block"/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-200">Thane, Maharashtra</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
              Empowering financial institutions and individuals with uncompromising diligence, modern technology, and unparalleled legal expertise.
            </p>
          </div>
        </section>

        {/* 2. Practice Areas Section */}
        <section className="py-24 bg-[#050505]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Core Practice Areas</h2>
              <div className="w-20 h-1 bg-amber-400 mx-auto rounded-full"></div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  title: 'Search & Title Reports',
                  desc: 'Comprehensive property background checks ensuring absolute clarity on ownership and encumbrances.'
                },
                {
                  title: 'Legal Vetting',
                  desc: 'Meticulous review of property documents and agreements to safeguard your financial interests.'
                },
                {
                  title: 'Mortgage Registration',
                  desc: 'End-to-end assistance in the creation and formal registration of mortgage deeds.'
                }
              ].map((area, idx) => (
                <div key={idx} className="group p-8 rounded-xl border border-amber-400/30 bg-[#0F0F11] hover:border-amber-400 transition-all duration-300 transform hover:-translate-y-2 shadow-lg hover:shadow-[0_10px_30px_rgba(255,215,0,0.1)]">
                  <div className="w-14 h-14 rounded-full bg-amber-400/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <div className="w-6 h-6 border-2 border-amber-400 rounded-sm rotate-45"></div>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">{area.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{area.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. Interactive Calculator Section */}
        <section className="py-24 relative border-y border-amber-400/10 bg-[#000000]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="p-8 md:p-12 rounded-2xl bg-[#0F0F11] border border-amber-400/30 shadow-[0_0_40px_rgba(255,215,0,0.05)] relative overflow-hidden">
              {/* Decorative background glow */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-400/10 rounded-full blur-3xl pointer-events-none"></div>

              <div className="text-center mb-10 relative z-10">
                <h2 className="text-3xl font-bold text-white mb-4">Maharashtra Stamp Duty Calculator</h2>
                <p className="text-gray-400">Instantly calculate stamp duty for your loan agreements.</p>
              </div>

              <div className="max-w-md mx-auto space-y-6 relative z-10">
                <div>
                  <label htmlFor="loanAmount" className="block text-sm font-medium text-gray-300 mb-2">
                    Loan Amount (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-lg">₹</span>
                    <input
                      type="number"
                      id="loanAmount"
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(e.target.value)}
                      className="w-full bg-[#000000] border border-gray-700 rounded-xl py-4 pl-10 pr-4 text-white text-lg placeholder-gray-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                      placeholder="e.g. 1000000"
                    />
                  </div>
                  {error && <p className="mt-2 text-sm text-red-400 font-medium">{error}</p>}
                </div>

                <button
                  onClick={calculateDuty}
                  className="w-full py-4 bg-amber-400 text-black font-bold text-lg rounded-xl hover:bg-amber-300 hover:shadow-[0_0_20px_rgba(255,215,0,0.4)] transition-all active:scale-[0.98]"
                >
                  Calculate Duty
                </button>

                {stampDuty !== null && !error && (
                  <div className="mt-8 p-6 rounded-xl bg-amber-400/10 border border-amber-400/40 text-center animate-in fade-in duration-500">
                    <p className="text-gray-300 text-sm mb-2 font-medium uppercase tracking-wider">Applicable Stamp Duty</p>
                    <p className="text-5xl font-extrabold text-amber-400 drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]">
                      {formatCurrency(stampDuty)}
                    </p>
                    <p className="text-sm text-gray-400 mt-4">
                      Based on <strong className="text-white">{parseFloat(loanAmount) <= 500000 ? '0.1%' : '0.2%'}</strong> rate for amounts {parseFloat(loanAmount) <= 500000 ? 'up to' : 'above'} ₹5,00,000
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 4. Expertise Bento Grid */}
        <section className="py-24 bg-[#000000]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-16 md:flex md:items-end md:justify-between">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Trusted Banking Partners</h2>
                <p className="text-gray-400 text-lg">Live tracking of ongoing legal vetting across institutions.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[160px]">
              {bankingPartners.map((partner, idx) => {
                // Bento Grid Asymmetry Logic
                let colSpan = "md:col-span-1";
                let rowSpan = "md:row-span-1";
                
                // Make the 1st and 6th items wide
                if (idx === 0 || idx === 5) {
                  colSpan = "md:col-span-2";
                }
                // Make the 2nd item tall
                if (idx === 1) {
                  rowSpan = "md:row-span-2";
                }
                // Make the 4th item large (tall and wide)
                if (idx === 3) {
                  colSpan = "md:col-span-2";
                  rowSpan = "md:row-span-2";
                }

                return (
                  <div 
                    key={idx} 
                    className={`
                      ${colSpan} ${rowSpan} 
                      relative group overflow-hidden rounded-xl 
                      bg-black/20 backdrop-blur-md 
                      border border-amber-400/20 hover:border-amber-400/60 
                      p-6 flex flex-col justify-between 
                      transition-all duration-500 hover:bg-[#0F0F11]/80
                    `}
                  >
                    {/* Live Status Indicator */}
                    <div className="flex items-center justify-end gap-2 z-10">
                      <span className="text-xs font-bold tracking-widest text-amber-400/90">LIVE</span>
                      <div className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 shadow-[0_0_8px_rgba(255,215,0,0.8)]"></span>
                      </div>
                    </div>

                    <div className="mt-auto z-10">
                      <div className="w-10 h-10 mb-4 rounded-lg bg-[#111] flex items-center justify-center border border-amber-400/10 group-hover:border-amber-400/40 transition-colors">
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors">
                        {partner}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">Active Cases Processing</p>
                    </div>

                    {/* Decorative gradient blob */}
                    <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-amber-400/5 rounded-full blur-2xl group-hover:bg-amber-400/10 transition-all duration-500 pointer-events-none"></div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-amber-400/20 bg-[#000000] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-white font-bold text-2xl tracking-wider">
            AG <span className="text-amber-400">ASSOCIATES</span>
          </div>
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} AG Associates, Thane. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
