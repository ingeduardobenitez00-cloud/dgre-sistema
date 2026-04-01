import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Nota: En entorno local, firebase-admin buscará las credenciales en 
// la variable de entorno GOOGLE_APPLICATION_CREDENTIALS o usará las por defecto si estás en la nube.
if (getApps().length === 0) {
  initializeApp();
}

const auth = getAuth();
const db = getFirestore();

async function fixAdmin(email: string) {
  try {
    console.log(`Buscando usuario con email: ${email}...`);
    const userRecord = await auth.getUserByEmail(email);
    const uid = userRecord.uid;
    
    console.log(`Usuario encontrado! UID: ${uid}`);
    console.log(`Actualizando perfil en Firestore a rol 'admin'...`);
    
    await db.collection('users').doc(uid).set({
      email: email,
      role: 'admin',
      active: true,
      nombre: 'Administrador Maestro'
    }, { merge: true });
    
    console.log('✅ ÉXITO: Tu cuenta ahora tiene permisos de administrador real en Firestore.');
    console.log('Ahora puedes recargar la web y el error de Acceso Restringido debería desaparecer.');
  } catch (error) {
    console.error('❌ Error al intentar arreglar el admin:', error);
    console.log('\nTIP: Si sale un error de "Credential", asegúrate de estar logueado en la terminal con "gcloud auth application-default login" o de tener tu archivo de Service Account.');
  }
}

const targetEmail = process.argv[2] || 'edubtz11@gmail.com';
fixAdmin(targetEmail);
