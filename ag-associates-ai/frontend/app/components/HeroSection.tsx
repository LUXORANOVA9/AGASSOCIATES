'use client';

import { motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';

const taglineWords = ['Building', 'Autonomous', 'AI', 'Workflows', 'for', 'Blitzscaling.'];

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden blueprint-grid">
      {/* Ambient glow orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] orb bg-accent-blue/8 animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] orb bg-accent-purple/8 animate-float-delayed" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] orb bg-accent-amber/5 animate-float" style={{ animationDelay: '3s' }} />
      </div>

      {/* Decorative corner lines */}
      <div className="absolute top-24 left-10 w-16 h-16 border-l-2 border-t-2 border-accent-blue/20 pointer-events-none" />
      <div className="absolute bottom-24 right-10 w-16 h-16 border-r-2 border-b-2 border-accent-blue/20 pointer-events-none" />

      {/* Main content */}
      <div className="relative z-10 text-center max-w-5xl mx-auto px-6 pt-24">
        {/* Status badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full glass border border-accent-blue/20 text-sm font-medium text-gray-300 mb-10"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green" />
          </span>
          Advocate · AI Systems Architect · Maharashtra
        </motion.div>

        {/* Name */}
        <motion.h1
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="text-6xl sm:text-7xl md:text-8xl font-bold text-white mb-4 leading-[0.95] tracking-tight"
        >
          Adv. Aditya{' '}
          <span className="gradient-text">Gade</span>
        </motion.h1>

        {/* Tagline — staggered word reveal */}
        <div className="flex flex-wrap justify-center gap-x-2.5 gap-y-1 mb-8 mt-6">
          {taglineWords.map((word, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
              className="text-2xl sm:text-3xl md:text-4xl text-gray-300 font-light tracking-tight"
            >
              {word}
            </motion.span>
          ))}
        </div>

        {/* Sub-description */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.9 }}
          className="text-gray-500 text-base sm:text-lg max-w-xl mx-auto mb-12 leading-relaxed"
        >
          Architected with the $7T Billion-Dollar Prompter Methodology.
          <br className="hidden sm:block" /> Zero staff. Exponential scale.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.1 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <motion.a
            href="#project"
            whileHover={{ scale: 1.05, boxShadow: '0 0 32px rgba(59,130,246,0.35)' }}
            whileTap={{ scale: 0.97 }}
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-accent-blue to-accent-purple text-white font-semibold text-base shadow-lg shadow-accent-blue/20 transition-all"
          >
            Explore the Project
          </motion.a>
          <motion.a
            href="/dashboard"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            className="px-8 py-4 rounded-xl glass border border-white/15 text-white font-semibold text-base hover:border-white/25 transition-all"
          >
            Live Dashboard →
          </motion.a>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="flex items-center justify-center gap-10 mt-16 pt-10 border-t border-white/[0.06]"
        >
          {[
            { value: '25 min', label: 'Full workflow' },
            { value: '0', label: 'Staff required' },
            { value: '6', label: 'AI agents' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-gray-500 text-sm mt-0.5">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.2 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="flex flex-col items-center gap-1 text-gray-600"
        >
          <ArrowDown className="w-5 h-5" />
        </motion.div>
      </motion.div>
    </section>
  );
}
