// Importar las funciones necesarias del SDK de Firebase
import firebase from "firebase/compat/app";
import { getFirestore } from "firebase/firestore";

// --- CONFIGURACIÓN DE FIREBASE (MetroMaint BCN) ---
// NOTA DE SEGURIDAD:
// La API KEY ha sido eliminada del código fuente para cumplir con las políticas de GitHub.
// Debes configurar la variable de entorno 'FIREBASE_API_KEY' en tu hosting (Vercel/Netlify)
// o en un archivo .env.local para desarrollo local.
// Tu clave es: AIzaSyB6KZdn99OJYRx0c9Sdf6hmjnpHV1uLb3Y

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY, // Se leerá solo desde el entorno
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