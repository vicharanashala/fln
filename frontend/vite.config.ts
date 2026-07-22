import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    // Deployment base path. "/" at the domain root (and dev); set VITE_BASE_PATH
    // (e.g. "/fln/") for a subpath deployment. All API/asset URLs read this via
    // import.meta.env.BASE_URL (see src/services/apiClient.ts), so no built-file
    // string rewriting is needed at deploy time.
    base: process.env.VITE_BASE_PATH || '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: ['**/data/**', '**/db.json']
      },
      // Forward all /api calls to the real backend server (Express, :3000).
      // Override the target with VITE_API_TARGET if the backend runs elsewhere.
      proxy: {
        '/api': { target: process.env.VITE_API_TARGET || 'http://127.0.0.1:3000', changeOrigin: true },
        '/output': { target: process.env.VITE_API_TARGET || 'http://127.0.0.1:3000', changeOrigin: true },
        '/worksheets': { target: process.env.VITE_API_TARGET || 'http://127.0.0.1:3000', changeOrigin: true },
      },
    },
  };
});
