'use client'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Zap, User, Mail, Lock, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function RegisterPage() {
  const { register } = useAuth()
  const [formData, setFormData] = useState({ name: '', email: '', password: '' })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.name && formData.email && formData.password) {
      register(formData)
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      <div className="w-full max-w-md relative">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-[2.5rem] blur opacity-20 pointer-events-none" />
        
        <div className="relative bg-zinc-900/50 border border-white/10 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl">
          <div className="text-center space-y-2 mb-10">
            <div className="inline-flex p-3 bg-blue-600/10 rounded-2xl border border-blue-500/20 mb-4">
              <Zap className="w-6 h-6 text-blue-500" fill="currentColor" />
            </div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic">Create Account</h1>
            <p className="text-zinc-500 text-sm">Join the voice-activated trading revolution.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
              <input 
                type="text" 
                required
                placeholder="Full Name"
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white outline-none focus:border-blue-500/50 transition-all"
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
              <input 
                type="email" 
                required
                placeholder="Email Address"
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white outline-none focus:border-blue-500/50 transition-all"
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>

            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
              <input 
                type="password" 
                required
                placeholder="Password"
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white outline-none focus:border-blue-500/50 transition-all"
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest py-4 rounded-2xl transition-all flex items-center justify-center gap-2 group">
              Initialize Profile <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold">
              Already have an account? <Link href="/login" className="text-blue-400 hover:underline ml-1">Login</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}