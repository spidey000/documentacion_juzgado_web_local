// Test helper utilities
import { vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

// Custom render function with common providers
export const renderWithProviders = (ui, options = {}) => {
  const container = document.createElement('div');
  container.id = 'root';
  document.body.appendChild(container);
  
  if (typeof ui === 'string') {
    container.innerHTML = ui;
  } else if (ui instanceof HTMLElement) {
    container.appendChild(ui);
  }
  
  return {
    container,
    ...render(container, options)
  };
};

// Wait for async operations to complete
export const waitForAsync = () => {
  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
};

// Create a fake file from blob
export const createFile = (blob, name) => {
  const file = new File([blob], name, { type: blob.type });
  return file;
};

// Simulate file upload
export const simulateFileUpload = (input, files) => {
  const fileList = Object.create(FileList.prototype);
  Object.defineProperty(fileList, 'length', { value: files.length });
  Array.from(files).forEach((file, index) => {
    Object.defineProperty(fileList, index, { value: file });
  });
  
  input.files = fileList;
  fireEvent.change(input);
};

// Simulate drag and drop
export const simulateDragAndDrop = (element, files) => {
  fireEvent.dragEnter(element, {
    dataTransfer: { files },
    preventDefault: vi.fn()
  });
  
  fireEvent.dragOver(element, {
    dataTransfer: { files },
    preventDefault: vi.fn()
  });
  
  fireEvent.drop(element, {
    dataTransfer: { files },
    preventDefault: vi.fn()
  });
};

// Mock performance.now for timing tests
export const mockPerformance = () => {
  const originalPerformance = global.performance;
  let now = 0;
  
  global.performance = {
    ...originalPerformance,
    now: vi.fn(() => {
      now += 100;
      return now;
    })
  };
  
  return () => {
    global.performance = originalPerformance;
  };
};

// Test console errors/warnings
export const captureConsole = (type = 'error') => {
  const originalConsole = console[type];
  const messages = [];
  
  console[type] = vi.fn((...args) => {
    messages.push(args);
    originalConsole(...args);
  });
  
  return {
    messages,
    restore: () => {
      console[type] = originalConsole;
    }
  };
};

// Create a spy on a method
export const spyOnMethod = (obj, method) => {
  const original = obj[method];
  const spy = vi.fn();
  obj[method] = spy;
  
  return {
    spy,
    restore: () => {
      obj[method] = original;
    }
  };
};

// Wait for element to appear
export const waitForElement = (selector, options = {}) => {
  return waitFor(() => {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element ${selector} not found`);
    }
    return element;
  }, options);
};

// Wait for element to disappear
export const waitForElementToBeRemoved = (selector, options = {}) => {
  return waitFor(() => {
    const element = document.querySelector(selector);
    if (element) {
      throw new Error(`Element ${selector} still exists`);
    }
  }, options);
};

// Check if element has class
export const hasClass = (element, className) => {
  return element.classList.contains(className);
};

// Get text content of element
export const getTextContent = (element) => {
  return element.textContent?.trim() || '';
};

// Test responsive behavior
export const resizeWindow = (width, height) => {
  window.innerWidth = width;
  window.innerHeight = height;
  window.dispatchEvent(new Event('resize'));
};

// Mock scroll behavior
export const mockScroll = () => {
  const originalScroll = window.scrollTo;
  window.scrollTo = vi.fn();
  
  return () => {
    window.scrollTo = originalScroll;
  };
};

// Create a test component
export const createTestComponent = (html, id = 'test-component') => {
  const element = document.createElement('div');
  element.id = id;
  element.innerHTML = html;
  document.body.appendChild(element);
  return element;
};

// Clean up test component
export const cleanupTestComponent = (id) => {
  const element = document.getElementById(id);
  if (element) {
    element.remove();
  }
};

// Test keyboard navigation
export const pressKey = (key, element = document) => {
  fireEvent.keyDown(element, { key });
  fireEvent.keyUp(element, { key });
};

// Test focus management
export const testFocus = (element) => {
  element.focus();
  expect(document.activeElement).toBe(element);
};

// Mock fetch API
export const mockFetch = (response, options = {}) => {
  const mockResponse = {
    ok: true,
    status: 200,
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(JSON.stringify(response)),
    ...options
  };
  
  global.fetch = vi.fn(() => Promise.resolve(mockResponse));
  
  return {
    mockResponse,
    restore: () => {
      global.fetch = undefined;
    }
  };
};

// Mock WebSocket
export const mockWebSocket = () => {
  const ws = {
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: 1
  };
  
  global.WebSocket = vi.fn(() => ws);
  
  return {
    ws,
    restore: () => {
      global.WebSocket = undefined;
    }
  };
};

// Test async operations with timeout
export const testAsyncOperation = (asyncFn, timeout = 5000) => {
  return Promise.race([
    asyncFn(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timed out')), timeout)
    )
  ]);
};

// Create a custom matcher for PDF content
export const toHavePdfContent = (received, expected) => {
  const pass = received.includes(expected);
  return {
    pass,
    message: () => 
      pass 
        ? `Expected PDF not to contain "${expected}"`
        : `Expected PDF to contain "${expected}"`
  };
};

// Add custom matchers to expect
expect.extend({
  toHavePdfContent
});

// Performance test helper
export const measurePerformance = async (fn, iterations = 100) => {
  const start = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    await fn();
  }
  
  const end = performance.now();
  const average = (end - start) / iterations;
  
  return {
    total: end - start,
    average,
    iterations
  };
};

// Batch test helper
export const runBatchTests = (tests, beforeEach, afterEach) => {
  const results = [];
  
  for (const test of tests) {
    if (beforeEach) beforeEach();
    
    try {
      const result = test.fn();
      results.push({ name: test.name, result, error: null });
    } catch (error) {
      results.push({ name: test.name, result: null, error });
    }
    
    if (afterEach) afterEach();
  }
  
  return results;
};

// Export userEvent for easier access
export { userEvent };