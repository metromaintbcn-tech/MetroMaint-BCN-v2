
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

// Limpieza de datos para Firebase
const sanitizeData = (data: any) => {
  return JSON.parse(JSON.stringify(data));
};

export const StorageService = {
  // OBTENER TODOS LOS REGISTROS (Con Caché para ahorrar cuota)
  getAll: async (forceRefresh = false): Promise<MaintenanceRecord[]> => {
    try {
      // Intentar cargar de localStorage primero para velocidad e offline
      if (!forceRefresh) {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          // Si la caché tiene menos de 5 minutos, la usamos
          if (Date.now() - parsed.timestamp < 300000) {
            return parsed.data;
          }
        }
      }

      const recordsRef = collection(db, COLLECTION_NAME);
      const q = query(recordsRef, orderBy("date", "desc")); 
      const querySnapshot = await getDocs(q);
      
      const data: MaintenanceRecord[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as MaintenanceRecord);
      });
      
      // Guardar en caché local
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

  // GUARDAR SIN RE-DESCARGAR TODO (Ahorro de cuota)
  save: async (record: MaintenanceRecord, currentData: MaintenanceRecord[]): Promise<MaintenanceRecord[]> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, record.id);
      const cleanRecord = sanitizeData(record);
      await setDoc(docRef, cleanRecord, { merge: true });
      
      // Actualizamos la lista local manualmente en lugar de llamar a getAll()
      const index = currentData.findIndex(r => r.id === record.id);
      let newData;
      if (index > -1) {
        newData = [...currentData];
        newData[index] = record;
      } else {
        newData = [record, ...currentData];
      }

      // Actualizar caché
      localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: newData }));
      return newData;
    } catch (error) {
      console.error("Error Firebase save:", error);
      throw error;
    }
  },

  // ELIMINAR SIN RE-DESCARGAR TODO
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
      localStorage.removeItem(CACHE_KEY); // Forzamos refresco en el próximo getAll
    } catch (error) {
      console.error("Error Import:", error);
      throw error;
    }
  },

  seedData: async () => {
    // Solo ejecutamos seed si no hay caché y no hay internet o es la primera vez
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) return;
    
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
