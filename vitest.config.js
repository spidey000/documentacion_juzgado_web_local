import { defineConfig } from 'vitest/config'
import path from 'path'

// https://vitest.dev/config/
export default defineConfig({
  test: {
    // Enable globals like describe, it, expect
    globals: true,
    
    // Environment to use
    environment: 'jsdom',
    
    // Setup files
    setupFiles: ['./tests/setup.js'],
    
    // Include files for testing
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,tsx,jsx}'],
    
    // Exclude files from testing
    exclude: [
      'node_modules/',
      'dist/',
      '.idea/',
      '.vscode/',
      '.git/',
      '.cache/',
    ],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'vitest.config.js',
        '.eslintrc.js',
        'tailwind.config.js',
        'postcss.config.js',
      ],
    },
  },
  
  // Resolve configuration (same as Vite)
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@core': path.resolve(__dirname, 'src/core'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@assets': path.resolve(__dirname, 'src/assets'),
    },
  },
  
  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify('1.0.0'),
    __APP_NAME__: JSON.stringify('Client-Side PDF Processor'),
  },
})