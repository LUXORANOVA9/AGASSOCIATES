'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Database, Zap, GitBranch, RefreshCw } from 'lucide-react';

const elements = [
  {
    icon: Database,
    label: 'Local Vector Memory',
    desc: 'Captures successful executions, permanently upgrading the system with every filing.',
    color: 'blue',
  },
  {
    icon: Zap,
    label: 'Elite Prompting',
    desc: 'Ensures 100% precision and zero behavioral drift. The $7T methodology in every prompt.',
    color: 'purple',
  },
  {
    icon: GitBranch,
    label: 'LangGraph Orchestration',
    desc: 'Enforces rigid operational loops that never tire. Deterministic, fault-tolerant, infinite.',
    color: 'green',
  },
];

const colorStyles: Record<string, { border: string; iconWrap: string; icon: string }> = {
  blue: {
    border: 'border-accent-blue/25',
    iconWrap: 'bg-accent-blue/10 border border-accent-blue/25',
    icon: 'text-accent-blue',
  },
  purple: {
    border: 'border-accent-purple/25',
    iconWrap: 'bg-accent-purple/10 border border-accent-purple/25',
    icon: 'text-accent-purple',
  },
  green: {
    border: 'border-accent-green/25',
    iconWrap: 'bg-accent-green/10 border border-accent-green/25',
    icon: 'text-accent-green',
  },
};

export default function FlywheelSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="py-32 px-6 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] orb bg-accent-purple/6" />
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <p className="text-accent-purple font-mono text-xs uppercase tracking-[0.25em] mb-5">Synthesis</p>
          <h2 className="text-4xl sm:text-5xl font-bold text-white">The Blitzscaling Flywheel</h2>
          <p className="text-gray-400 mt-4 text-base sm:text-lg max-w-xl mx-auto">
            Three interlocking forces that compound with every transaction — driving marginal cost toward zero.
          </p>
        </motion.div>

        {/* Flywheel elements */}
        <div className="flex flex-col md:flex-row items-stretch gap-5 mb-10">
          {elements.map((el, i) => {
            const styles = colorStyles[el.color];
            const Icon = el.icon;
            return (
              <motion.div
                key={el.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={isInView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.55, delay: i * 0.13 }}
                whileHover={{ scale: 1.03, y: -4 }}
                className={`flex-1 glass rounded-2xl p-7 border ${styles.border} text-center transition-all duration-300`}
              >
                {/* Arrow connector (desktop) */}
                <div className="relative">
                  <div className={`w-14 h-14 rounded-full ${styles.iconWrap} flex items-center justify-center mx-auto mb-5`}>
                    <Icon className={`w-7 h-7 ${styles.icon}`} />
                  </div>
                </div>
                <h3 className="text-white font-bold text-base mb-2">{el.label}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{el.desc}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Center flywheel label */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.55 }}
          className="flex items-center justify-center gap-3 mb-10"
        >
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-accent-purple/30" />
          <div className="flex items-center gap-2 glass px-4 py-2 rounded-full border border-accent-purple/20">
            <RefreshCw className="w-4 h-4 text-accent-purple animate-spin-slow" />
            <span className="text-gray-400 text-xs font-mono uppercase tracking-wider">Deterministic State Machine</span>
          </div>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-accent-purple/30" />
        </motion.div>

        {/* Quote */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.6 }}
          className="glass rounded-2xl p-8 border border-accent-purple/20 text-center"
        >
          <p className="text-white text-lg sm:text-xl font-medium leading-relaxed">
            "Agentic AI is not a chatbot. It is a perfectly loyal, hyper-efficient state machine.
            With every automated transaction, the database grows smarter, driving marginal costs to zero
            and rendering human-based competition obsolete."
          </p>
        </motion.div>
      </div>
    </section>
  );
}
