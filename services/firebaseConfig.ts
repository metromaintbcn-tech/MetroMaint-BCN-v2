
// Importar las funciones necesarias del SDK de Firebase
import firebase from "firebase/compat/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

// --- CONFIGURACIÓN DE FIREBASE (MetroMaint BCN) ---
let firebaseApiKey = "";

try {
  // @ts-ignore
  firebaseApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
} catch (error) {
  console.warn("Error accediendo a import.meta.env:", error);
}

if (!firebaseApiKey && typeof process !== "undefined" && process.env) {
  firebaseApiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
}

const firebaseConfig = {
  apiKey: firebaseApiKey,
  authDomain: "metromaint-bcn.firebaseapp.com",
  projectId: "metromaint-bcn",
  storageBucket: "metromaint-bcn.firebasestorage.app",
  messagingSenderId: "914679456958",
  appId: "1:914679456958:web:29543fe81fcdff4a076aef",
  measurementId: "G-WGS7CJCS2C"
};

// Inicializar Firebase
const app = firebase.initializeApp(firebaseConfig);

// Inicializar la base de datos (Firestore) y exportarla
export const db = getFirestore(app as any);

// Habilitar persistencia de datos local para minimizar lecturas (Spark Plan)
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("La persistencia falló: múltiples pestañas abiertas.");
    } else if (err.code === 'unimplemented') {
      console.warn("El navegador no soporta persistencia.");
    }
  });
}
