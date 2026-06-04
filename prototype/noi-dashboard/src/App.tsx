import { useState, useEffect, useCallback } from 'react'

type AutomationStep = 'documents_received' | 'challan_generated' | 'challan_paid' | 'verified' | 'noi_drop' | 'noi_filed' | 'acknowledged' | 'completed'
type Role = 'PRINCIPAL' | 'ADVOCATE' | 'EXECUTIVE' | 'CLERK' | 'BANK_VIEWER'

interface CaseItem {
  id: string
  borrower: string
  bank: string
  loanAmount: string
  propertyLocation: string
  step: AutomationStep
  receivedAt: string
  assignee?: string
  priority: 'high' | 'medium' | 'low'
}

// ── Role Hierarchy ─────────────────────────────────────────────────────

const ROLE_HIERARCHY: Record<Role, { level: number; label: string; color: string }> = {
  PRINCIPAL: { level: 100, label: 'Principal', color: 'text-amber-300 border-amber-500/30' },
  ADVOCATE: { level: 80, label: 'Advocate', color: 'text-gold border-gold/30' },
  EXECUTIVE: { level: 60, label: 'Executive', color: 'text-emerald-400 border-emerald-500/30' },
  CLERK: { level: 40, label: 'Clerk', color: 'text-sky-400 border-sky-500/30' },
  BANK_VIEWER: { level: 20, label: 'Bank Viewer', color: 'text-gray-400 border-gray-500/30' },
}

const ROLE_PERMISSIONS: Record<Role, string[]> = {
  PRINCIPAL: ['firm.manage', 'case.all', 'noi.all', 'comms.all', 'rpa.all', 'reports.all'],
  ADVOCATE: ['case.view_all', 'case.assign', 'noi.initiate', 'noi.file', 'noi.generate_challan', 'comms.send_email', 'rpa.run_gras', 'rpa.run_igr', 'reports.view_analytics', 'reports.export'],
  EXECUTIVE: ['case.view_assigned', 'case.update_status', 'noi.verify_docs', 'comms.send_whatsapp', 'rpa.view_logs'],
  CLERK: ['case.view_assigned', 'noi.view_progress', 'comms.view_log', 'reports.view_dashboard'],
  BANK_VIEWER: ['case.view_assigned'],
}

function roleHasPermission(role: Role, perm: string): boolean {
  const allowed = ROLE_PERMISSIONS[role] || []
  return allowed.some(a => {
    if (a.endsWith('.all')) {
      const domain = a.split('.')[0]
      return perm.startsWith(domain)
    }
    return a === perm
  })
}

function roleColor(role: Role): string {
  return ROLE_HIERARCHY[role].color.split(' ')[0]
}

const now = new Date()

