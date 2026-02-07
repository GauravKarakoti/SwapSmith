'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const auth = localStorage.getItem('swapsmith_session')
    if (auth === 'active') setIsAuthenticated(true)
    setIsLoading(false)
  }, [])

  const register = (userData: any) => {
    // Store user data in localStorage (acting as our database)
    localStorage.setItem('swapsmith_user', JSON.stringify(userData))
    // Auto-login after registration
    localStorage.setItem('swapsmith_session', 'active')
    setIsAuthenticated(true)
    router.push('/terminal')
  }

  const login = (email: string, pass: string) => {
    const storedUser = localStorage.getItem('swapsmith_user')
    
    if (storedUser) {
      const user = JSON.parse(storedUser)
      if (user.email === email && user.password === pass) {
        localStorage.setItem('swapsmith_session', 'active')
        setIsAuthenticated(true)
        router.push('/terminal')
        return true
      }
    }
    return false // Mismatch or no user found
  }

  const logout = () => {
    localStorage.removeItem('swapsmith_session')
    setIsAuthenticated(false)
    router.push('/login')
  }

  return { isAuthenticated, isLoading, login, register, logout }
}