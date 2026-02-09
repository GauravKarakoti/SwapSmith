'use client'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Zap, User, Mail, Lock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function RegisterPage() {
  // Pull register function and isLoading state from our Firebase hook
  const { register, isLoading } = useAuth()
  const [formData, setFormData] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('') // Reset error state

    if (formData.name && formData.email && formData.password) {
      try {
        // Firebase expects email and password
        // You can save the 'name' to Firebase Profile or Firestore later
        await register(formData.email, formData.password)
      } catch (err: any) {
        // Handle common Firebase errors professionally
        if (err.includes('email-already-in-use')) {
          setError('This email is already registered.')
        } else if (err.includes('weak-password')) {
          setError('Password should be at least 6 characters.')
        } else {
          setError('Failed to create account. Please try again.')
        }
      }
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
            <h1 className="text-3xl font-black tracking-tighter uppercase italic text-white">Create Account</h1>
            <p className="text-zinc-500 text-sm">Join the voice-activated trading revolution.</p>
          </div>

          {/* Error Message Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-xs font-bold uppercase tracking-tight animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
              <input 
                type="text" 
                required
                disabled={isLoading}
                placeholder="Full Name"
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white outline-none focus:border-blue-500/50 transition-all disabled:opacity-50"
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
              <input 
                type="email" 
                required
                disabled={isLoading}
                placeholder="Email Address"
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white outline-none focus:border-blue-500/50 transition-all disabled:opacity-50"
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>

            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
              <input 
                type="password" 
                required
                disabled={isLoading}
                placeholder="Password"
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white outline-none focus:border-blue-500/50 transition-all disabled:opacity-50"
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-black uppercase tracking-widest py-4 rounded-2xl transition-all flex items-center justify-center gap-2 group shadow-lg shadow-blue-600/20"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Initialize Profile 
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
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