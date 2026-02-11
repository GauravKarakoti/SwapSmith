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
    // Listen for real-time auth state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const register = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
      router.push('/terminal');
    } catch (error: any) {
      throw error.message;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      router.push('/terminal');
    } catch (error: any) {
      throw error.message;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  return { user, isAuthenticated: !!user, isLoading, login, register, logout };
}