import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ command, mode }) => {
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'src/popup/popup.tsx'),
          background: resolve(__dirname, 'src/background/background.ts'),
          // Skip content script from Vite build - use simple JS version
        },
        output: {
          entryFileNames: '[name].js',
          assetFileNames: '[name].[ext]',
          format: 'es',
        }
      },
      target: 'es2020',
      minify: false, // Keep readable for development
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      global: 'globalThis',
    },
  };
});