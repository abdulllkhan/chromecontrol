import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ command, mode }) => {
  const isProduction = mode === 'production';
  
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
          sidebar: resolve(__dirname, 'src/sidebar/sidebar.tsx'),
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
      minify: isProduction,
      sourcemap: !isProduction,
      reportCompressedSize: isProduction,
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode || 'development'),
      global: 'globalThis',
    },
  };
});