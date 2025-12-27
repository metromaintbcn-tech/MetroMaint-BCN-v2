
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
  Unsubscribe,
  limit,
  where,
  getCountFromServer,
  startAt,
  endAt
} from 'firebase/firestore';

const COLLECTION_NAME = 'maintenance_records';
const USAGE_KEY = 'metro_firebase_usage';

const trackFirebaseUsage = (type: 'read' | 'write' | 'delete', count: number = 1) => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const stored = localStorage.getItem(USAGE_KEY);
  let stats = stored ? JSON.parse(stored) : { date: today, reads: 0, writes: 0, deletes: 0 };
  if (stats.date !== today) stats = { date: today, reads: 0, writes: 0, deletes: 0 };
  if (type === 'read') stats.reads += count;
  if (type === 'write') stats.writes += count;
  if (type === 'delete') stats.deletes += count;
  localStorage.setItem(USAGE_KEY, JSON.stringify(stats));
};

export const StorageService = {
  getUsageStats: () => {
    const today = new Date().toISOString().split('T')[0];
    const stored = localStorage.getItem(USAGE_KEY);
    return stored ? JSON.parse(stored) : { date: today, reads: 0, writes: 0, deletes: 0 };
  },

  getTotalCount: async (): Promise<number> => {
    try {
      const coll = collection(db, COLLECTION_NAME);
      const snapshot = await getCountFromServer(coll);
      trackFirebaseUsage('read', 1);
      return snapshot.data().count;
    } catch (e) { return 0; }
  },

  getByCodes: async (codes: string[]): Promise<MaintenanceRecord[]> => {
    if (!codes.length) return [];
    try {
      const records: MaintenanceRecord[] = [];
      
      // Normalización agresiva: probamos con prefijo NES y sin él para cubrir cualquier formato en DB
      const nesSearchTerms = codes.flatMap(c => {
        const up = c.toUpperCase().replace(/\s/g, '');
        const clean = up.replace(/^NES/, '');
        return [up, clean]; // Buscamos tanto NES003FS como 003FS
      });
      
      const deviceSearchTerms = codes.map(c => c.toUpperCase().trim());
      
      // Eliminar duplicados en los términos de búsqueda
      const uniqueNes = [...new Set(nesSearchTerms)];
      const uniqueDev = [...new Set(deviceSearchTerms)];

      const chunks = [];
      // Firestore 'in' solo permite 10 o 30 elementos dependiendo de la versión/config, usamos 10 por seguridad
      for (let i = 0; i < Math.max(uniqueNes.length, uniqueDev.length); i += 10) {
        chunks.push({
          nes: uniqueNes.slice(i, i + 10),
          dev: uniqueDev.slice(i, i + 10)
        });
      }

      for (const chunk of chunks) {
        const promises = [];
        if (chunk.nes.length) promises.push(getDocs(query(collection(db, COLLECTION_NAME), where("nes", "in", chunk.nes))));
        if (chunk.dev.length) promises.push(getDocs(query(collection(db, COLLECTION_NAME), where("deviceCode", "in", chunk.dev))));
        
        const snapshots = await Promise.all(promises);
        
        snapshots.forEach(snap => {
          snap.forEach(doc => {
            if (!records.find(r => r.id === doc.id)) {
              records.push({ id: doc.id, ...doc.data() } as MaintenanceRecord);
            }
          });
        });
        
        trackFirebaseUsage('read', snapshots.reduce((acc, s) => acc + s.size, 0));
      }
      return records;
    } catch (e) { 
      console.error("Storage Error:", e);
      return []; 
    }
  },

  searchByText: async (text: string): Promise<MaintenanceRecord[]> => {
    if (text.length < 2) return [];
    try {
      const searchRaw = text.trim();
      const searchUpper = searchRaw.toUpperCase();
      const toTitleCase = (str: string) => str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
      const searchTitle = toTitleCase(searchRaw);
      const searchNes = searchUpper.replace(/^NES/, '');
      const SURGICAL_LIMIT = 5;

      const qCode = query(collection(db, COLLECTION_NAME), orderBy("deviceCode"), startAt(searchUpper), endAt(searchUpper + '\uf8ff'), limit(SURGICAL_LIMIT));
      const qNes = query(collection(db, COLLECTION_NAME), orderBy("nes"), startAt(searchNes), endAt(searchNes + '\uf8ff'), limit(SURGICAL_LIMIT));
      const qStationTitle = query(collection(db, COLLECTION_NAME), orderBy("station"), startAt(searchTitle), endAt(searchTitle + '\uf8ff'), limit(SURGICAL_LIMIT));
      const qStationUpper = query(collection(db, COLLECTION_NAME), orderBy("station"), startAt(searchUpper), endAt(searchUpper + '\uf8ff'), limit(SURGICAL_LIMIT));

      const [sCode, sNes, sTitle, sUpper] = await Promise.all([
        getDocs(qCode), 
        getDocs(qNes), 
        getDocs(qStationTitle),
        getDocs(qStationUpper)
      ]);
      
      const records: MaintenanceRecord[] = [];
      const ids = new Set();
      
      [sCode, sNes, sTitle, sUpper].forEach(snap => {
        snap.forEach(doc => {
          if (!ids.has(doc.id)) {
            ids.add(doc.id);
            records.push({ id: doc.id, ...doc.data() } as MaintenanceRecord);
          }
        });
      });

      trackFirebaseUsage('read', sCode.size + sNes.size + sTitle.size + sUpper.size);
      return records.slice(0, 5);
    } catch (e) { return []; }
  },

  subscribeToIncidents: (onUpdate: (records: MaintenanceRecord[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTION_NAME), where("status", "==", EquipmentStatus.INCIDENT));
    return onSnapshot(q, (snapshot) => {
      const data: MaintenanceRecord[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as MaintenanceRecord));
      trackFirebaseUsage('read', snapshot.docChanges().length || snapshot.size);
      onUpdate(data);
    });
  },

  subscribeToRecent: (onUpdate: (records: MaintenanceRecord[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTION_NAME), orderBy("date", "desc"), limit(5));
    return onSnapshot(q, (snapshot) => {
      const data: MaintenanceRecord[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as MaintenanceRecord));
      trackFirebaseUsage('read', snapshot.docChanges().length || snapshot.size);
      onUpdate(data);
    });
  },

  getAll: async (): Promise<MaintenanceRecord[]> => {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy("date", "desc")); 
      const querySnapshot = await getDocs(q);
      trackFirebaseUsage('read', querySnapshot.size);
      const data: MaintenanceRecord[] = [];
      querySnapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() } as MaintenanceRecord));
      return data;
    } catch (error) { return []; }
  },

  save: async (record: MaintenanceRecord): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, record.id);
    await setDoc(docRef, JSON.parse(JSON.stringify(record)), { merge: true });
    trackFirebaseUsage('write', 1);
  },

  delete: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
    trackFirebaseUsage('delete', 1);
  },

  importData: async (importedData: MaintenanceRecord[]): Promise<void> => {
    const batch = writeBatch(db);
    importedData.forEach((item) => {
      const docRef = doc(db, COLLECTION_NAME, item.id);
      batch.set(docRef, JSON.parse(JSON.stringify(item)), { merge: true });
    });
    await batch.commit();
    trackFirebaseUsage('write', importedData.length);
  },

  seedData: async () => {
    const SEED_KEY = 'metro_seeded_v1';
    if (localStorage.getItem(SEED_KEY)) return;
    const coll = collection(db, COLLECTION_NAME);
    const snap = await getDocs(query(coll, limit(1)));
    if (snap.empty) {
      const initial = { id: 'seed-1', station: 'Sagrada Familia', nes: '001PV', deviceCode: 'VE 01-11-05', deviceType: DeviceType.VENT_ESTACION, status: EquipmentStatus.OPERATIONAL, readings: {}, date: new Date().toISOString() };
      await setDoc(doc(db, COLLECTION_NAME, initial.id), initial);
    }
    localStorage.setItem(SEED_KEY, 'true');
  }
};
