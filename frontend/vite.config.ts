import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "react": path.resolve(__dirname, "../node_modules/react"),
      "react-dom": path.resolve(__dirname, "../node_modules/react-dom"),
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== "true",
    watch: process.env.DISABLE_HMR === "true" ? null : {
      ignored: ["**/data/**", "**/db.json"],
    },
    port: 5173,
    proxy: {
      "/api/assessments": { target: "http://127.0.0.1:5000", changeOrigin: true },
      "/api/templates": { target: "http://127.0.0.1:5000", changeOrigin: true },
      "/uploads": { target: "http://127.0.0.1:5000", changeOrigin: true },
      "/extracted-images": { target: "http://127.0.0.1:5000", changeOrigin: true },
      "/api": { target: process.env.VITE_API_TARGET || "http://localhost:3000", changeOrigin: true },
      "/output": { target: process.env.VITE_API_TARGET || "http://localhost:3000", changeOrigin: true },
      "/worksheets": { target: process.env.VITE_API_TARGET || "http://localhost:3000", changeOrigin: true },
    },
  },
});