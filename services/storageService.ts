
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
// Caché agresiva: 24 horas para minimizar lecturas en el plan gratuito
const CACHE_DURATION = 24 * 60 * 60 * 1000; 

const sanitizeData = (data: any) => {
  return JSON.parse(JSON.stringify(data));
};

export const StorageService = {
  getAll: async (forceRefresh = false): Promise<MaintenanceRecord[]> => {
    try {
      // Intentar usar caché local persistente primero
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached && !forceRefresh) {
        const parsed = JSON.parse(cached);
        // Si los datos tienen menos de 24 horas, no consultamos Firebase
        if (Date.now() - parsed.timestamp < CACHE_DURATION) {
          return parsed.data;
        }
      }

      // Solo si no hay caché o es muy vieja, leemos de Firebase
      const recordsRef = collection(db, COLLECTION_NAME);
      const q = query(recordsRef, orderBy("date", "desc")); 
      const querySnapshot = await getDocs(q);
      
      const data: MaintenanceRecord[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as MaintenanceRecord);
      });
      
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
      localStorage.removeItem(CACHE_KEY);
    } catch (error) {
      console.error("Error Import:", error);
      throw error;
    }
  },

  seedData: async () => {
    // Evitar lectura de comprobación si ya tenemos datos locales
    if (localStorage.getItem(CACHE_KEY)) return;
    
    try {
      const recordsRef = collection(db, COLLECTION_NAME);
      const snapshot = await getDocs(recordsRef);
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
        }
      }
    } catch (e) {}
  }
};
