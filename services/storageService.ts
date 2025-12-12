import { MaintenanceRecord, DeviceType, EquipmentStatus } from '../types';
import { db } from './firebaseConfig';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  writeBatch, 
  query, 
  orderBy 
} from 'firebase/firestore';

const COLLECTION_NAME = 'maintenance_records';

// FUNCIÓN DE LIMPIEZA: Elimina cualquier campo 'undefined' del objeto
// Firebase falla si recibe { location: undefined }, prefiere que no exista la clave.
const sanitizeData = (data: any) => {
  // JSON.stringify ignora automáticamente las claves con valor undefined
  // Es un truco rápido y robusto para limpiar objetos de datos simples.
  return JSON.parse(JSON.stringify(data));
};

export const StorageService = {
  // OBTENER TODOS LOS REGISTROS DE LA NUBE
  getAll: async (): Promise<MaintenanceRecord[]> => {
    try {
      const recordsRef = collection(db, COLLECTION_NAME);
      // Ordenamos por fecha descendente (lo más nuevo primero)
      const q = query(recordsRef, orderBy("date", "desc")); 
      const querySnapshot = await getDocs(q);
      
      const data: MaintenanceRecord[] = [];
      querySnapshot.forEach((doc) => {
        // Combinamos el ID del documento con los datos
        data.push({ id: doc.id, ...doc.data() } as MaintenanceRecord);
      });
      
      return data;
    } catch (error) {
      console.error("Error al obtener datos de Firebase:", error);
      // Si falla (ej: sin internet), devolvemos array vacío o podríamos intentar localStorage como backup
      return [];
    }
  },

  // GUARDAR O ACTUALIZAR UN REGISTRO
  save: async (record: MaintenanceRecord): Promise<MaintenanceRecord[]> => {
    try {
      // Usamos el ID del registro como ID del documento en Firebase
      const docRef = doc(db, COLLECTION_NAME, record.id);
      
      // LIMPIEZA DE SEGURIDAD
      const cleanRecord = sanitizeData(record);

      // setDoc crea el documento si no existe, o lo sobrescribe si existe.
      await setDoc(docRef, cleanRecord, { merge: true });
      
      // Para que la app se actualice rápido, devolvemos la lista completa actualizada
      return await StorageService.getAll();
    } catch (error) {
      console.error("Error al guardar en Firebase:", error);
      throw error;
    }
  },

  // ELIMINAR UN REGISTRO
  delete: async (id: string): Promise<MaintenanceRecord[]> => {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
      return await StorageService.getAll();
    } catch (error) {
      console.error("Error al eliminar de Firebase:", error);
      throw error;
    }
  },

  // BORRAR TODO (PELIGROSO - SOLO ADMIN)
  deleteAll: async (): Promise<MaintenanceRecord[]> => {
    try {
      const recordsRef = collection(db, COLLECTION_NAME);
      const snapshot = await getDocs(recordsRef);
      
      // Firestore no tiene un "delete all", hay que borrar uno a uno o por lotes (batches)
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      return [];
    } catch (error) {
      console.error("Error al vaciar la base de datos:", error);
      throw error;
    }
  },

  // IMPORTAR DATOS MASIVOS (CSV)
  importData: async (importedData: MaintenanceRecord[]): Promise<number> => {
    try {
      // Usamos un Batch para que sea más eficiente (escritura en lote)
      const batch = writeBatch(db);
      
      importedData.forEach((item) => {
        const docRef = doc(db, COLLECTION_NAME, item.id);
        
        // LIMPIEZA CRÍTICA: Eliminar undefineds que rompen el batch
        const cleanItem = sanitizeData(item);
        
        batch.set(docRef, cleanItem, { merge: true });
      });

      await batch.commit();
      return importedData.length;
    } catch (error) {
      console.error("Error al importar datos masivos:", error);
      throw error;
    }
  },

  // CREAR DATOS DE EJEMPLO SI ESTÁ VACÍA
  seedData: async () => {
    try {
      const recordsRef = collection(db, COLLECTION_NAME);
      const snapshot = await getDocs(recordsRef);
      
      if (snapshot.empty) {
        console.log("Base de datos vacía. Insertando datos de ejemplo...");
        const initialData: MaintenanceRecord[] = [
          { 
            id: 'seed-1', 
            station: 'Sagrada Familia', 
            nes: '023PV', 
            deviceCode: 'VE 01-11-05',
            deviceType: DeviceType.VENT_ESTACION, 
            status: EquipmentStatus.OPERATIONAL,
            readings: { speedFast: 120.5, speedSlow: 80.2 }, 
            date: new Date().toISOString(),
            notes: 'Funcionamiento correcto. (Dato de ejemplo)'
          },
          { 
            id: 'seed-2', 
            station: 'Diagonal', 
            nes: '150PE', 
            deviceCode: 'PA 05-11-99',
            deviceType: DeviceType.POZO_AGOTAMIENTO, 
            status: EquipmentStatus.INCIDENT,
            readings: { pump1: 45.2, pump2: 42.1 }, 
            date: new Date(Date.now() - 86400000).toISOString(),
            notes: 'Vibración inusual en Bomba 1. (Dato de ejemplo)'
          }
        ];
        
        // Insertamos uno a uno
        for (const record of initialData) {
            await setDoc(doc(db, COLLECTION_NAME, record.id), record);
        }
      }
    } catch (error) {
        console.error("Error en seedData:", error);
    }
  }
};