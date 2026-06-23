import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate heavy three.js libs to allow better caching / perceived smaller initial bundle (L7 bundle task)
          three: ['three', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing']
        }
      }
    }
  }
});
