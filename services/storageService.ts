
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
  orderBy,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';

const COLLECTION_NAME = 'maintenance_records';
const USAGE_KEY = 'metro_firebase_usage';
const SEED_KEY = 'metro_bcn_seeded_v1';

const sanitizeData = (data: any) => {
  return JSON.parse(JSON.stringify(data));
};

const trackFirebaseUsage = (type: 'read' | 'write' | 'delete', count: number = 1) => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const stored = localStorage.getItem(USAGE_KEY);
  let stats = stored ? JSON.parse(stored) : { date: today, reads: 0, writes: 0, deletes: 0 };

  if (stats.date !== today) {
    stats = { date: today, reads: 0, writes: 0, deletes: 0 };
  }

  if (type === 'read') stats.reads += count;
  if (type === 'write') stats.writes += count;
  if (type === 'delete') stats.deletes += count;

  localStorage.setItem(USAGE_KEY, JSON.stringify(stats));
};

export const StorageService = {
  getUsageStats: () => {
    const today = new Date().toISOString().split('T')[0];
    const stored = localStorage.getItem(USAGE_KEY);
    const stats = stored ? JSON.parse(stored) : { date: today, reads: 0, writes: 0, deletes: 0 };
    if (stats.date !== today) return { date: today, reads: 0, writes: 0, deletes: 0 };
    return stats;
  },

  /**
   * Suscribe a la colección en tiempo real.
   * Firebase gestiona internamente la caché y solo notifica cambios.
   */
  subscribeToRecords: (onUpdate: (records: MaintenanceRecord[]) => void): Unsubscribe => {
    const recordsRef = collection(db, COLLECTION_NAME);
    const q = query(recordsRef, orderBy("date", "desc"));
    
    return onSnapshot(q, (snapshot) => {
      const data: MaintenanceRecord[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as MaintenanceRecord);
      });
      
      // En tiempo real, trackeamos el tamaño inicial o cambios
      trackFirebaseUsage('read', snapshot.docChanges().length || snapshot.size);
      onUpdate(data);
    }, (error) => {
      console.error("Error en suscripción tiempo real:", error);
    });
  },

  // Mantenemos getAll por compatibilidad de tipos, pero la App usará subscribe
  getAll: async (): Promise<MaintenanceRecord[]> => {
    try {
      const recordsRef = collection(db, COLLECTION_NAME);
      const q = query(recordsRef, orderBy("date", "desc")); 
      const querySnapshot = await getDocs(q);
      const data: MaintenanceRecord[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as MaintenanceRecord);
      });
      trackFirebaseUsage('read', querySnapshot.size || 1);
      return data;
    } catch (error) {
      return [];
    }
  },

  save: async (record: MaintenanceRecord): Promise<void> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, record.id);
      const cleanRecord = sanitizeData(record);
      await setDoc(docRef, cleanRecord, { merge: true });
      trackFirebaseUsage('write', 1);
    } catch (error) {
      console.error("Error Firebase save:", error);
      throw error;
    }
  },

  delete: async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
      trackFirebaseUsage('delete', 1);
    } catch (error) {
      console.error("Error Firebase delete:", error);
      throw error;
    }
  },

  importData: async (importedData: MaintenanceRecord[]): Promise<void> => {
    try {
      const batch = writeBatch(db);
      importedData.forEach((item) => {
        const docRef = doc(db, COLLECTION_NAME, item.id);
        batch.set(docRef, sanitizeData(item), { merge: true });
      });
      await batch.commit();
      trackFirebaseUsage('write', importedData.length);
    } catch (error) {
      console.error("Error Import:", error);
      throw error;
    }
  },

  seedData: async () => {
    if (localStorage.getItem(SEED_KEY)) return;
    try {
      const recordsRef = collection(db, COLLECTION_NAME);
      const snapshot = await getDocs(recordsRef);
      if (snapshot.empty) {
        const initialData: MaintenanceRecord[] = [
          { 
            id: 'seed-1', station: 'Sagrada Familia', nes: '023PV', deviceCode: 'VE 01-11-05',
            deviceType: DeviceType.VENT_ESTACION, status: EquipmentStatus.OPERATIONAL,
            readings: { speedFast: 12.5, speedSlow: 8.2 }, date: new Date().toISOString(),
            notes: 'Dato inicial de sistema.'
          }
        ];
        for (const record of initialData) {
            await setDoc(doc(db, COLLECTION_NAME, record.id), record);
        }
      }
      localStorage.setItem(SEED_KEY, 'true');
    } catch (e) {}
  }
};
