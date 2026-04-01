'use server';

import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    admin.initializeApp();
  } catch (error: any) {
    if (!error.message?.includes('already exists')) {
      console.error('Error inicializando firebase-admin en el servidor:', error.message);
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
