import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// El .env vive en la raíz del monorepo (compartido con la API). Vite solo expone al navegador las VITE_*.
const envDir = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '');
  const puertoApi = env.PORT || '3000';

  return {
    envDir,
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      // En desarrollo, /api va a la API local: mismo origen, sin problemas de CORS.
      proxy: { '/api': `http://localhost:${puertoApi}` },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
    },
  };
});
