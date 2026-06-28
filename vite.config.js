import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Force Vite's pre-bundler to wrap the CJS mediapipe package into an ESM module
    include: ['@mediapipe/hands'],
  },
  build: {
    rollupOptions: {
      // Treat the wasm/worker files mediapipe loads at runtime as external assets
      external: [],
    },
  },
});
