import React, { useState, useEffect } from 'react';
import { Play, Square, Clock, Activity, ChevronUp, ChevronDown } from 'lucide-react';

interface CaseOption {
  id: string;
  case_number: string;
  borrower_name: string;
}

export const TimeTracker: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0); // in seconds
  const [startTime, setStartTime] = useState<Date | null>(null);
  
  const [selectedCase, setSelectedCase] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [isBillable, setIsBillable] = useState(true);

  // Mock data for cases
  const cases: CaseOption[] = [
    { id: '11111111-1111-1111-1111-111111111111', case_number: 'AGA-2024-00123', borrower_name: 'Rahul Patil' },
    { id: '22222222-2222-2222-2222-222222222222', case_number: 'AGA-2024-00124', borrower_name: 'Sneha Sharma' },
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive) {
      interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const toggleTimer = async () => {
    if (!isActive) {
      if (!selectedCase) {
        alert("Please select a case to track time against.");
        return;
      }
      if (!taskDescription) {
        alert("Please enter a task description.");
        return;
      }
      setIsActive(true);
      setStartTime(new Date());
    } else {
      // Stop timer and log
      setIsActive(false);
      
      const endTime = new Date();
      const durationMinutes = Math.max(1, Math.ceil(timeElapsed / 60)); // Minimum 1 minute
      
      try {
        await fetch('/api/timesheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            org_id: '123e4567-e89b-12d3-a456-426614174000', // Mock Org ID
            case_id: selectedCase,
            profile_id: '987fcdeb-51a2-43d7-9012-3456789abcde', // Mock Advocate Profile
            task_description: taskDescription,
            start_time: startTime?.toISOString(),
            end_time: endTime.toISOString(),
            duration_minutes: durationMinutes,
            is_billable: isBillable,
            hourly_rate: 2500 // ₹2500/hr
          })
        });
        
        // Reset
        setTimeElapsed(0);
        setStartTime(null);
        setTaskDescription('');
      } catch (err) {
        console.error("Failed to save timesheet", err);
      }
    }
  };

  return (
    <div className={`fixed bottom-6 right-6 bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl overflow-hidden transition-all duration-300 z-50 ${isMinimized ? 'w-48 h-14' : 'w-80'}`}>
      {/* Header */}
      <div 
        className="bg-slate-800 px-4 py-3 flex items-center justify-between cursor-pointer border-b border-slate-700"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-2">
          <Clock className={`w-5 h-5 ${isActive ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
          <span className="font-semibold text-slate-200">
            {isMinimized ? formatTime(timeElapsed) : 'Time Tracker'}
          </span>
        </div>
        <button className="text-slate-400 hover:text-white transition-colors">
          {isMinimized ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {/* Body */}
      {!isMinimized && (
        <div className="p-4 space-y-4">
          <div className="text-center py-2">
            <span className={`text-4xl font-mono font-bold tracking-wider ${isActive ? 'text-emerald-400' : 'text-slate-300'}`}>
              {formatTime(timeElapsed)}
            </span>
          </div>

          <div className="space-y-3">
            <select 
              disabled={isActive}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              value={selectedCase}
              onChange={(e) => setSelectedCase(e.target.value)}
            >
              <option value="">-- Select Case --</option>
              {cases.map(c => (
                <option key={c.id} value={c.id}>{c.case_number} - {c.borrower_name}</option>
              ))}
            </select>

            <input 
              type="text"
              disabled={isActive}
              placeholder="What are you working on?"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
            />

            <div className="flex items-center gap-2 px-1">
              <input 
                type="checkbox" 
                id="billable"
                disabled={isActive}
                checked={isBillable}
                onChange={(e) => setIsBillable(e.target.checked)}
                className="rounded border-slate-600 text-emerald-500 focus:ring-emerald-500 disabled:opacity-50 bg-slate-800"
              />
              <label htmlFor="billable" className="text-sm text-slate-300">Billable (₹2500/hr)</label>
            </div>
          </div>

          <button 
            onClick={toggleTimer}
            className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
              isActive 
                ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/50' 
                : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
            }`}
          >
            {isActive ? (
              <><Square size={18} fill="currentColor" /> Stop Timer</>
            ) : (
              <><Play size={18} fill="currentColor" /> Start Timer</>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
