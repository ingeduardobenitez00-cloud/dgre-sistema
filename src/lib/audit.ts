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
  data_snapshot?: any; 
  fecha_servidor: any;
}

/**
 * Función central para registrar eventos de auditoría.
 * Silenciada en producción para evitar exposición de trazas innecesarias.
 */
export function recordAuditLog(
  db: Firestore,
  entry: Omit<AuditEntry, 'fecha_servidor'>
) {
  const auditRef = collection(db, 'auditoria');
  
  addDoc(auditRef, {
    ...entry,
    fecha_servidor: serverTimestamp(),
  }).catch((err) => {
    // Silenciamos el error en consola en producción para evitar ruido visual excesivo
    if (process.env.NODE_ENV !== 'production') {
        console.error("Error crítico en motor de auditoría:", err);
    }
  });
}
