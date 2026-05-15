import React, { useState, useEffect } from 'react';
import { Camera, Upload, WifiOff, CheckCircle, Clock } from 'lucide-react';

interface QueueItem {
  id: string;
  caseId: string;
  timestamp: number;
  dataUrl: string;
  status: 'pending' | 'syncing' | 'completed';
}

export const FieldApp: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState('');

  // Setup online/offline listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Load queue from localStorage
    const savedQueue = localStorage.getItem('field_offline_queue');
    if (savedQueue) {
      setQueue(JSON.parse(savedQueue));
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save queue to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('field_offline_queue', JSON.stringify(queue));
  }, [queue]);

  // Attempt sync when coming online
  useEffect(() => {
    if (isOnline && queue.some(item => item.status === 'pending')) {
      syncQueue();
    }
  }, [isOnline]);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedCaseId) {
      alert("Please select a case first");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const newItem: QueueItem = {
        id: Math.random().toString(36).substr(2, 9),
        caseId: selectedCaseId,
        timestamp: Date.now(),
        dataUrl: reader.result as string,
        status: 'pending'
      };
      
      setQueue(prev => [...prev, newItem]);
      
      if (isOnline) {
        // Just triggering effect
        setTimeout(syncQueue, 100);
      }
    };
    reader.readAsDataURL(file);
  };

  const syncQueue = async () => {
    const pendingItems = queue.filter(item => item.status === 'pending');
    
    for (const item of pendingItems) {
      // Mark as syncing
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'syncing' } : q));
      
      try {
        // Simulate API call to Supabase / Backend Document Vault
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Mark as completed
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'completed' } : q));
        
        // Optionally update case state to "DOCUMENTS_COLLECTED"
        if (isOnline) {
            try {
                await fetch(`/api/cases/${item.caseId}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'DOCUMENTS_COLLECTED', notes: 'Documents synced from field app' })
                });
            } catch (e) {
                console.error("Failed to update case status via sync");
            }
        }
      } catch (error) {
        // Revert to pending
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'pending' } : q));
      }
    }
    
    // Clear completed items after 3 seconds
    setTimeout(() => {
      setQueue(prev => prev.filter(q => q.status !== 'completed'));
    }, 3000);
  };

  return (
    <div className="max-w-md mx-auto bg-slate-900 min-h-screen text-white p-4 font-sans">
      <div className="flex items-center justify-between mb-6 border-b border-slate-700 pb-4">
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          Field Executive PWA
        </h1>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
          {isOnline ? <CheckCircle size={16} /> : <WifiOff size={16} />}
          {isOnline ? 'Online' : 'Offline Mode'}
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-4 shadow-lg mb-6 border border-slate-700">
        <label className="block text-sm font-medium text-slate-400 mb-2">Select Active Case</label>
        <select 
          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={selectedCaseId}
          onChange={(e) => setSelectedCaseId(e.target.value)}
        >
          <option value="">-- Select Case --</option>
          <option value="AGA-2024-00123">AGA-2024-00123 (Rahul Patil)</option>
          <option value="AGA-2024-00124">AGA-2024-00124 (Sneha Sharma)</option>
          <option value="AGA-2024-00125">AGA-2024-00125 (Amit Desai)</option>
        </select>
      </div>

      <div className="mb-8">
        <label 
          htmlFor="camera-upload" 
          className="flex flex-col items-center justify-center w-full h-48 bg-blue-600 hover:bg-blue-500 rounded-2xl cursor-pointer transition-colors shadow-lg shadow-blue-900/50"
        >
          <Camera size={48} className="mb-3" />
          <span className="text-lg font-semibold">Scan Document</span>
          <span className="text-blue-200 text-sm mt-1">Uses device camera</span>
        </label>
        <input 
          id="camera-upload" 
          type="file" 
          accept="image/*" 
          capture="environment" 
          className="hidden" 
          onChange={handleCapture}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center justify-between">
          <span>Upload Queue</span>
          <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-xs">{queue.length} items</span>
        </h2>
        
        {queue.length === 0 ? (
          <div className="text-center py-8 text-slate-500 bg-slate-800/50 rounded-xl border border-slate-700/50">
            Queue is empty
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map(item => (
              <div key={item.id} className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-12 h-12 bg-slate-700 rounded overflow-hidden flex-shrink-0 border border-slate-600">
                    <img src={item.dataUrl} alt="scan" className="w-full h-full object-cover" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-medium truncate">{item.caseId}</p>
                    <p className="text-xs text-slate-400">{new Date(item.timestamp).toLocaleTimeString()}</p>
                  </div>
                </div>
                
                <div className="flex-shrink-0">
                  {item.status === 'pending' && <Clock className="text-amber-400" size={20} />}
                  {item.status === 'syncing' && <Upload className="text-blue-400 animate-bounce" size={20} />}
                  {item.status === 'completed' && <CheckCircle className="text-emerald-400" size={20} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
