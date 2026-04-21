'use client';

import { useState, useEffect } from 'react';
import { Activity, FileText, CheckCircle, Clock, Brain, Database, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DashboardStatus {
  total_templates: number;
  active_agents: number;
  system_status: string;
  recent_activities?: Array<{
    action: string;
    timestamp: string;
    details: string;
  }>;
}

interface WorkflowState {
  current_step: 'idle' | 'intake' | 'drafting' | 'auditing' | 'complete' | 'revision';
  progress: number;
  agent_active: string;
  last_update: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

export default function Dashboard() {
  const [status, setStatus] = useState<DashboardStatus | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowState>({
    current_step: 'idle',
    progress: 0,
    agent_active: 'None',
    last_update: new Date().toISOString(),
  });
  const [loading, setLoading] = useState(true);
  const [neslStatus, setNeslStatus] = useState<'idle' | 'processing' | 'filed'>('idle');
  const [transactionId, setTransactionId] = useState<string | null>(null);

  // Poll dashboard status every 3 seconds
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/dashboard/status`);
        if (response.ok) {
          const data = await response.json();
          setStatus(data);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  // Simulate workflow progression for demo
  useEffect(() => {
    const workflowSteps: Array<WorkflowState['current_step']> = [
      'intake',
      'drafting',
      'auditing',
      'complete',
    ];
    
    let currentIndex = 0;
    const progressInterval = setInterval(() => {
      if (currentIndex < workflowSteps.length) {
        const step = workflowSteps[currentIndex];
        setWorkflow({
          current_step: step,
          progress: ((currentIndex + 1) / workflowSteps.length) * 100,
          agent_active: getAgentForStep(step),
          last_update: new Date().toISOString(),
        });
        currentIndex++;
      } else {
        // Reset after completion for demo purposes
        setTimeout(() => {
          currentIndex = 0;
        }, 5000);
      }
    }, 4000);

    return () => clearInterval(progressInterval);
  }, []);

  // Simulate NeSL filing
  useEffect(() => {
    if (workflow.current_step === 'complete') {
      simulateNeslFiling();
    }
  }, [workflow.current_step]);

  const getAgentForStep = (step: WorkflowState['current_step']): string => {
    switch (step) {
      case 'intake': return 'Aisha (Intake)';
      case 'drafting': return 'Drafter (Legal Architect)';
      case 'auditing': return 'Auditor (QA)';
      case 'revision': return 'Drafter (Revision)';
      case 'complete': return 'All Agents';
      default: return 'None';
    }
  };

  const simulateNeslFiling = async () => {
    setNeslStatus('processing');
    try {
      const response = await fetch(`${API_BASE_URL}/api/nesl/execute`, { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        setTransactionId(data.transaction_id);
        setNeslStatus('filed');
      }
    } catch (error) {
      console.error('NeSL filing failed:', error);
      setNeslStatus('idle');
    }
  };

  const getStatusColor = (step: WorkflowState['current_step']) => {
    switch (step) {
      case 'intake': return 'text-accent-blue glow-blue';
      case 'drafting': return 'text-accent-purple glow-purple';
      case 'auditing': return 'text-accent-orange glow-orange';
      case 'complete': return 'text-accent-green glow-green';
      case 'revision': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getStepIcon = (step: WorkflowState['current_step']) => {
    switch (step) {
      case 'intake': return <Brain className="w-6 h-6" />;
      case 'drafting': return <FileText className="w-6 h-6" />;
      case 'auditing': return <CheckCircle className="w-6 h-6" />;
      case 'complete': return <Zap className="w-6 h-6" />;
      case 'revision': return <Clock className="w-6 h-6" />;
      default: return <Activity className="w-6 h-6" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-accent-green border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg p-8">
      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold text-white mb-2">AG Associates AI</h1>
        <p className="text-gray-400">Real-time Agent Workflow Dashboard</p>
      </motion.header>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="glass p-6 rounded-xl glow-blue"
        >
          <div className="flex items-center gap-4">
            <Database className="w-8 h-8 text-accent-blue" />
            <div>
              <p className="text-gray-400 text-sm">Templates</p>
              <p className="text-2xl font-bold text-white">{status?.total_templates || 0}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="glass p-6 rounded-xl glow-purple"
        >
          <div className="flex items-center gap-4">
            <Brain className="w-8 h-8 text-accent-purple" />
            <div>
              <p className="text-gray-400 text-sm">Active Agents</p>
              <p className="text-2xl font-bold text-white">{status?.active_agents || 0}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="glass p-6 rounded-xl glow-green"
        >
          <div className="flex items-center gap-4">
            <Activity className="w-8 h-8 text-accent-green" />
            <div>
              <p className="text-gray-400 text-sm">System Status</p>
              <p className="text-lg font-bold text-accent-green capitalize">{status?.system_status || 'Unknown'}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className={`glass p-6 rounded-xl ${neslStatus === 'filed' ? 'glow-green' : ''}`}
        >
          <div className="flex items-center gap-4">
            <Zap className={`w-8 h-8 ${neslStatus === 'filed' ? 'text-accent-green' : 'text-gray-400'}`} />
            <div>
              <p className="text-gray-400 text-sm">NeSL Status</p>
              <p className="text-lg font-bold text-white capitalize">{neslStatus}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Workflow Progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass p-8 rounded-xl mb-8"
      >
        <h2 className="text-2xl font-bold text-white mb-6">Current Workflow</h2>
        
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>Progress</span>
            <span>{Math.round(workflow.progress)}%</span>
          </div>
          <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${workflow.progress}%` }}
              transition={{ duration: 0.5 }}
              className={`h-full ${getStepColor(workflow.current_step).split(' ')[0]}`}
              style={{ backgroundColor: 'currentColor' }}
            />
          </div>
        </div>

        {/* Step Indicators */}
        <div className="grid grid-cols-5 gap-4">
          {['intake', 'drafting', 'auditing', 'nesl', 'complete'].map((step, index) => {
            const isActive = workflow.current_step === step || (step === 'nesl' && neslStatus !== 'idle');
            const isCompleted = index < ['intake', 'drafting', 'auditing', 'nesl', 'complete'].indexOf(workflow.current_step);
            
            return (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex flex-col items-center p-4 rounded-lg ${
                  isActive ? 'glass-strong' : 'bg-gray-800/50'
                }`}
              >
                <div className={`${isActive ? getStatusColor(workflow.current_step) : 'text-gray-500'} mb-2`}>
                  {step === 'nesl' ? <Zap className="w-6 h-6" /> : getStepIcon(step as WorkflowState['current_step'])}
                </div>
                <span className="text-sm text-gray-300 capitalize">{step}</span>
                {isCompleted && <CheckCircle className="w-4 h-4 text-accent-green mt-1" />}
              </motion.div>
            );
          })}
        </div>

        {/* Current Agent */}
        <div className="mt-8 p-4 glass rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Active Agent:</span>
            <motion.span
              key={workflow.agent_active}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`font-semibold ${getStatusColor(workflow.current_step)}`}
            >
              {workflow.agent_active}
            </motion.span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-gray-400">Last Update:</span>
            <span className="text-gray-300 text-sm">
              {new Date(workflow.last_update).toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Transaction ID */}
        <AnimatePresence>
          {transactionId && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6 p-4 glass-strong rounded-lg border border-accent-green"
            >
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-accent-green" />
                <div>
                  <p className="text-accent-green font-semibold">NeSL Filed Successfully</p>
                  <p className="text-gray-300 text-sm">Transaction ID: {transactionId}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Recent Activities */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="glass p-6 rounded-xl"
      >
        <h2 className="text-2xl font-bold text-white mb-4">Recent Activities</h2>
        <div className="space-y-3">
          {status?.recent_activities?.map((activity, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-lg"
            >
              <Clock className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <p className="text-white font-medium">{activity.action.replace(/_/g, ' ').toUpperCase()}</p>
                <p className="text-gray-400 text-sm">{activity.details}</p>
              </div>
              <span className="text-gray-500 text-xs">
                {new Date(activity.timestamp).toLocaleTimeString()}
              </span>
            </motion.div>
          )) || (
            <p className="text-gray-400 text-center py-4">No recent activities</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
