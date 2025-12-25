
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Fix: Define __dirname for ESM environments
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  // Cargamos las variables de entorno (incluyendo las de Vercel)
  const env = loadEnv(mode, path.resolve(), '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    define: {
      // Mapeo explícito de variables críticas para que funcionen en producción
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY || env.API_KEY),
      'process.env.VITE_FIREBASE_API_KEY': JSON.stringify(env.VITE_FIREBASE_API_KEY || env.FIREBASE_API_KEY),
      // Mantenemos compatibilidad de objeto para otros módulos
      'process.env': {
        API_KEY: JSON.stringify(env.VITE_API_KEY || env.API_KEY),
        VITE_FIREBASE_API_KEY: JSON.stringify(env.VITE_FIREBASE_API_KEY || env.FIREBASE_API_KEY)
      }
    }
  };
});
