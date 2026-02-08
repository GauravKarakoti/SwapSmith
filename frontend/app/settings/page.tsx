'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useDisconnect } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  LogOut,
  Wallet,
  Shield,
  Bell,
  Globe,
  Zap,
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
  Info,
  User,
  Palette,
  Volume2,
  VolumeX,
  Lock,
  Cpu,
  GitBranch,
  Heart,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import Navbar from '@/components/Navbar'

// ---------------------------------------------------------------------------
// Animated toggle switch
// ---------------------------------------------------------------------------
function ToggleSwitch({
  enabled,
  onToggle,
  activeColor = 'bg-blue-600',
}: {
  enabled: boolean
  onToggle: () => void
  activeColor?: string
}) {
  return (
    <button
      onClick={onToggle}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 focus:outline-none ${
        enabled ? activeColor : 'bg-zinc-700'
      }`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="inline-block h-5 w-5 rounded-full bg-white shadow-lg"
        style={{ marginLeft: enabled ? '1.25rem' : '0.25rem' }}
      />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Glow card wrapper (matches homepage style)
// ---------------------------------------------------------------------------
function GlowCard({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-xl ${className}`}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        setMousePos({ x: e.clientX - r.left, y: e.clientY - r.top })
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {hovered && (
        <motion.div
          className="pointer-events-none absolute w-[340px] h-[340px] rounded-full blur-[100px]"
          style={{
            background: 'rgba(59,130,246,0.08)',
            left: mousePos.x - 170,
            top: mousePos.y - 170,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------
function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4 px-1">
      <Icon className="w-4 h-4 text-blue-400" />
      <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">{label}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Row component for individual settings
// ---------------------------------------------------------------------------
function SettingRow({
  icon: Icon,
  label,
  description,
  action,
  danger = false,
}: {
  icon: React.ElementType
  label: string
  description?: string
  action: React.ReactNode
  danger?: boolean
}) {
  return (
    <div className="group flex items-center justify-between px-5 py-4 hover:bg-white/2 transition-colors">
      <div className="flex items-center gap-4 min-w-0">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            danger
              ? 'bg-red-500/10 text-red-400'
              : 'bg-zinc-800 text-zinc-300 group-hover:bg-blue-500/10 group-hover:text-blue-400'
          } transition-colors`}
        >
          <Icon className="w-[18px] h-[18px]" />
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${danger ? 'text-red-400' : 'text-zinc-100'}`}>
            {label}
          </p>
          {description && <p className="text-xs text-zinc-500 mt-0.5 truncate">{description}</p>}
        </div>
      </div>
      <div className="shrink-0 ml-4">{action}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Settings Page
// ---------------------------------------------------------------------------
export default function SettingsPage() {
  const router = useRouter()
  const { logout } = useAuth()
  const { address, isConnected, chain } = useAccount()
  const { disconnect } = useDisconnect()

  // Preferences (persisted to localStorage)
  const [preferences, setPreferences] = useState({
    darkMode: true,
    notifications: true,
    soundEnabled: true,
    autoConfirmSwaps: false,
    currency: 'USD'
  })

  const [copied, setCopied] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  // Load saved preferences
  useEffect(() => {
    try {
      const saved = localStorage.getItem('swapsmith_preferences')
      if (saved) {
        const prefs = JSON.parse(saved)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPreferences(prev => ({ ...prev, ...prefs }))
      }
    } catch {}
  }, [])

  // Save preferences on change
  useEffect(() => {
    localStorage.setItem(
      'swapsmith_preferences',
      JSON.stringify(preferences)
    )
  }, [preferences])

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const truncateAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`

  const handleLogout = () => {
    disconnect()
    logout()
  }

  // -----------------------------------------------------------------------
  return (
    <>
      <Navbar />

      {/* Ambient backgrounds */}
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
        <div className="absolute top-[-15%] left-[-10%] w-[45%] h-[45%] rounded-full bg-blue-600/6 blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] rounded-full bg-purple-600/6 blur-[140px]" />
        <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[30%] h-[30%] rounded-full bg-cyan-500/3 blur-[120px]" />
      </div>

      <div className="min-h-screen bg-[#050505] text-white pt-20 sm:pt-24 pb-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          {/* ───────── Page Header ───────── */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-10"
          >
            <button
              onClick={() => router.back()}
              className="group flex items-center gap-2 text-sm text-zinc-500 hover:text-white mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back
            </button>

            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="h-14 w-14 rounded-2xl bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <User className="w-7 h-7 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 border-2 border-[#050505] flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Settings</h1>
                <p className="text-sm text-zinc-500 mt-0.5">Manage your account & preferences</p>
              </div>
            </div>
          </motion.div>

          {/* ───────── Wallet Section ───────── */}
          <SectionHeader icon={Wallet} label="Wallet" />
          <GlowCard className="mb-8" delay={0.05}>
            {isConnected && address ? (
              <>
                <div className="p-5 pb-0">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-bold uppercase tracking-widest">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Connected
                    </span>
                    {chain && (
                      <span className="text-[11px] text-zinc-500 font-medium">
                        {chain.name}
                      </span>
                    )}
                  </div>
                </div>

                <SettingRow
                  icon={Wallet}
                  label={truncateAddress(address)}
                  description="Your connected wallet address"
                  action={
                    <button
                      onClick={copyAddress}
                      className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-blue-400 transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy
                        </>
                      )}
                    </button>
                  }
                />

                <div className="px-5 pb-4 pt-1">
                  <button
                    onClick={() => disconnect()}
                    className="w-full py-2.5 rounded-xl border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-widest hover:bg-red-500/10 transition-colors active:scale-[0.98]"
                  >
                    Disconnect Wallet
                  </button>
                </div>
              </>
            ) : (
              <div className="p-5 text-center">
                <div className="h-12 w-12 mx-auto rounded-2xl bg-zinc-800 flex items-center justify-center mb-3">
                  <Wallet className="w-6 h-6 text-zinc-500" />
                </div>
                <p className="text-sm text-zinc-400 mb-1 font-medium">No wallet connected</p>
                <p className="text-xs text-zinc-600 mb-4">
                  Connect a wallet from the terminal to enable on-chain features.
                </p>
                <button
                  onClick={() => router.push('/terminal')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors active:scale-[0.98]"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Go to Terminal
                </button>
              </div>
            )}
          </GlowCard>

          {/* ───────── Preferences Section ───────── */}
          <SectionHeader icon={Palette} label="Preferences" />
          <GlowCard className="mb-8 divide-y divide-zinc-800/60" delay={0.1}>
            
            <SettingRow
              icon={Bell}
              label="Notifications"
              description="Receive swap & yield alerts"
              action={
                <ToggleSwitch
                  enabled={preferences.notifications}
                  onToggle={() => setPreferences(p => ({ ...p, notifications: !p.notifications }))}
                />
              }
            />
            <SettingRow
              icon={preferences.soundEnabled ? Volume2 : VolumeX}
              label="Sound Effects"
              description="Play sounds for confirmations"
              action={
                <ToggleSwitch
                  enabled={preferences.soundEnabled}
                  onToggle={() => setPreferences(p => ({ ...p, soundEnabled: !p.soundEnabled }))}
                />
              }
            />
            <SettingRow
              icon={Shield}
              label="Auto-Confirm Swaps"
              description="Skip confirmation for high-confidence swaps"
              action={
                <ToggleSwitch
                  enabled={preferences.autoConfirmSwaps}
                  onToggle={() => setPreferences(p => ({ ...p, autoConfirmSwaps: !p.autoConfirmSwaps }))}
                  activeColor="bg-amber-500"
                />
              }
            />
            <SettingRow
              icon={Globe}
              label="Display Currency"
              description="Prices shown in this currency"
              action={
                <select
                  value={preferences.currency}
                  onChange={(e) => setPreferences(p => ({ ...p, currency: e.target.value }))}
                  className="bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="JPY">JPY</option>
                  <option value="INR">INR</option>
                  <option value="BTC">BTC</option>
                  <option value="ETH">ETH</option>
                </select>
              }
            />
          </GlowCard>

          {/* ───────── Security Section ───────── */}
          <SectionHeader icon={Lock} label="Security" />
          <GlowCard className="mb-8 divide-y divide-zinc-800/60" delay={0.15}>
            <SettingRow
              icon={Lock}
              label="Two-Factor Authentication"
              description="Coming soon"
              action={
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                  Soon
                </span>
              }
            />
            <SettingRow
              icon={Shield}
              label="Session Management"
              description="View & manage active sessions"
              action={
                <button className="text-zinc-500 hover:text-white transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              }
            />
          </GlowCard>

          {/* ───────── About Section ───────── */}
          <SectionHeader icon={Info} label="About" />
          <GlowCard className="mb-8 divide-y divide-zinc-800/60" delay={0.2}>
            <SettingRow
              icon={Zap}
              label="SwapSmith"
              description="AI-powered crypto swap terminal"
              action={
                <span className="text-xs text-zinc-500 font-mono">v0.1.0-alpha</span>
              }
            />
            <SettingRow
              icon={Cpu}
              label="Engine"
              description="Groq LLM + SideShift.ai"
              action={
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">
                    Online
                  </span>
                </span>
              }
            />
            <SettingRow
              icon={GitBranch}
              label="Build"
              description="Next.js 16 · React 19 · Wagmi 2"
              action={
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-500 hover:text-blue-400 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              }
            />
            <SettingRow
              icon={Heart}
              label="Made with love"
              description="Open-source & community driven"
              action={
                <span className="text-xs text-zinc-500">
                  MIT License
                </span>
              }
            />
          </GlowCard>

          {/* ───────── Danger Zone ───────── */}
          <SectionHeader icon={LogOut} label="Account" />
          <GlowCard className="mb-8" delay={0.25}>
            <AnimatePresence mode="wait">
              {!showLogoutConfirm ? (
                <motion.div
                  key="logout-btn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <SettingRow
                    icon={LogOut}
                    label="Log Out"
                    description="End your current session"
                    danger
                    action={
                      <button
                        onClick={() => setShowLogoutConfirm(true)}
                        className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-widest hover:bg-red-500/20 transition-colors active:scale-[0.97]"
                      >
                        Log Out
                      </button>
                    }
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="logout-confirm"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="p-5"
                >
                  <div className="text-center">
                    <div className="h-14 w-14 mx-auto rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
                      <LogOut className="w-7 h-7 text-red-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">Confirm Logout</h3>
                    <p className="text-sm text-zinc-500 mb-6">
                      You will be signed out and redirected to the login page.
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowLogoutConfirm(false)}
                        className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors active:scale-[0.97]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleLogout}
                        className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-widest transition-colors active:scale-[0.97] shadow-lg shadow-red-600/20"
                      >
                        Log Out
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </GlowCard>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center text-[11px] text-zinc-600 pb-4"
          >
            SwapSmith &middot; Terminal Alpha &middot; &copy; {new Date().getFullYear()}
          </motion.p>
        </div>
      </div>
    </>
  )
}
