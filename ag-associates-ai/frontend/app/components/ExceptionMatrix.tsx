'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Zap, Users, AlertTriangle } from 'lucide-react';

const tiers = [
  {
    number: 3,
    label: 'Tier 3: Hard Halt',
    sublabel: 'Executive Level',
    icon: AlertTriangle,
    color: 'red',
    desc: 'Calculated 0.3% Stamp Duty does not match bank deposit. LangGraph freezes the node and sends an immediate critical alert to the owner.',
    width: 'max-w-sm',
  },
  {
    number: 2,
    label: 'Tier 2: Human-in-the-Loop',
    sublabel: 'Client Level',
    icon: Users,
    color: 'amber',
    desc: 'Missing PAN detected. Aisha automatically pings the client on WhatsApp to upload. The executive is never bothered.',
    width: 'max-w-lg',
  },
  {
    number: 1,
    label: 'Tier 1: Silent Self-Correction',
    sublabel: 'Code Level',
    icon: Zap,
    color: 'green',
    desc: 'LangGraph catches formatting errors and loops back to the Drafter node. Zero notifications sent. Fully invisible to all parties.',
    width: 'max-w-2xl',
  },
];

const colorStyles: Record<string, { border: string; iconWrap: string; icon: string; badge: string }> = {
  red: {
    border: 'border-red-500/30',
    iconWrap: 'bg-red-500/10 border border-red-500/25',
    icon: 'text-red-400',
    badge: 'bg-red-500/10 text-red-400 border border-red-500/25',
  },
  amber: {
    border: 'border-accent-amber/30',
    iconWrap: 'bg-accent-amber/10 border border-accent-amber/25',
    icon: 'text-accent-amber',
    badge: 'bg-accent-amber/10 text-accent-amber border border-accent-amber/25',
  },
  green: {
    border: 'border-accent-green/30',
    iconWrap: 'bg-accent-green/10 border border-accent-green/25',
    icon: 'text-accent-green',
    badge: 'bg-accent-green/10 text-accent-green border border-accent-green/25',
  },
};

export default function ExceptionMatrix() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="py-32 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-16"
        >
          <p className="text-accent-orange font-mono text-xs uppercase tracking-[0.25em] mb-5">Guardrails</p>
          <h2 className="text-4xl sm:text-5xl font-bold text-white">The 3-Tier Exception Matrix</h2>
          <p className="text-gray-400 mt-4 text-base sm:text-lg max-w-xl mx-auto">
            Designed for failure with a hierarchical escalation model. Goal: isolate the executive from operational friction, escalating only mathematical anomalies.
          </p>
        </motion.div>

        {/* Inverted pyramid — tier 3 (top/smallest) first */}
        <div className="flex flex-col items-center gap-3">
          {tiers.map((tier, i) => {
            const styles = colorStyles[tier.color];
            const Icon = tier.icon;
            return (
              <motion.div
                key={tier.number}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.14 }}
                className={`w-full ${tier.width} glass rounded-2xl p-6 border ${styles.border}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-xl ${styles.iconWrap} flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${styles.icon}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-white font-bold text-sm">{tier.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-mono border ${styles.badge}`}>
                        {tier.sublabel}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm leading-relaxed">{tier.desc}</p>
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
