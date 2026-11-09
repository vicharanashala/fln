import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The app is served under /v2/fln/ in production; set VITE_BASE_PATH for that build.
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:3100' } },
});
