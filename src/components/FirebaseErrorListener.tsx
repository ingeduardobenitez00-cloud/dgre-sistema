'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';

/**
 * Escucha errores de permisos de Firestore y los maneja silenciosamente
 * durante el logout para evitar alertas innecesarias.
 */
export function FirebaseErrorListener() {
  const { toast } = useToast();
  const { auth } = useFirebase();

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      // Si no hay usuario, probablemente es una transición de logout. Ignoramos.
      if (!auth?.currentUser) return;

      console.warn('SISTEMA - Acceso Denegado:', error.message);
      
      toast({
        variant: 'destructive',
        title: 'Acceso Restringido',
        description: 'No tienes permisos suficientes para realizar esta acción.',
      });
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [toast, auth]);

  return null;
}
