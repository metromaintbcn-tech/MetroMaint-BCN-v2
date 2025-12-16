// Importar las funciones necesarias del SDK de Firebase
import firebase from "firebase/compat/app";
import { getFirestore } from "firebase/firestore";

// --- CONFIGURACIÓN DE FIREBASE (MetroMaint BCN) ---
// NOTA DE SEGURIDAD SOBRE EL AVISO DE VERCEL:
// Es correcto y seguro usar VITE_FIREBASE_API_KEY aquí. 
// Las API Keys de Firebase están diseñadas para ser públicas en el código cliente.
// La seguridad real se gestiona mediante las "Reglas de Seguridad de Firestore" en la consola de Firebase.

let firebaseApiKey = "";

try {
  // Intentamos acceder a la variable de Vite. 
  // Si el build funciona bien, esto se reemplaza por el string de la clave.
  // @ts-ignore
  firebaseApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
} catch (error) {
  console.warn("Error accediendo a import.meta.env:", error);
}

// Fallback: Si lo anterior falló o devolvió undefined, intentamos process.env (compatibilidad)
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
// Usamos la importación compat para evitar errores de resolución de tipos con 'initializeApp'
const app = firebase.initializeApp(firebaseConfig);

// Inicializar la base de datos (Firestore) y exportarla
// Usamos 'as any' para asegurar compatibilidad de tipos entre App compat y Firestore modular
export const db = getFirestore(app as any);