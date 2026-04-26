'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { X, Check } from 'lucide-react';

const rows = [
  {
    dimension: 'Scaling Mechanism',
    traditional: 'Adding human clerks',
    agentic: 'Spinning up Docker containers',
  },
  {
    dimension: 'Cost per Execution',
    traditional: 'Monthly salaries + overhead',
    agentic: 'Pennies in local GPU compute',
  },
  {
    dimension: 'Data Privacy',
    traditional: 'Vulnerable to human leaks',
    agentic: '100% Local via self-hosted models',
  },
  {
    dimension: 'Error Rate',
    traditional: 'High fatigue-driven mistakes',
    agentic: 'Deterministic, mathematical compliance',
  },
  {
    dimension: 'Speed',
    traditional: 'Hours or days',
    agentic: 'Milliseconds',
  },
];

export default function ManifestoSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="manifesto" ref={ref} className="py-32 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-20"
        >
          <p className="text-accent-blue font-mono text-xs uppercase tracking-[0.25em] mb-5">
            The Limits of Linear Scaling
          </p>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white max-w-3xl mx-auto leading-tight">
            Linear scaling breaks under pressure.{' '}
            <span className="gradient-text">Exponential scaling thrives on it.</span>
          </h2>
        </motion.div>

        {/* Comparison table */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="glass rounded-2xl overflow-hidden border border-white/[0.06]"
        >
          {/* Table header */}
          <div className="grid grid-cols-3 px-6 py-4 border-b border-white/[0.06] bg-white/[0.02]">
            <span className="text-gray-500 text-xs font-mono uppercase tracking-widest">Dimension</span>
            <span className="text-red-400/80 text-xs font-mono uppercase tracking-widest flex items-center gap-1.5">
              <X className="w-3.5 h-3.5" /> Traditional
            </span>
            <span className="text-accent-green text-xs font-mono uppercase tracking-widest flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> Agentic
            </span>
          </div>

          {/* Rows */}
          {rows.map((row, i) => (
            <motion.div
              key={row.dimension}
              initial={{ opacity: 0, x: -24 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.45, delay: 0.35 + i * 0.08 }}
              className="grid grid-cols-3 px-6 py-5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.025] transition-colors duration-200"
            >
              <span className="text-white font-medium text-sm">{row.dimension}</span>
              <span className="text-gray-500 text-sm pr-4">{row.traditional}</span>
              <span className="text-accent-green text-sm font-medium">{row.agentic}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom callout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-8 text-center"
        >
          <p className="text-gray-500 text-sm font-mono">
            — Agentic operations replace headcount with compute
          </p>
        </motion.div>
      </div>
    </section>
  );
}
