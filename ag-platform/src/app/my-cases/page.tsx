"use client";


import { motion } from 'framer-motion';

export default function MobileFieldExecutivePWA() {
  const offlineQueueCount = 3;

  return (
    <div className="min-h-screen bg-black text-white p-4 font-['DM_Sans']">
      
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-['Playfair_Display'] text-yellow-400">My Cases</h1>
          <p className="text-gray-400 text-sm">SRO Thane (W)</p>
        </div>
        <div className="h-12 w-12 rounded-full bg-gray-900 border border-yellow-400 flex items-center justify-center relative shadow-[0_0_15px_rgba(250,204,21,0.2)]">
          <span className="text-yellow-400 font-bold">{offlineQueueCount}</span>
          <div className="absolute top-0 right-0 h-3 w-3 bg-red-500 rounded-full border-2 border-black animate-pulse" />
        </div>
      </header>

      {/* Offline Alert */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900 border-l-4 border-yellow-400 p-4 mb-6 rounded-r-lg"
      >
        <p className="text-yellow-400 font-bold text-sm">OFFLINE MODE ACTIVE</p>
        <p className="text-gray-400 text-xs mt-1">Scans will sync when connection is restored.</p>
      </motion.div>

      {/* Case List */}
      <div className="space-y-4">
        {[1, 2, 3].map((caseItem) => (
          <motion.div 
            key={caseItem}
            whileTap={{ scale: 0.97 }}
            className="bg-gray-900 p-5 rounded-xl border border-gray-800 touch-pan-y"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <div className="flex justify-between items-start mb-3">
              <h2 className="text-green-400 font-bold font-['JetBrains_Mono'] tracking-tight">
                KOTAK-NOI-{8000 + caseItem}
              </h2>
              <span className="bg-yellow-400/10 text-yellow-400 text-xs px-2 py-1 rounded font-bold">
                PENDING UPLOAD
              </span>
            </div>
            <p className="text-gray-300 text-sm font-bold mb-4">Rajesh Kumar Sharma</p>
            
            <button className="w-full h-12 bg-yellow-400 text-black font-bold rounded-lg flex items-center justify-center space-x-2 active:bg-yellow-500 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              <span>Scan Challan</span>
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
