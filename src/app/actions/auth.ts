'use server';

import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    // En entornos de producción (Firebase App Hosting, Vercel), las credenciales por defecto se detectan automáticamente.
    admin.initializeApp();
  } catch (error: any) {
    console.error('Error inicializando firebase-admin en el servidor:', error.message);
    if (error?.message?.includes('credential')) {
      console.warn('TIP: Ejecuta "gcloud auth application-default login" en tu terminal local para habilitar permisos administrativos.');
    }
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
