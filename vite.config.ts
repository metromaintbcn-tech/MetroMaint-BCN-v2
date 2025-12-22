import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Fix: Define __dirname for ESM environments
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  // Cargamos las variables de entorno (incluyendo las de Vercel)
  // Fix: Use path.resolve() instead of process.cwd() to fix 'Property cwd does not exist on type Process' error.
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
      // Este es el puente crítico: 
      // Mapeamos la variable VITE_API_KEY que tienes en Vercel 
      // al objeto process.env.API_KEY que requiere el SDK de Gemini.
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY || env.API_KEY),
      // Mantenemos compatibilidad para otros posibles usos de process.env
      'process.env': {
        API_KEY: JSON.stringify(env.VITE_API_KEY || env.API_KEY)
      }
    }
  };
});