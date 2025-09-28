import { defineConfig } from 'vite'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  // Server configuration
  server: {
    port: 3000,
    open: true,
    cors: true,
  },
  
  // Base public path when deployed to Vercel
  base: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/` : '/',
  
  // Build configuration
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true, // Enable sourcemaps for debugging
    minify: 'terser', // Use terser for minification
    terserOptions: {
      compress: {
        drop_console: false, // Keep console logs for debugging
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor libraries into separate chunks
          vendor: ['pdf-lib', 'pdfjs-dist', 'docx'],
          ai: ['@xenova/transformers'],
          utils: ['file-saver'],
        },
      },
    },
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@core': path.resolve(__dirname, 'src/core'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@assets': path.resolve(__dirname, 'src/assets'),
    },
  },
  
  // CSS configuration
  css: {
    devSourcemap: true,
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'pdf-lib',
      'pdfjs-dist',
      'docx',
      '@xenova/transformers',
      'file-saver',
    ],
  },
  
  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __APP_NAME__: JSON.stringify(process.env.npm_package_name || 'Client-Side PDF Processor'),
  },
  
  // PWA configuration (if needed in future)
  // plugins: [
  //   VitePWA({
  //     registerType: 'autoUpdate',
  //     includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
  //     manifest: {
  //       name: 'Client-Side PDF Processor',
  //       short_name: 'PDF Processor',
  //       description: 'A 100% browser-based PDF document processor',
  //       theme_color: '#3b82f6',
  //       background_color: '#ffffff',
  //       icons: [
  //         {
  //           src: 'pwa-192x192.png',
  //           sizes: '192x192',
  //           type: 'image/png',
  //         },
  //         {
  //           src: 'pwa-512x512.png',
  //           sizes: '512x512',
  //           type: 'image/png',
  //         },
  //         {
  //           src: 'pwa-512x512.png',
  //           sizes: '512x512',
  //           type: 'image/png',
  //           purpose: 'any maskable',
  //         },
  //       ],
  //     },
  //   }),
  // ],
})