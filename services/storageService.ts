
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
const CACHE_KEY = 'metro_bcn_data_cache';
const USAGE_KEY = 'metro_firebase_usage';
// Caché agresiva: 24 horas para minimizar lecturas en el plan gratuito
const CACHE_DURATION = 24 * 60 * 60 * 1000; 

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

  getAll: async (forceRefresh = false): Promise<MaintenanceRecord[]> => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached && !forceRefresh) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_DURATION) {
          return parsed.data;
        }
      }

      const recordsRef = collection(db, COLLECTION_NAME);
      const q = query(recordsRef, orderBy("date", "desc")); 
      const querySnapshot = await getDocs(q);
      
      const data: MaintenanceRecord[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as MaintenanceRecord);
      });
      
      // Tracking: cada documento leído cuenta como una lectura en Firebase
      trackFirebaseUsage('read', querySnapshot.size || 1);

      localStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data: data
      }));
      
      return data;
    } catch (error) {
      console.error("Error Firebase getAll:", error);
      const cached = localStorage.getItem(CACHE_KEY);
      return cached ? JSON.parse(cached).data : [];
    }
  },

  save: async (record: MaintenanceRecord, currentData: MaintenanceRecord[]): Promise<MaintenanceRecord[]> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, record.id);
      const cleanRecord = sanitizeData(record);
      await setDoc(docRef, cleanRecord, { merge: true });
      
      trackFirebaseUsage('write', 1);

      const index = currentData.findIndex(r => r.id === record.id);
      let newData;
      if (index > -1) {
        newData = [...currentData];
        newData[index] = record;
      } else {
        newData = [record, ...currentData];
      }

      localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: newData }));
      return newData;
    } catch (error) {
      console.error("Error Firebase save:", error);
      throw error;
    }
  },

  delete: async (id: string, currentData: MaintenanceRecord[]): Promise<MaintenanceRecord[]> => {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
      trackFirebaseUsage('delete', 1);
      
      const newData = currentData.filter(r => r.id !== id);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: newData }));
      return newData;
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
      localStorage.removeItem(CACHE_KEY);
    } catch (error) {
      console.error("Error Import:", error);
      throw error;
    }
  },

  seedData: async () => {
    if (localStorage.getItem(CACHE_KEY)) return;
    try {
      const recordsRef = collection(db, COLLECTION_NAME);
      const snapshot = await getDocs(recordsRef);
      trackFirebaseUsage('read', 1);
      if (snapshot.empty) {
        const initialData: MaintenanceRecord[] = [
          { 
            id: 'seed-1', station: 'Sagrada Familia', nes: '023PV', deviceCode: 'VE 01-11-05',
            deviceType: DeviceType.VENT_ESTACION, status: EquipmentStatus.OPERATIONAL,
            readings: { speedFast: 120.5, speedSlow: 80.2 }, date: new Date().toISOString(),
            notes: 'Dato inicial de sistema.'
          }
        ];
        for (const record of initialData) {
            await setDoc(doc(db, COLLECTION_NAME, record.id), record);
            trackFirebaseUsage('write', 1);
        }
      }
    } catch (e) {}
  }
};
