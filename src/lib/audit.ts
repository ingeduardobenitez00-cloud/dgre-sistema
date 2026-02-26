
import { Firestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Tipos de acciones permitidas en la auditoría
 */
export type AuditAction = 'CREAR' | 'EDITAR' | 'BORRAR' | 'PDF_GENERADO' | 'LOGIN' | 'LOGOUT';

/**
 * Estructura de un registro de auditoría
 */
export interface AuditEntry {
  usuario_id: string;
  usuario_nombre: string;
  usuario_rol: string;
  accion: AuditAction;
  modulo: string;
  documento_id?: string;
  detalles?: string;
  data_snapshot?: any; // Captura opcional del estado de los datos
  fecha_servidor: any;
}

/**
 * Función central para registrar eventos de auditoría.
 * No bloquea la ejecución principal (non-blocking).
 */
export function recordAuditLog(
  db: Firestore,
  entry: Omit<AuditEntry, 'fecha_servidor'>
) {
  const auditRef = collection(db, 'auditoria');
  
  // Guardamos el log sin esperar (non-blocking) para no afectar la UX
  addDoc(auditRef, {
    ...entry,
    fecha_servidor: serverTimestamp(),
  }).catch((err) => {
    console.error("Error crítico en motor de auditoría:", err);
  });
}