const mockCases: CaseItem[] = [
  { id: 'NOI-2026-001', borrower: 'Rajesh Sharma', bank: 'HDFC', loanAmount: '₹45,00,000', propertyLocation: 'Andheri West, Mumbai', step: 'noi_filed', receivedAt: new Date(now.getTime() - 2 * 86400000).toISOString(), assignee: 'Adv. Gade', priority: 'high' },
  { id: 'NOI-2026-002', borrower: 'Priya Mehta', bank: 'ICICI', loanAmount: '₹32,50,000', propertyLocation: 'Borivali East, Mumbai', step: 'challan_paid', receivedAt: new Date(now.getTime() - 3 * 86400000).toISOString(), assignee: 'Adv. Gade', priority: 'medium' },
  { id: 'NOI-2026-003', borrower: 'Amit Kumar', bank: 'Axis', loanAmount: '₹28,00,000', propertyLocation: 'Thane West', step: 'verified', receivedAt: new Date(now.getTime() - 1 * 86400000).toISOString(), assignee: 'Automation', priority: 'high' },
  { id: 'NOI-2026-004', borrower: 'Sunita Patel', bank: 'Kotak', loanAmount: '₹55,00,000', propertyLocation: 'Navi Mumbai', step: 'documents_received', receivedAt: new Date(now.getTime() - 0.2 * 86400000).toISOString(), assignee: '—', priority: 'medium' },
  { id: 'NOI-2026-005', borrower: 'Vikram Singh', bank: 'HDFC', loanAmount: '₹75,00,000', propertyLocation: 'Powai, Mumbai', step: 'completed', receivedAt: new Date(now.getTime() - 10 * 86400000).toISOString(), assignee: 'Adv. Gade', priority: 'low' },
  { id: 'NOI-2026-006', borrower: 'Ananya Gupta', bank: 'Muthoot', loanAmount: '₹18,00,000', propertyLocation: 'Dombivli', step: 'documents_received', receivedAt: new Date(now.getTime() - 0.1 * 86400000).toISOString(), assignee: '—', priority: 'low' },
  { id: 'NOI-2026-007', borrower: 'Deepak Joshi', bank: 'ICICI', loanAmount: '₹92,00,000', propertyLocation: 'Bandra, Mumbai', step: 'challan_paid', receivedAt: new Date(now.getTime() - 5 * 86400000).toISOString(), assignee: 'Adv. Gade', priority: 'high' },
  { id: 'NOI-2026-008', borrower: 'Laxmi Rao', bank: 'Axis', loanAmount: '₹12,50,000', propertyLocation: 'Kalyan', step: 'completed', receivedAt: new Date(now.getTime() - 15 * 86400000).toISOString(), assignee: 'Adv. Gade', priority: 'low' },
]

const mockStaff = [
  { id: '1', name: 'Adv. Aditya Gade', role: 'PRINCIPAL' as Role, cases: 6, online: true },
  { id: '2', name: 'Rohit Sharma', role: 'EXECUTIVE' as Role, cases: 3, online: true },
  { id: '3', name: 'Neha Patel', role: 'CLERK' as Role, cases: 2, online: false },
  { id: '4', name: 'HDFC Legal Team', role: 'BANK_VIEWER' as Role, cases: 4, online: true },
]

const stepLabels: Record<AutomationStep, string> = {
  documents_received: 'Documents Received',
  challan_generated: 'Challan Generated',
  challan_paid: 'Challan Paid',
  verified: 'Verified',
  noi_drop: 'NOI Drop Received',
  noi_filed: 'NOI Filed',
  acknowledged: 'Acknowledged',
  completed: 'Complete',
}

const stepOrder: AutomationStep[] = ['documents_received', 'challan_generated', 'challan_paid', 'verified', 'noi_drop', 'noi_filed', 'acknowledged', 'completed']

