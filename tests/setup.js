// Test setup file for Vitest
import { vi } from 'vitest';
import { cleanup } from '@testing-library/dom';
import '@testing-library/jest-dom/vitest';

// Mock browser APIs that aren't available in Node.js
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock TextEncoder and TextDecoder if not available
global.TextEncoder = global.TextEncoder || require('util').TextEncoder;
global.TextDecoder = global.TextDecoder || require('util').TextDecoder;

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Setup fake timers for async operations
vi.useFakeTimers();

// Mock PDF.js
vi.mock('pdfjs-dist/build/pdf', () => ({
  getDocument: vi.fn(() => Promise.resolve({
    numPages: 1,
    getPage: vi.fn(() => Promise.resolve({
      getTextContent: vi.fn(() => Promise.resolve({
        items: [
          { str: 'Sample PDF content' },
          { str: 'for testing' }
        ]
      })),
      getViewport: vi.fn(() => ({ width: 600, height: 800 }))
    }))
  })),
  GlobalWorkerOptions: {
    workerSrc: ''
  }
}));

// Mock Tesseract.js
vi.mock('tesseract.js', () => ({
  recognize: vi.fn(() => Promise.resolve({
    data: {
      text: 'Sample OCR text',
      confidence: 95,
      words: [
        { text: 'Sample', confidence: 95 },
        { text: 'OCR', confidence: 90 },
        { text: 'text', confidence: 95 }
      ]
    }
  }))
}));

// Global test utilities
global.beforeEach(() => {
  // Reset DOM before each test
  document.body.innerHTML = '';
});

// Cleanup after each test
global.afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.clearAllTimers();
});