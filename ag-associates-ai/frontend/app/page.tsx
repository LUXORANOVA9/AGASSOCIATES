import NavBar from './components/NavBar';
import HeroSection from './components/HeroSection';
import ManifestoSection from './components/ManifestoSection';
import AgentRoster from './components/AgentRoster';
import WorkflowTimeline from './components/WorkflowTimeline';
import TechStack from './components/TechStack';
import ExceptionMatrix from './components/ExceptionMatrix';
import FlywheelSection from './components/FlywheelSection';
import ContactSection from './components/ContactSection';

export default function Portfolio() {
  return (
    <main className="min-h-screen bg-dark-bg overflow-x-hidden">
      <NavBar />

      {/* Hero */}
      <HeroSection />

      {/* Manifesto — Linear vs Agentic */}
      <ManifestoSection />

      {/* Flagship Project */}
      <section id="project" className="border-t border-white/[0.04]">
        {/* Section intro */}
        <div className="max-w-7xl mx-auto px-6 pt-24 pb-4">
          <p className="text-accent-blue font-mono text-xs uppercase tracking-[0.25em] mb-4">
            Flagship Project
          </p>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-tight max-w-3xl">
            The Zero-Staff Enterprise
          </h2>
          <p className="text-gray-400 mt-4 text-base sm:text-lg max-w-2xl leading-relaxed">
            AG Associates: an autonomous multi-agent platform that processes rental agreements
            from WhatsApp intake to government NeSL filing in 25 minutes, with zero human staff.
          </p>
        </div>

        <AgentRoster />
        <WorkflowTimeline />
      </section>

      {/* Tech Architecture */}
      <TechStack />

      {/* Exception Matrix */}
      <ExceptionMatrix />

      {/* Blitzscaling Flywheel */}
      <FlywheelSection />

      {/* Contact / CTA */}
      <ContactSection />

      {/* Footer */}
      <footer className="border-t border-white/[0.04] py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-600 text-sm">
            © 2026 Adv. Aditya Gade · AG Associates AI
          </p>
          <div className="flex items-center gap-6">
            <a href="/dashboard" className="text-gray-600 hover:text-gray-400 transition-colors text-sm">
              Live Dashboard
            </a>
            <span className="text-gray-700 text-xs font-mono">
              Built with Next.js + LangGraph
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
