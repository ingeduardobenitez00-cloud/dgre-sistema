'use server';

import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    // En entornos de producción (Firebase App Hosting, Vercel), las credenciales por defecto se detectan automáticamente.
    admin.initializeApp();
  } catch (error) {
    console.error('Error inicializando firebase-admin:', error);
  }
}

export async function deleteUserFromAuth(uid: string) {
  try {
    await admin.auth().deleteUser(uid);
    return { success: true };
  } catch (error: any) {
    console.error('Error en deleteUserFromAuth:', error.message);
    return { success: false, error: error.message };
  }
}
