'use client';
import { useMemo, useState, useEffect } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { type User } from 'firebase/auth';

export interface UserProfile {
  username?: string;
  role?: 'admin' | 'director' | 'jefe' | 'funcionario' | 'divulgador' | 'viewer';
  departamento?: string;
  distrito?: string;
  modules?: string[];
  permissions?: string[];
  cedula?: string;
  vinculo?: 'PERMANENTE' | 'CONTRATADO' | 'COMISIONADO' | string;
}

export type AppUser = User & {
  profile?: UserProfile | null;
};

export interface UserHookResult {
  user: AppUser | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export const useUser = (): UserHookResult => {
  const { user: authUser, isUserLoading: isAuthLoading, userError: authError, firestore } = useFirebase();
  const [profileLoadingComplete, setProfileLoadingComplete] = useState(false);

  const userProfileDocRef = useMemoFirebase(() => {
    if (!firestore || !authUser?.uid) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [firestore, authUser?.uid]);

  const { data: profileData, isLoading: isProfileLoading, error: profileError } = useDoc<UserProfile>(userProfileDocRef);
  
  // Track when profile loading actually finishes to avoid UI flickering
  useEffect(() => {
    if (!isProfileLoading) {
      setProfileLoadingComplete(true);
    }
  }, [isProfileLoading]);

  const enrichedUser = useMemo(() => {
    if (!authUser) return null;
    return {
      ...authUser,
      profile: profileData,
    };
  }, [authUser, profileData]);

  // A more aggressive loading check: if auth is null and not loading, we are done.
  // If auth is present, we only wait for profile if it hasn't finished its first check.
  const loading = isAuthLoading || (!!authUser && isProfileLoading && !profileLoadingComplete);

  return {
    user: enrichedUser,
    isUserLoading: loading,
    userError: authError || profileError,
  };
};