function formatTime(iso: string) {
  const d = new Date(iso)
  const diffMs = now.getTime() - d.getTime()
  const hrs = Math.floor(diffMs / 3600000)
  if (hrs < 1) return 'Just now'
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function PriorityBadge({ p }: { p: CaseItem['priority'] }) {
  const colors = { high: 'text-rose-400 border-rose-500/30', medium: 'text-amber-400 border-amber-500/30', low: 'text-slate-500 border-slate-600/30' }
  return <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 border rounded ${colors[p]}`}>{p}</span>
}

function RoleSwitcher({ roles, current, onChange }: { roles: Role[]; current: Role; onChange: (r: Role) => void }) {
  return (
    <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
      {roles.map(r => {
        const info = ROLE_HIERARCHY[r]
        return (
          <button key={r} onClick={() => onChange(r)} className={`text-xs px-3 py-1.5 rounded-md transition-all ${r === current ? `bg-white/10 ${info.color} font-medium` : 'text-gray-500 hover:text-white'}`}>
            {info.label}
          </button>
        )
      })}
    </div>
  )
}

// =============== RBAC DASHBOARD ===============

function RbacSidebar({ role, staff, onRoleChange }: { role: Role; staff: typeof mockStaff; onRoleChange: (r: Role) => void }) {
  return (
    <aside className="w-64 border-r border-white/10 p-6 flex flex-col gap-6 shrink-0">
      <div>
        <h1 className="text-lg font-semibold text-gold tracking-tight">AG ASSOCIATES</h1>
        <p className="text-xs text-gray-500 mt-0.5">RBAC Dashboard</p>
      </div>

      {/* Role hierarchy tree */}
      {roleHasPermission(role, 'firm.manage') && (
        <div>
          <h3 className="text-[10px] uppercase tracking-wider text-gray-500 mb-2 font-medium">Team</h3>
          {staff.map(s => {
            const info = ROLE_HIERARCHY[s.role]
            const isCurrentUser = s.id === '1'
            const indentLevel = info.level / 20
            return (
              <div key={s.id} className={`flex items-center gap-2 py-1.5 ${isCurrentUser ? 'bg-white/5 rounded-lg px-2 -mx-2' : ''}`} style={{ paddingLeft: `${(5 - indentLevel) * 8 + 8}px` }}>
                <div className={`w-1.5 h-1.5 rounded-full ${s.online ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs truncate">{s.name}</div>
                  <div className={`text-[9px] ${info.color}`}>{info.label}</div>
                </div>
                <div className="text-[10px] text-gray-500">{s.cases}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Role switch (dev only) */}
      {roleHasPermission(role, 'firm.manage') && (
        <div className="pt-2 border-t border-white/10">
          <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Switch Role (Prototype)</div>
          <RoleSwitcher roles={['PRINCIPAL', 'ADVOCATE', 'EXECUTIVE', 'CLERK', 'BANK_VIEWER']} current={role} onChange={onRoleChange} />
        </div>
      )}

      {/* Current user */}
      <div className="mt-auto pt-6 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center text-xs font-medium text-gold">AG</div>
          <div>
            <div className="text-sm font-medium">Adv. Aditya Gade</div>
            <div className={`text-[11px] ${roleColor(role)}`}>{ROLE_HIERARCHY[role].label}</div>
          </div>
        </div>
        {/* Permission summary for current role */}
        <div className="mt-3 space-y-1">
          {['case', 'noi', 'comms', 'rpa', 'reports'].map(domain => {
            const hasAny = roleHasPermission(role, `${domain}.all`) || ROLE_PERMISSIONS[role].some(p => p.startsWith(domain))
            return (
              <div key={domain} className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${hasAny ? 'bg-emerald-500' : 'bg-gray-700'}`} />
                <span className={`text-[10px] ${hasAny ? 'text-gray-400' : 'text-gray-600'}`}>{domain}</span>
              </div>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

function PipelineSection({ cases, role }: { cases: CaseItem[]; role: Role }) {
  const canViewCases = roleHasPermission(role, 'case.view_all') || roleHasPermission(role, 'case.view_assigned')
  if (!canViewCases) {
    return <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">No access to cases</div>
  }

  return (
    <main className="flex-1 p-6 overflow-x-auto">
      <div className="flex gap-4 min-w-max h-full">
        {(stepOrder as AutomationStep[]).map((step, si) => {
          const colCases = cases.filter(c => c.step === step)
          const stepActions: Record<string, string[]> = {
            documents_received: roleHasPermission(role, 'noi.initiate') ? ['Review docs', 'Generate challan'] : [],
            challan_generated: roleHasPermission(role, 'noi.generate_challan') ? ['Verify challan'] : ['View challan'],
            challan_paid: roleHasPermission(role, 'noi.generate_challan') ? ['Verify challan'] : ['View challan'],
            verified: roleHasPermission(role, 'noi.verify_docs') ? ['Wait for NOI drop'] : [],
            noi_drop: roleHasPermission(role, 'noi.file') ? ['File NOI'] : ['View status'],
            noi_filed: roleHasPermission(role, 'noi.file') ? ['Check acknowledgment'] : ['View status'],
            acknowledged: [],
            completed: [],
          }

          return (
            <div key={step} className="w-72 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-gold/10 text-gold border border-gold/30'}`}>
                    {si + 1}
                  </div>
                  <span className="text-sm font-medium">{stepLabels[step]}</span>
                  {stepActions[step].length > 0 && (
                    <span className="text-[10px] text-gold/60">· {stepActions[step].length} actions</span>
                  )}
                </div>
                <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{colCases.length}</span>
              </div>
              <div className="flex flex-col gap-3">
                {colCases.map(c => (
                  <div key={c.id} className="glass-card p-4 space-y-2 border-l-2 border-l-gold/40">
                    <div className="flex items-start justify-between">
                      <div className="text-sm font-medium leading-tight">{c.borrower}</div>
                      <PriorityBadge p={c.priority} />
                    </div>
                    <div className="text-xs text-gray-400">{c.bank} · {c.loanAmount}</div>
                    <div className="text-[11px] text-gray-500">{c.propertyLocation}</div>
                    <div className="flex items-center justify-between pt-1 border-t border-white/5">
                      <span className="text-[10px] text-gray-600">{formatTime(c.receivedAt)}</span>
                      <span className="text-[10px] text-gold">{c.assignee}</span>
                    </div>
                    {/* Role-based action rows */}
                    {stepActions[step].length > 0 && (
                      <div className="flex gap-1.5 pt-1">
                        {stepActions[step].map(action => (
                          <button key={action} className="text-[10px] px-2 py-1 rounded bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-colors">
                            {action}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {colCases.length === 0 && (
                  <div className="text-center text-gray-600 text-xs py-8 border border-dashed border-white/5 rounded-lg">Empty</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}

function OrgChartPanel({ staff, role }: { staff: typeof mockStaff; role: Role }) {
  if (!roleHasPermission(role, 'firm.manage')) return null

  const sorted = [...staff].sort((a, b) => ROLE_HIERARCHY[b.role].level - ROLE_HIERARCHY[a.role].level)

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-medium mb-4">Org Hierarchy</h3>
      <div className="space-y-0">
        {sorted.map((s, i) => {
          const info = ROLE_HIERARCHY[s.role]
          const level = info.level / 20
          const isLast = i === sorted.length - 1
          return (
            <div key={s.id} className="relative flex items-center gap-3 py-2">
              {/* Tree connector */}
              {level < 5 && (
                <div className="absolute left-3 top-0 bottom-0 w-px bg-white/5" />
              )}
              <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${info.color.replace('text-', 'border-')} bg-white/5`}
                   style={{ marginLeft: `${(5 - level) * 16}px` }}>
                {s.role === 'PRINCIPAL' ? '👑' : s.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </div>
              <div>
                <div className="text-sm">{s.name}</div>
                <div className={`text-[11px] ${info.color}`}>{info.label} · {s.cases} cases</div>
              </div>
              <div className={`ml-auto w-2 h-2 rounded-full ${s.online ? 'bg-emerald-400' : 'bg-gray-600'}`} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AutomationPanel({ role }: { role: Role }) {
  const agents = [
    { name: 'Email Intake Agent', status: 'Running', cases: 4, perm: 'case.view_all' },
    { name: 'Doc Verifier Agent', status: 'Idle', cases: 0, perm: 'noi.verify_docs' },
    { name: 'Auto-Comms Agent', status: 'Running', cases: 2, perm: 'comms.send_email' },
    { name: 'GRAS RPA', status: 'Idle', cases: 0, perm: 'rpa.run_gras' },
    { name: 'IGR RPA', status: 'Idle', cases: 0, perm: 'rpa.run_igr' },
  ]

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-medium mb-4">🤖 AI Agents</h3>
      <div className="space-y-3">
        {agents.map(a => {
          const canView = roleHasPermission(role, a.perm) || roleHasPermission(role, 'rpa.view_logs')
          return (
            <div key={a.name} className={`flex items-center justify-between ${canView ? '' : 'opacity-30 pointer-events-none'}`}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${a.status === 'Running' ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                <span className="text-xs">{canView ? a.name : '•••••••••••'}</span>
              </div>
              {canView && <span className="text-[10px] text-gray-500">{a.cases > 0 ? `${a.cases} active` : a.status}</span>}
              {!canView && <span className="text-[10px] text-gray-700">restricted</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RbacDashboard({ initialRole }: { initialRole: Role }) {
  const [role, setRole] = useState<Role>(initialRole)

  return (
    <div className="min-h-screen bg-black text-white font-sans flex">
      <RbacSidebar role={role} staff={mockStaff} onRoleChange={setRole} />
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="border-b border-white/10 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">NOI Pipeline</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${ROLE_HIERARCHY[role].color}`}>
              {ROLE_HIERARCHY[role].label}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {roleHasPermission(role, 'rpa.view_logs') && (
              <span className="text-[11px] text-gray-500">RPA Queue: 2 pending</span>
            )}
            {roleHasPermission(role, 'comms.view_log') && (
              <span className="text-[11px] text-gray-500">Comms: 3 unread</span>
            )}
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <PipelineSection cases={mockCases} role={role} />
          {/* Right panel — contextual info based on role */}
          <aside className="w-80 border-l border-white/10 p-5 space-y-4 overflow-y-auto shrink-0">
            <AutomationPanel role={role} />
            <OrgChartPanel staff={mockStaff} role={role} />
            {/* Permissions card */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-medium mb-3">🔑 Current Permissions</h3>
              <div className="space-y-1">
                {ROLE_PERMISSIONS[role].slice(0, 8).map(p => {
                  const [domain, action] = p.split('.')
                  return (
                    <div key={p} className="flex items-center gap-2 text-[11px]">
                      <div className="w-1 h-1 rounded-full bg-emerald-500/50" />
                      <span className="text-gray-400">{domain}</span>
                      <span className="text-gray-600">· {action}</span>
                    </div>
                  )
                })}
                {ROLE_PERMISSIONS[role].length > 8 && (
                  <div className="text-[10px] text-gray-600 pt-1">+{ROLE_PERMISSIONS[role].length - 8} more</div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

// =============== Switcher ===============
function Switcher({ variant, setVariant }: { variant: string; setVariant: (v: string) => void }) {
  const variants = [
    { key: 'D', label: 'RBAC Dashboard' },
    { key: 'E', label: 'RBAC — Advocate' },
    { key: 'F', label: 'RBAC — Clerk' },
  ]
  const curIdx = variants.findIndex(v => v.key === variant)

  const cycle = useCallback((dir: number) => {
    const next = (curIdx + dir + variants.length) % variants.length
    setVariant(variants[next].key)
  }, [curIdx, variants, setVariant])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return
      if (e.key === 'ArrowLeft') cycle(-1)
      if (e.key === 'ArrowRight') cycle(1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [cycle])

  return (
    <div className="prototype-bar select-none">
      <button onClick={() => cycle(-1)} className="text-gray-400 hover:text-white transition-colors p-1">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
      </button>
      <span className="text-xs text-gray-400">{variant} — <span className="text-white">{variants.find(v => v.key === variant)?.label}</span></span>
      <button onClick={() => cycle(1)} className="text-gray-400 hover:text-white transition-colors p-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}><path d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
  )
}

// =============== App ===============
export default function App() {
  const [variant, setVariant] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('variant')
      if (p && ['D', 'E', 'F'].includes(p)) return p
    }
    return 'D'
  })

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('variant', variant)
    window.history.replaceState({}, '', url.toString())
  }, [variant])

  return (
    <>
      {variant === 'D' && <RbacDashboard initialRole="PRINCIPAL" />}
      {variant === 'E' && <RbacDashboard initialRole="ADVOCATE" />}
      {variant === 'F' && <RbacDashboard initialRole="CLERK" />}
      <Switcher variant={variant} setVariant={setVariant} />
    </>
  )
}
