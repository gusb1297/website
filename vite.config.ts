import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    server: {
      // Allow all hosts (Development only)
      allowedHosts: true,

      // Listen on all network interfaces
      host: '0.0.0.0',

      // Optional port
      port: 5173,

      // Enable HMR unless disabled by environment
      hmr: process.env.DISABLE_HMR !== 'true',

      // Disable file watching when HMR is disabled
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },

    preview: {
      host: '0.0.0.0',
      port: 4173,
      allowedHosts: true,
    },
  };
});