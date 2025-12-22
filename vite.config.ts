import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Fix: Define __dirname for ESM environments as it is not available by default in Vite config
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    resolve: {
      alias: {
        // Fix: Use the manually defined __dirname to resolve the root '@' alias
        '@': path.resolve(__dirname, '.'),
      }
    }
});