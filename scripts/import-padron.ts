/**
 * @fileOverview Script de importación masiva para el Padrón Electoral.
 * Procesa archivos Excel de 1 millón de registros cada uno y los sube a Firestore.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, writeBatch, doc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

// Configuración de Firebase (Extraída de src/firebase/config.ts)
const firebaseConfig = {
  "projectId": "studio-1827480670-a09b0",
  "appId": "1:177194041005:web:802f6167cd0c9275d19024",
  "apiKey": "AIzaSyDSgDKEI3VvXae8hMfePipJp3L7CUfArBw",
  "authDomain": "studio-1827480670-a09b0.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "177194041005"
};

// Inicialización de SDKs
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Credenciales desde variables de entorno
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

async function run() {
  console.log('\n--- MOTOR DE IMPORTACIÓN MASIVA CIDEE ---\n');

  if (!email || !password) {
    console.error('ERROR CRÍTICO: Credenciales no detectadas.');
    console.log('Uso: ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run import:padron\n');
    process.exit(1);
  }

  try {
    console.log('>> Autenticando con Firebase Auth...');
    await signInWithEmailAndPassword(auth, email, password);
    console.log('>> Conexión establecida como administrador.\n');

    // Procesar los 9 archivos secuencialmente
    for (let i = 1; i <= 9; i++) {
      await importFile(i);
    }

    console.log('>> PROCESO GLOBAL FINALIZADO EXITOSAMENTE.');
    process.exit(0);
  } catch (err: any) {
    console.error('\n>> ERROR FATAL EN EL PROCESO:', err.message);
    process.exit(1);
  }
}

async function importFile(fileNumber: number) {
  const fileName = `cedula${fileNumber}.xlsx`;
  const filePath = path.join(process.cwd(), fileName);

  if (!fs.existsSync(filePath)) {
    console.log(`[SALTADO] El archivo ${fileName} no existe en la raíz.\n`);
    return;
  }

  console.log(`[LECTURA] Abriendo ${fileName}...`);
  
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

    console.log(`[INFO] Se detectaron ${data.length.toLocaleString()} registros.`);
    console.log(`[SUBIDA] Iniciando carga a la colección 'padron'...`);

    const colRef = collection(db, 'padron');
    const BATCH_SIZE = 500;
    let processedCount = 0;

    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = data.slice(i, i + BATCH_SIZE);

      chunk.forEach((item) => {
        const newDoc = doc(colRef);
        batch.set(newDoc, {
          cedula: String(item.CEDULA || item.cedula || '').trim(),
          nombre: String(item.NOMBRE || item.nombre || '').trim(),
          apellido: String(item.APELLIDO || item.apellido || '').trim(),
          departamento: String(item.DEPARTAMENTO || item.departamento || '').trim(),
          distrito: String(item.DISTRITO || item.distrito || '').trim(),
          local: String(item.LOCAL || item.local || '').trim(),
          archivo_origen: fileName,
          fecha_importacion: new Date().toISOString()
        });
      });

      await batch.commit();
      processedCount += chunk.length;
      
      // Actualizar progreso en la misma línea
      process.stdout.write(`\r   Progreso ${fileName}: ${processedCount.toLocaleString()} / ${data.length.toLocaleString()} (${Math.round((processedCount/data.length)*100)}%)`);
      
      // Breve pausa para no saturar el ancho de banda y respetar cuotas
      await new Promise(res => setTimeout(res, 80));
    }

    console.log(`\n[OK] ${fileName} importado correctamente.\n`);
  } catch (e: any) {
    console.error(`\n[ERROR] Falló el procesamiento de ${fileName}:`, e.message);
  }
}

run();