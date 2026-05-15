'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Globe, Brain, Database, GitMerge } from 'lucide-react';

const components = [
  {
    icon: Globe,
    label: 'The Gateway',
    subtitle: 'Execution',
    tech: 'FastAPI',
    desc: 'High-performance routing connecting the backend to the outside world. Handles all external requests and webhook ingestion.',
    color: 'blue',
  },
  {
    icon: Brain,
    label: 'The Brain',
    subtitle: 'Reasoning',
    tech: 'Qwen 2.5 / Llama 3 · Ollama',
    desc: 'Fine-tuned local models for complex reasoning without exposing client data to third-party APIs. 100% private.',
    color: 'purple',
  },
  {
    icon: Database,
    label: 'The Memory',
    subtitle: 'RAG',
    tech: 'PostgreSQL + pgvector',
    desc: 'Stores millions of legal precedents and successful filings. Vector similarity search retrieves the closest legal template instantly.',
    color: 'green',
  },
  {
    icon: GitMerge,
    label: 'The Nervous System',
    subtitle: 'Orchestration',
    tech: 'LangGraph · n8n',
    desc: 'Enforcing rigid, fault-tolerant agent loops and webhook routing. The deterministic state machine that never drifts.',
    color: 'amber',
  },
];

const colorStyles: Record<string, { border: string; iconWrap: string; icon: string; badge: string; glow: string }> = {
  blue: {
    border: 'border-accent-blue/20 hover:border-accent-blue/45',
    iconWrap: 'bg-accent-blue/10 border border-accent-blue/25',
    icon: 'text-accent-blue',
    badge: 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20',
    glow: 'hover:shadow-accent-blue/10',
  },
  purple: {
    border: 'border-accent-purple/20 hover:border-accent-purple/45',
    iconWrap: 'bg-accent-purple/10 border border-accent-purple/25',
    icon: 'text-accent-purple',
    badge: 'bg-accent-purple/10 text-accent-purple border border-accent-purple/20',
    glow: 'hover:shadow-accent-purple/10',
  },
  green: {
    border: 'border-accent-green/20 hover:border-accent-green/45',
    iconWrap: 'bg-accent-green/10 border border-accent-green/25',
    icon: 'text-accent-green',
    badge: 'bg-accent-green/10 text-accent-green border border-accent-green/20',
    glow: 'hover:shadow-accent-green/10',
  },
  amber: {
    border: 'border-accent-amber/20 hover:border-accent-amber/45',
    iconWrap: 'bg-accent-amber/10 border border-accent-amber/25',
    icon: 'text-accent-amber',
    badge: 'bg-accent-amber/10 text-accent-amber border border-accent-amber/20',
    glow: 'hover:shadow-accent-amber/10',
  },
};

export default function TechStack() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="tech" ref={ref} className="py-32 px-6 relative overflow-hidden">
      {/* Blueprint background */}
      <div className="absolute inset-0 blueprint-grid opacity-40 pointer-events-none" />

      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] orb bg-accent-blue/5" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-16"
        >
          <p className="text-accent-blue font-mono text-xs uppercase tracking-[0.25em] mb-5">Open-Source Stack</p>
          <h2 className="text-4xl sm:text-5xl font-bold text-white">
            The 2026 Agentic Tech Stack
          </h2>
          <p className="text-gray-400 mt-4 text-base sm:text-lg max-w-xl mx-auto">
            Anatomical architecture — every layer has a single purpose. No vendor lock-in. Zero cloud dependency.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {components.map((comp, i) => {
            const styles = colorStyles[comp.color];
            const Icon = comp.icon;
            return (
              <motion.div
                key={comp.label}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={isInView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ scale: 1.02, y: -3 }}
                className={`glass rounded-2xl p-7 border hover:shadow-xl transition-all duration-300 ${styles.border} ${styles.glow}`}
              >
                <div className="flex items-start gap-5">
                  <div className={`p-4 rounded-xl ${styles.iconWrap} flex-shrink-0`}>
                    <Icon className={`w-7 h-7 ${styles.icon}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h3 className="text-white font-bold text-lg">{comp.label}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-mono border ${styles.badge}`}>
                        {comp.subtitle}
                      </span>
                    </div>
                    <p className={`text-sm font-mono mb-3 ${styles.icon} opacity-70`}>{comp.tech}</p>
                    <p className="text-gray-400 text-sm leading-relaxed">{comp.desc}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
