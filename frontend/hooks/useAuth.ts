'use client'
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  User 
} from 'firebase/auth';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // If Firebase is not configured, set loading to false and return
    if (!auth) {
      console.warn('Firebase auth is not configured');
      setIsLoading(false);
      return;
    }

    // Listen for real-time auth state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const register = async (email: string, pass: string) => {
    if (!auth) {
      throw new Error('Firebase authentication is not configured');
    }
    setIsLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
      router.push('/terminal');
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      throw errorMessage;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, pass: string) => {
    if (!auth) {
      throw new Error('Firebase authentication is not configured');
    }
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      router.push('/terminal');
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      throw errorMessage;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    if (!auth) {
      throw new Error('Firebase authentication is not configured');
    }
    await signOut(auth);
    router.push('/login');
  };

  return { user, isAuthenticated: !!user, isLoading, login, register, logout };
}