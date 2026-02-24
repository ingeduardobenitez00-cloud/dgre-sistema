
'use client';
import { useMemo, useState, useEffect } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { type User } from 'firebase/auth';

export interface UserProfile {
  username?: string;
  role?: 'admin' | 'director' | 'jefe' | 'funcionario' | 'viewer';
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

  const loading = isAuthLoading || (!!authUser && isProfileLoading && !profileLoadingComplete);

  return {
    user: enrichedUser,
    isUserLoading: loading,
    userError: authError || profileError,
  };
};
