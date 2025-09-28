import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/dom';
import '@testing-library/jest-dom/vitest';
import { FileUpload } from '@components/FileUpload';
import { ProcessingQueue } from '@components/ProcessingQueue';
import { ResultsPanel } from '@components/ResultsPanel';
import { PDFViewer } from '@components/PDFViewer';
import { eventBus } from '@utils/eventBus';
import { mockPDFFile, createMockFile } from '@utils/mockData';
import { renderWithProviders, simulateFileUpload } from '@utils/testHelpers';

describe('End-to-End Workflow Tests', () => {
  let appContainer;

  beforeEach(() => {
    // Create app container
    appContainer = document.createElement('div');
    appContainer.id = 'app';
    document.body.appendChild(appContainer);

    // Setup app structure
    appContainer.innerHTML = `
      <div id="file-upload"></div>
      <div id="processing-queue"></div>
      <div id="results-panel"></div>
      <div id="pdf-viewer"></div>
    `;

    // Mock dependencies
    vi.mock('@utils/toast', () => ({
      showToast: vi.fn()
    }));

    vi.mock('@utils/auditLogger', () => ({
      auditLogger: {
        log: vi.fn()
      }
    }));

    // Mock PDF.js
    global.window = Object.assign({}, global.window, {
      pdfjsLib: {
        getDocument: vi.fn(() => ({
          promise: Promise.resolve({
            numPages: 3,
            getPage: vi.fn(() => Promise.resolve({
              getViewport: vi.fn(({ scale }) => ({ width: 600 * scale, height: 800 * scale })),
              render: vi.fn(() => ({ promise: Promise.resolve() }))
            }))
          }))
        })),
        GlobalWorkerOptions: {
          workerSrc: ''
        }
      }
    });
  });

  afterEach(() => {
    appContainer.remove();
    vi.clearAllMocks();
  });

  describe('Complete Upload to Results Workflow', () => {
    it('should handle full workflow from file upload to results export', async () => {
      // Initialize components
      const fileUpload = new FileUpload('file-upload');
      const processingQueue = new ProcessingQueue('processing-queue');
      const resultsPanel = new ResultsPanel('results-panel');
      const pdfViewer = new PDFViewer('pdf-viewer');

      // 1. User selects file
      const fileInput = appContainer.querySelector('#file-input');
      const files = [mockPDFFile];
      Object.defineProperty(fileInput, 'files', {
        value: files,
        writable: false
      });
      fireEvent.change(fileInput);

      // Verify file appears in upload component
      expect(fileUpload.getFiles()).toHaveLength(1);
      
      // 2. User starts processing
      const uploadBtn = appContainer.querySelector('.upload-btn');
      fireEvent.click(uploadBtn);

      // Wait for processing to start
      await waitFor(() => {
        expect(processingQueue.totalItems).toBe(1);
      });

      // 3. Simulate processing progress
      const fileId = fileUpload.files[0].id;
      
      // Progress updates
      eventBus.emit('processing-progress', {
        id: fileId,
        progress: 25,
        currentTask: 'Validating file'
      });

      await waitFor(() => {
        const progressBar = appContainer.querySelector('.progress-fill');
        expect(progressBar.style.width).toBe('25%');
      });

      eventBus.emit('processing-progress', {
        id: fileId,
        progress: 75,
        currentTask: 'Generating index'
      });

      // 4. Processing completes
      eventBus.emit('processing-completed', {
        id: fileId,
        fileName: mockPDFFile.name,
        fileSize: mockPDFFile.size,
        result: {
          pagesProcessed: 3,
          processingTime: 2500,
          downloadUrl: 'blob:test-url'
        }
      });

      // Verify results appear
      await waitFor(() => {
        expect(resultsPanel.results.processed).toHaveLength(1);
        expect(resultsPanel.results.summary.processedFiles).toBe(1);
      });

      // 5. User views PDF
      eventBus.emit('pdf-loaded', {
        totalPages: 3,
        currentPage: 1
      });

      // 6. User navigates PDF
      const nextBtn = appContainer.querySelector('.next-page');
      fireEvent.click(nextBtn);

      await waitFor(() => {
        expect(pdfViewer.currentPage).toBe(2);
      });

      // 7. User exports results
      const exportBtn = appContainer.querySelector('.export-btn');
      fireEvent.click(exportBtn);

      const exportOption = appContainer.querySelector('[data-format="json"]');
      fireEvent.click(exportOption);

      // Verify export was called
      const exportSpy = vi.spyOn(resultsPanel, 'exportResults');
      expect(exportSpy).toHaveBeenCalledWith('json');

      // 8. Verify audit trail
      expect(auditLogger.log).toHaveBeenCalledWith('files_selected', expect.any(Object));
      expect(auditLogger.log).toHaveBeenCalledWith('processing_started', expect.any(Object));
      expect(auditLogger.log).toHaveBeenCalledWith('processing_completed', expect.any(Object));
      expect(auditLogger.log).toHaveBeenCalledWith('pdf_loaded', expect.any(Object));
      expect(auditLogger.log).toHaveBeenCalledWith('page_navigated', expect.any(Object));

      // Cleanup
      fileUpload.destroy();
      processingQueue.destroy();
      resultsPanel.destroy();
      pdfViewer.destroy();
    });

    it('should handle error workflow gracefully', async () => {
      // Initialize components
      const fileUpload = new FileUpload('file-upload');
      const processingQueue = new ProcessingQueue('processing-queue');
      const resultsPanel = new ResultsPanel('results-panel');

      // Add invalid file
      const invalidFile = createMockFile('corrupt.pdf', 1024, 'application/pdf');
      fileUpload.handleFiles([invalidFile]);

      // Start processing
      await fileUpload.startProcessing();

      // Simulate processing error
      const fileId = fileUpload.files[0].id;
      eventBus.emit('processing-failed', {
        id: fileId,
        fileName: invalidFile.name,
        fileSize: invalidFile.size,
        error: 'PDF file is corrupted or invalid'
      });

      // Verify error is handled
      await waitFor(() => {
        expect(resultsPanel.results.errors).toHaveLength(1);
        expect(resultsPanel.results.errors[0].error).toContain('corrupted');
      });

      // Verify queue shows failed status
      expect(processingQueue.failed).toHaveLength(1);

      // Verify user can see error details
      const errorsTab = appContainer.querySelector('[data-tab="errors"]');
      fireEvent.click(errorsTab);

      await waitFor(() => {
        const errorPanel = appContainer.querySelector('#errors-panel');
        expect(errorPanel.classList.contains('hidden')).toBe(false);
      });

      // Cleanup
      fileUpload.destroy();
      processingQueue.destroy();
      resultsPanel.destroy();
    });

    it('should handle batch processing workflow', async () => {
      // Initialize components
      const fileUpload = new FileUpload('file-upload', { maxFiles: 5 });
      const processingQueue = new ProcessingQueue('processing-queue');
      const resultsPanel = new ResultsPanel('results-panel');

      // Add multiple files
      const files = [
        mockPDFFile,
        createMockFile('document2.pdf', 1024 * 1024, 'application/pdf'),
        createMockFile('document3.pdf', 2 * 1024 * 1024, 'application/pdf')
      ];

      fileUpload.handleFiles(files);
      await fileUpload.startProcessing();

      // Process files one by one
      for (let i = 0; i < files.length; i++) {
        const fileId = fileUpload.files[i].id;
        
        // Simulate progress
        eventBus.emit('processing-progress', {
          id: fileId,
          progress: 50,
          currentTask: 'Processing file'
        });

        // Complete file
        eventBus.emit('processing-completed', {
          id: fileId,
          fileName: files[i].name,
          fileSize: files[i].size,
          result: {
            pagesProcessed: i + 1,
            processingTime: 1000 + i * 500
          }
        });
      }

      // Verify all files processed
      await waitFor(() => {
        expect(resultsPanel.results.processed).toHaveLength(3);
        expect(resultsPanel.results.summary.processedFiles).toBe(3);
      });

      // Verify total processing time
      expect(resultsPanel.results.summary.processingTime).toBeGreaterThan(0);

      // Cleanup
      fileUpload.destroy();
      processingQueue.destroy();
      resultsPanel.destroy();
    });

    it('should handle pause/resume workflow', async () => {
      // Initialize components
      const fileUpload = new FileUpload('file-upload');
      const processingQueue = new ProcessingQueue('processing-queue');

      // Add and start processing file
      fileUpload.handleFiles([mockPDFFile]);
      await fileUpload.startProcessing();

      // Pause processing
      const pauseBtn = appContainer.querySelector('.pause-btn');
      fireEvent.click(pauseBtn);

      // Verify processing is paused
      expect(processingQueue.processing[0].status).toBe('paused');

      // Resume processing
      const resumeBtn = appContainer.querySelector('.resume-btn');
      fireEvent.click(resumeBtn);

      // Verify processing resumes
      expect(processingQueue.processing[0].status).toBe('processing');

      // Complete processing
      const fileId = fileUpload.files[0].id;
      eventBus.emit('processing-completed', {
        id: fileId,
        fileName: mockPDFFile.name,
        result: { pagesProcessed: 1 }
      });

      // Cleanup
      fileUpload.destroy();
      processingQueue.destroy();
    });
  });

  describe('Responsive Behavior Tests', () => {
    it('should adapt to mobile screens', async () => {
      // Simulate mobile viewport
      global.innerWidth = 375;
      global.innerHeight = 667;
      window.dispatchEvent(new Event('resize'));

      // Initialize components
      const fileUpload = new FileUpload('file-upload');
      const processingQueue = new ProcessingQueue('processing-queue');

      // Verify responsive layout
      const uploadArea = appContainer.querySelector('.upload-area');
      expect(uploadArea).toBeTruthy();

      // Test file upload on mobile
      fileUpload.handleFiles([mockPDFFile]);
      await fileUpload.startProcessing();

      // Verify queue is scrollable on mobile
      const queueContainer = appContainer.querySelector('.queue-items-container');
      expect(queueContainer.classList.contains('max-h-96')).toBe(true);

      // Cleanup
      fileUpload.destroy();
      processingQueue.destroy();

      // Reset viewport
      global.innerWidth = 1024;
      global.innerHeight = 768;
      window.dispatchEvent(new Event('resize'));
    });

    it('should handle keyboard navigation workflow', async () => {
      // Initialize components
      const fileUpload = new FileUpload('file-upload');
      const pdfViewer = new PDFViewer('pdf-viewer');

      // Simulate file upload via keyboard
      const uploadArea = appContainer.querySelector('.upload-area');
      
      // Focus upload area
      uploadArea.focus();
      
      // Press Enter to trigger file selection
      fireEvent.keyDown(uploadArea, { key: 'Enter' });

      // Simulate PDF loading
      await pdfViewer.loadPDF('test.pdf');

      // Navigate with keyboard
      fireEvent.keyDown(document, { key: 'ArrowRight' });
      expect(pdfViewer.currentPage).toBe(2);

      // Zoom with keyboard
      fireEvent.keyDown(document, { key: '+', ctrlKey: true });
      expect(pdfViewer.scale).toBe(1.25);

      // Cleanup
      fileUpload.destroy();
      pdfViewer.destroy();
    });
  });

  describe('Performance Tests', () => {
    it('should handle large files efficiently', async () => {
      // Initialize components
      const fileUpload = new FileUpload('file-upload', { maxFileSize: 100 * 1024 * 1024 });
      const processingQueue = new ProcessingQueue('processing-queue');

      // Create large file (50MB)
      const largeFile = createMockFile('large.pdf', 50 * 1024 * 1024, 'application/pdf');
      
      // Measure upload time
      const startTime = performance.now();
      
      fileUpload.handleFiles([largeFile]);
      await fileUpload.startProcessing();

      // Simulate processing with progress updates
      const fileId = fileUpload.files[0].id;
      for (let progress = 0; progress <= 100; progress += 10) {
        eventBus.emit('processing-progress', {
          id: fileId,
          progress: progress,
          currentTask: 'Processing large file'
        });
        
        // Small delay to simulate processing time
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Complete processing
      eventBus.emit('processing-completed', {
        id: fileId,
        fileName: largeFile.name,
        result: { pagesProcessed: 100 }
      });

      // Verify performance is acceptable (less than 5 seconds for 50MB)
      expect(processingTime).toBeLessThan(5000);

      // Cleanup
      fileUpload.destroy();
      processingQueue.destroy();
    });
  });

  describe('Accessibility Tests', () => {
    it('should maintain proper ARIA attributes throughout workflow', async () => {
      // Initialize components
      const fileUpload = new FileUpload('file-upload');
      const pdfViewer = new PDFViewer('pdf-viewer');

      // Verify upload area has correct ARIA attributes
      const uploadArea = appContainer.querySelector('.upload-area');
      expect(uploadArea).toHaveAttribute('role', 'button');
      expect(uploadArea).toHaveAttribute('aria-label');

      // Simulate file upload
      fileUpload.handleFiles([mockPDFFile]);

      // Verify file items have correct ARIA attributes
      const fileItems = appContainer.querySelectorAll('.file-item');
      expect(fileItems[0]).toHaveAttribute('role', 'listitem');

      // Load PDF
      await pdfViewer.loadPDF('test.pdf');

      // Verify PDF viewer has correct ARIA attributes
      const pdfContainer = appContainer.querySelector('.pdf-viewer-container');
      expect(pdfContainer).toHaveAttribute('role', 'region');
      expect(pdfContainer).toHaveAttribute('aria-label', 'PDF viewer');

      // Cleanup
      fileUpload.destroy();
      pdfViewer.destroy();
    });
  });
});