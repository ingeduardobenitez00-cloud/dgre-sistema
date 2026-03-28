'use client';
import { useMemo } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { type User } from 'firebase/auth';

export interface UserProfile {
  username?: string;
  role?: 'admin' | 'director' | 'coordinador' | 'jefe' | 'funcionario' | 'viewer';
  departamento?: string;
  distrito?: string;
  modules?: string[];
  permissions?: string[];
  cedula?: string;
  vinculo?: 'PERMANENTE' | 'CONTRATADO' | 'COMISIONADO' | string;
  active?: boolean;
}

export type AppUser = User & {
  profile?: UserProfile | null;
  isAdmin?: boolean;
};

export interface UserHookResult {
  user: AppUser | null;
  isUserLoading: boolean;
  isProfileLoading: boolean;
  userError: Error | null;
}

export const useUser = (): UserHookResult => {
  const { user: authUser, isUserLoading: isAuthLoading, userError: authError, firestore } = useFirebase();

  const userProfileDocRef = useMemoFirebase(() => {
    if (!firestore || !authUser?.uid) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [firestore, authUser?.uid]);

  const { data: profileData, isLoading: isProfileLoading, error: profileError } = useDoc<UserProfile>(userProfileDocRef);
  
  const enrichedUser = useMemo(() => {
    if (!authUser) return null;
    
    // Bypass Maestro por Correo Propietario
    const isAdmin = authUser.email === 'edubtz11@gmail.com' || profileData?.role === 'admin';
    
    return {
      ...authUser,
      profile: profileData,
      isAdmin
    };
  }, [authUser, profileData]);

  return {
    user: enrichedUser,
    isUserLoading: isAuthLoading,
    isProfileLoading: isProfileLoading,
    userError: authError || profileError,
  };
};