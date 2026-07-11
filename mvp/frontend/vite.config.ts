import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to the backend, avoiding CORS in dev.
      '/api': 'http://localhost:4000',
    },
  },
});
