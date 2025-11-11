
'use client';

import { addDoc, collection, serverTimestamp, type Firestore } from "firebase/firestore";
import type { User } from "firebase/auth";

type Action = 
  | 'login'
  | 'logout'
  | 'create-user'
  | 'update-user'
  | 'delete-user'
  | 'reset-password'
  | 'create-report'
  | 'update-report'
  | 'upload-images'
  | 'delete-image'
  | 'import-datos'
  | 'import-reports'
  | 'create-dato'
  | 'update-dato'
  | 'delete-dato';

type Entity = 'user' | 'report' | 'image' | 'dato' | 'import' | 'auth' | 'general';

interface LogParams {
  firestore: Firestore;
  user: User | null;
  action: Action;
  entity: Entity;
  entityId: string;
  details?: Record<string, any>;
}

export async function logUserAction({ firestore, user, action, entity, entityId, details }: LogParams) {
  if (!user) {
    console.error("Audit Log Error: Cannot log action for unauthenticated user.");
    return;
  }

  try {
    const auditLogsCollection = collection(firestore, 'audit-logs');
    await addDoc(auditLogsCollection, {
      userId: user.uid,
      userEmail: user.email,
      action,
      entity,
      entityId,
      timestamp: serverTimestamp(),
      details: details || {},
    });
  } catch (error) {
    console.error("Failed to write to audit log:", error);
    // Optionally, you can re-throw or handle this more gracefully.
    // In many cases, you might not want a failed audit log to break the user's action.
  }
}
