// Mock data for tests
import { vi } from 'vitest';

export const mockPDFFile = new Blob(['%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n/Resources <<\n/Font <<\n/F1 <<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\n>>\n>>\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Sample PDF content) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000312 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n456\n%%EOF'], { type: 'application/pdf' });

export const mockImageFile = new Blob(['iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='], { type: 'image/png' });

export const mockTextFile = new Blob(['Sample text file content'], { type: 'text/plain' });

export const mockInvalidFile = new Blob(['Invalid file content'], { type: 'application/octet-stream' });

// Mock file with drag data
export const createMockFile = (name, size, type) => {
  const file = new Blob(['a'.repeat(size)], { type });
  file.name = name;
  return file;
};

// Mock PDF processing results
export const mockPDFResult = {
  fileName: 'test.pdf',
  fileHash: '123abc456def',
  extractedText: 'Sample PDF content for testing',
  ocrResults: {
    text: 'Sample OCR text',
    confidence: 95,
    words: [
      { text: 'Sample', confidence: 95 },
      { text: 'OCR', confidence: 90 },
      { text: 'text', confidence: 95 }
    ]
  },
  aiDescription: 'This is a sample PDF document containing test content for validation purposes.',
  generatedIndex: 'DOC-001',
  pages: 1,
  processingTime: 1500,
  metadata: {
    title: 'Test PDF',
    author: 'Test Author',
    creationDate: new Date().toISOString()
  }
};

// Mock event data
export const mockEventBus = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn()
};

// Mock DOM elements
export const createMockFileInput = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = '.pdf,image/*';
  return input;
};

export const createMockDropZone = () => {
  const dropZone = document.createElement('div');
  dropZone.className = 'drop-zone';
  dropZone.innerHTML = `
    <div class="drop-zone-content">
      <i class="fas fa-cloud-upload-alt"></i>
      <p>Drag and drop files here or click to select</p>
      <p class="file-types">PDF, JPG, PNG up to 10MB</p>
    </div>
  `;
  return dropZone;
};

// Mock API responses
export const mockAPIResponse = {
  success: true,
  data: mockPDFResult,
  message: 'File processed successfully'
};

export const mockAPIError = {
  success: false,
  error: 'Processing failed',
  message: 'Unable to process file'
};

// Mock user interactions
export const createMockDragEvent = (files, type = 'dragenter') => {
  return {
    type,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: {
      files: Array.isArray(files) ? files : [files],
      types: ['Files']
    }
  };
};

export const createMockClickEvent = () => ({
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
  target: document.createElement('button')
});

export const createMockChangeEvent = (value) => ({
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
  target: { value }
});

// Performance test data
export const largeMockPDF = new Blob(['%PDF-1.4\n'.repeat(10000) + 'Large PDF content'.repeat(5000)], { type: 'application/pdf' });

// Error scenarios
export const mockCorruptedPDF = new Blob(['This is not a valid PDF'], { type: 'application/pdf' });

export const mockEmptyFile = new Blob([], { type: 'application/pdf' });

// Test fixtures for formatters
export const testFormData = [
  { fileName: 'document.pdf', expected: 'Document' },
  { fileName: 'IMAGE_001.jpg', expected: 'Image 001' },
  { fileName: 'test-file-name.png', expected: 'Test File Name' },
  { fileName: 'ALLCAPSFILE.PDF', expected: 'Allcapsfile' }
];

// Test fixtures for validators
export const testValidationCases = [
  { input: 'valid@email.com', expected: true },
  { input: 'invalid-email', expected: false },
  { input: 'another.valid@email.com', expected: true },
  { input: '@no-local-part.com', expected: false }
];