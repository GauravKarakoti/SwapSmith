// src/hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { auth } from '../services/firebase';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    User
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureUser } from '../services/api';

export function useAuth() {
    const [user, setUser] = useState<any>({ uid: 'mock-user-123', email: 'test@swapsmith.com' });
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // MOCK: Automatically simulate saving a user session to AsyncStorage
        AsyncStorage.setItem('firebase-uid', 'mock-user-123');
    }, []);

    const register = async (email: string, pass: string) => {
        setIsLoading(true);
        try {
            await createUserWithEmailAndPassword(auth, email, pass);
        } catch (error) {
            console.error('Registration error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Registration failed';
            throw errorMessage;
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (email: string, pass: string) => {
        setIsLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (error) {
            console.error('Login error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Login failed';
            throw errorMessage;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        await signOut(auth);
    };

    return { user, isAuthenticated: !!user, isLoading, login, register, logout };
}
