'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { CheckCircle } from 'lucide-react';

const steps = [
  {
    time: '00:00',
    label: 'Client Ping',
    agent: 'Client',
    desc: 'Requests rent agreement via WhatsApp.',
    isEnd: false,
  },
  {
    time: '00:16',
    label: 'Vyasa',
    agent: 'Verification',
    desc: 'Reads uploaded Aadhaar, checks fraud, extracts JSON.',
    isEnd: false,
  },
  {
    time: '00:17',
    label: 'Drafter',
    agent: 'Drafting',
    desc: 'Queries vector DB; generates 15-page legal document.',
    isEnd: false,
  },
  {
    time: '00:18',
    label: 'Auditor',
    agent: 'Audit',
    desc: 'Confirms deposit amounts match perfectly.',
    isEnd: false,
  },
  {
    time: '00:19',
    label: 'Executor',
    agent: 'Execution',
    desc: 'Generates final PDF, triggers Aadhaar E-Sign OTP.',
    isEnd: false,
  },
  {
    time: '00:25',
    label: 'Done',
    agent: 'Filed ✓',
    desc: 'Client enters OTP. NOI filed automatically. Zero human intervention.',
    isEnd: true,
  },
];

export default function WorkflowTimeline() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <div ref={ref} className="py-20 px-6 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.65 }}
        className="text-center mb-16"
      >
        <p className="text-accent-green font-mono text-xs uppercase tracking-[0.25em] mb-3">
          End-to-End Automation
        </p>
        <h3 className="text-3xl sm:text-4xl font-bold text-white">
          25-Minute Intake-to-Filing Workflow
        </h3>
        <p className="text-gray-500 mt-3 text-base">
          WhatsApp message → legal PDF → government NeSL filing. Zero human involvement.
        </p>
      </motion.div>

      {/* Timeline connector line (desktop) */}
      <div className="relative">
        <motion.div
          initial={{ scaleX: 0 }}
          animate={isInView ? { scaleX: 1 } : {}}
          transition={{ duration: 1.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="absolute top-11 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-blue/30 to-accent-green/30 origin-left hidden md:block"
          style={{ top: '44px' }}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-6 md:gap-3">
          {steps.map((step, i) => (
            <motion.div
              key={step.time}
              initial={{ opacity: 0, y: 28 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.3 + i * 0.13, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center text-center"
            >
              {/* Node bubble */}
              <motion.div
                whileHover={{ scale: 1.12 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className={`relative w-[88px] h-[88px] rounded-full flex flex-col items-center justify-center mb-4 z-10 ${
                  step.isEnd
                    ? 'bg-accent-green/15 border-2 border-accent-green shadow-lg shadow-accent-green/20'
                    : 'glass border border-accent-blue/30'
                }`}
              >
                {step.isEnd && (
                  <CheckCircle className="w-4 h-4 text-accent-green absolute -top-1.5 -right-1.5" />
                )}
                <span className={`font-mono text-xs font-bold ${step.isEnd ? 'text-accent-green' : 'text-accent-blue'}`}>
                  {step.time}
                </span>
                <span className="text-gray-300 text-[10px] mt-0.5 font-medium">{step.agent}</span>
              </motion.div>

              <h4 className="text-white font-semibold text-sm mb-1.5">{step.label}</h4>
              <p className="text-gray-500 text-xs leading-relaxed px-1">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
