
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
      const nesSearchTerms = codes.flatMap(c => {
        const up = c.toUpperCase().replace(/\s/g, '');
        const clean = up.replace(/^NES/, '');
        return [up, clean];
      });
      const deviceSearchTerms = codes.map(c => c.toUpperCase().trim());
      const uniqueNes = [...new Set(nesSearchTerms)];
      const uniqueDev = [...new Set(deviceSearchTerms)];
      const chunks = [];
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
      return records.sort((a, b) => a.deviceCode.localeCompare(b.deviceCode));
    } catch (e) { return []; }
  },

  searchByText: async (text: string): Promise<MaintenanceRecord[]> => {
    if (text.length < 2) return [];
    try {
      const originalInput = text.trim();
      const searchUpper = originalInput.toUpperCase();
      
      // Intentar extraer el prefijo para filtrado inteligente
      const typePrefixes = ['PE', 'VE', 'VT', 'FS', 'PA'];
      let detectedPrefix = '';
      let secondaryTerm = '';
      
      const parts = originalInput.split(/\s+/);
      if (parts.length > 0) {
        const firstPart = parts[0].toUpperCase();
        if (typePrefixes.includes(firstPart)) {
          detectedPrefix = firstPart === 'PA' ? 'PE' : firstPart;
          secondaryTerm = parts.slice(1).join(' ').trim();
        } else {
          // Si el prefijo está al final (ej: "Clot VT")
          const lastPart = parts[parts.length - 1].toUpperCase();
          if (typePrefixes.includes(lastPart)) {
            detectedPrefix = lastPart === 'PA' ? 'PE' : lastPart;
            secondaryTerm = parts.slice(0, -1).join(' ').trim();
          }
        }
      }

      const toTitleCase = (str: string) => str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
      const termTitle = toTitleCase(secondaryTerm || originalInput);
      const termUpper = (secondaryTerm || originalInput).toUpperCase();
      const searchNes = termUpper.replace(/^NES/, '');
      
      const FETCH_LIMIT = 50;
      const coll = collection(db, COLLECTION_NAME);

      // QUERIES
      // 1. Buscar por código de equipo empezando por el input original completo (ej: "VE 01")
      const qFullCode = query(coll, orderBy("deviceCode"), startAt(searchUpper), endAt(searchUpper + '\uf8ff'), limit(FETCH_LIMIT));
      
      // 2. Buscar por Estación empezando por el input o el término secundario
      const qStationTitle = query(coll, orderBy("station"), startAt(termTitle), endAt(termTitle + '\uf8ff'), limit(FETCH_LIMIT));
      const qStationUpper = query(coll, orderBy("station"), startAt(searchUpper), endAt(searchUpper + '\uf8ff'), limit(FETCH_LIMIT));
      
      // 3. Buscar por NES
      const qNes = query(coll, orderBy("nes"), startAt(searchNes), endAt(searchNes + '\uf8ff'), limit(FETCH_LIMIT));

      const [sFullCode, sStationTitle, sStationUpper, sNes] = await Promise.all([
        getDocs(qFullCode), 
        getDocs(qStationTitle),
        getDocs(qStationUpper),
        getDocs(qNes)
      ]);
      
      let records: MaintenanceRecord[] = [];
      const ids = new Set();
      
      const processSnap = (snap: any) => {
        snap.forEach((doc: any) => {
          if (!ids.has(doc.id)) {
            const data = doc.data() as MaintenanceRecord;
            const item = { id: doc.id, ...data };
            
            // Si el usuario incluyó un prefijo explícito (ej: "PE"), filtramos
            if (detectedPrefix) {
               if (item.deviceCode?.toUpperCase().startsWith(detectedPrefix)) {
                 ids.add(doc.id);
                 records.push(item);
               }
            } else {
              ids.add(doc.id);
              records.push(item);
            }
          }
        });
      };

      [sFullCode, sStationTitle, sStationUpper, sNes].forEach(processSnap);

      trackFirebaseUsage('read', sFullCode.size + sStationTitle.size + sStationUpper.size + sNes.size);
      
      // Ordenar de menor a mayor por código
      return records.sort((a, b) => a.deviceCode.localeCompare(b.deviceCode));
    } catch (e) { 
      console.error("Search error:", e);
      return []; 
    }
  },

  subscribeToIncidents: (onUpdate: (records: MaintenanceRecord[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTION_NAME), where("status", "==", EquipmentStatus.INCIDENT));
    return onSnapshot(q, (snapshot) => {
      const data: MaintenanceRecord[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as MaintenanceRecord));
      trackFirebaseUsage('read', snapshot.docChanges().length || snapshot.size);
      onUpdate(data.sort((a, b) => a.deviceCode.localeCompare(b.deviceCode)));
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
      const q = query(collection(db, COLLECTION_NAME), orderBy("deviceCode", "asc")); 
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
