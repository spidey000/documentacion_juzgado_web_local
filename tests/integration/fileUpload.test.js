import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileUpload } from '@components/FileUpload';
import { ProcessingQueue } from '@components/ProcessingQueue';
import { ResultsPanel } from '@components/ResultsPanel';
import { eventBus } from '@utils/eventBus';
import { mockPDFFile, createMockFile } from '@utils/mockData';
import { renderWithProviders, simulateFileUpload } from '@utils/testHelpers';

describe('FileUpload Integration', () => {
  let fileUploadContainer;
  let queueContainer;
  let resultsContainer;
  let fileUpload;
  let processingQueue;
  let resultsPanel;

  beforeEach(() => {
    // Create containers
    fileUploadContainer = document.createElement('div');
    fileUploadContainer.id = 'file-upload';
    document.body.appendChild(fileUploadContainer);

    queueContainer = document.createElement('div');
    queueContainer.id = 'processing-queue';
    document.body.appendChild(queueContainer);

    resultsContainer = document.createElement('div');
    resultsContainer.id = 'results-panel';
    document.body.appendChild(resultsContainer);

    // Mock dependencies
    vi.mock('@utils/toast', () => ({
      showToast: vi.fn()
    }));

    vi.mock('@utils/auditLogger', () => ({
      auditLogger: {
        log: vi.fn()
      }
    }));

    // Create components
    fileUpload = new FileUpload('file-upload');
    processingQueue = new ProcessingQueue('processing-queue');
    resultsPanel = new ResultsPanel('results-panel');
  });

  afterEach(() => {
    // Clean up
    fileUpload.destroy();
    processingQueue.destroy();
    resultsPanel.destroy();
    
    fileUploadContainer.remove();
    queueContainer.remove();
    resultsContainer.remove();
    
    vi.clearAllMocks();
  });

  describe('File Upload to Processing Workflow', () => {
    it('should integrate file upload with processing queue', async () => {
      // Add file to upload component
      fileUpload.handleFiles([mockPDFFile]);
      
      // Verify file is in upload component
      expect(fileUpload.getFiles()).toHaveLength(1);
      
      // Start processing
      await fileUpload.startProcessing();
      
      // Verify processing queue received the event
      expect(processingQueue.queue).toHaveLength(1);
      expect(processingQueue.totalItems).toBe(1);
      
      // Simulate processing completion
      const fileId = fileUpload.files[0].id;
      eventBus.emit('processing-completed', {
        id: fileId,
        fileName: mockPDFFile.name,
        result: {
          pagesProcessed: 1,
          processingTime: 1500
        }
      });
      
      // Verify results panel received the result
      expect(resultsPanel.results.processed).toHaveLength(1);
    });

    it('should handle multiple files processing', async () => {
      // Add multiple files
      const files = [
        mockPDFFile,
        createMockFile('document2.pdf', 1024 * 1024, 'application/pdf'),
        createMockFile('document3.pdf', 2 * 1024 * 1024, 'application/pdf')
      ];
      
      fileUpload.handleFiles(files);
      await fileUpload.startProcessing();
      
      // Verify all files are in queue
      expect(processingQueue.totalItems).toBe(3);
      expect(processingQueue.queue).toHaveLength(2); // 1 processing, 2 queued
    });

    it('should update UI components during processing', async () => {
      fileUpload.handleFiles([mockPDFFile]);
      await fileUpload.startProcessing();
      
      // Verify upload component shows progress
      const fileItems = fileUploadContainer.querySelectorAll('.file-item');
      const progressBar = fileItems[0].querySelector('.progress-bar');
      expect(progressBar.classList.contains('hidden')).toBe(false);
      
      // Verify queue shows processing item
      const queueItems = queueContainer.querySelectorAll('.queue-item');
      expect(queueItems).toHaveLength(1);
      expect(queueItems[0].textContent).toContain('Processing');
    });

    it('should handle file removal during processing', async () => {
      fileUpload.handleFiles([mockPDFFile]);
      await fileUpload.startProcessing();
      
      // Remove file while processing
      const fileId = fileUpload.files[0].id;
      fileUpload.removeFile(fileId);
      
      // Verify file is removed from upload component
      expect(fileUpload.getFiles()).toHaveLength(0);
      
      // Verify processing is cancelled
      expect(processingQueue.processing).toHaveLength(0);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle processing errors gracefully', async () => {
      fileUpload.handleFiles([mockPDFFile]);
      await fileUpload.startProcessing();
      
      // Simulate processing error
      const fileId = fileUpload.files[0].id;
      eventBus.emit('processing-failed', {
        id: fileId,
        fileName: mockPDFFile.name,
        error: 'Processing failed: Invalid PDF format'
      });
      
      // Verify error appears in results panel
      expect(resultsPanel.results.errors).toHaveLength(1);
      expect(resultsPanel.results.errors[0].error).toContain('Invalid PDF format');
      
      // Verify queue shows failed status
      expect(processingQueue.failed).toHaveLength(1);
    });

    it('should continue processing after individual file failure', async () => {
      const files = [mockPDFFile, createMockFile('document2.pdf', 1024 * 1024, 'application/pdf')];
      fileUpload.handleFiles(files);
      await fileUpload.startProcessing();
      
      // Fail first file
      const fileId1 = fileUpload.files[0].id;
      eventBus.emit('processing-failed', {
        id: fileId1,
        fileName: files[0].name,
        error: 'Processing error'
      });
      
      // Complete second file
      const fileId2 = fileUpload.files[1].id;
      eventBus.emit('processing-completed', {
        id: fileId2,
        fileName: files[1].name,
        result: { pagesProcessed: 1 }
      });
      
      // Verify both results are recorded
      expect(resultsPanel.results.errors).toHaveLength(1);
      expect(resultsPanel.results.processed).toHaveLength(1);
    });
  });

  describe('Progress Tracking Integration', () => {
    it('should sync progress across components', async () => {
      fileUpload.handleFiles([mockPDFFile]);
      await fileUpload.startProcessing();
      
      // Simulate progress updates
      const fileId = fileUpload.files[0].id;
      eventBus.emit('processing-progress', {
        id: fileId,
        progress: 50,
        currentTask: 'Extracting text'
      });
      
      // Verify progress is reflected in upload component
      const fileItems = fileUploadContainer.querySelectorAll('.file-item');
      const progressFill = fileItems[0].querySelector('.progress-fill');
      expect(progressFill.style.width).toBe('50%');
      
      // Verify queue shows current task
      const queueItems = queueContainer.querySelectorAll('.queue-item');
      expect(queueItems[0].textContent).toContain('Extracting text');
    });

    it('should update overall progress correctly', async () => {
      const files = [mockPDFFile, createMockFile('document2.pdf', 1024 * 1024, 'application/pdf')];
      fileUpload.handleFiles(files);
      await fileUpload.startProcessing();
      
      // Complete first file
      const fileId1 = fileUpload.files[0].id;
      eventBus.emit('processing-completed', {
        id: fileId1,
        fileName: files[0].name,
        result: { pagesProcessed: 1 }
      });
      
      // Verify overall progress is 50%
      const overallProgress = queueContainer.querySelector('.overall-progress');
      expect(overallProgress.style.width).toBe('50%');
    });
  });

  describe('Export Integration', () => {
    it('should export results from all components', async () => {
      fileUpload.handleFiles([mockPDFFile]);
      await fileUpload.startProcessing();
      
      // Complete processing
      const fileId = fileUpload.files[0].id;
      eventBus.emit('processing-completed', {
        id: fileId,
        fileName: mockPDFFile.name,
        result: { pagesProcessed: 1 }
      });
      
      // Simulate export
      const exportSpy = vi.spyOn(resultsPanel, 'exportResults');
      resultsPanel.exportResults('json');
      
      expect(exportSpy).toHaveBeenCalledWith('json');
    });
  });

  describe('Real-time Updates Integration', () => {
    it('should update all components when files are added/removed', () => {
      // Add file
      fileUpload.handleFiles([mockPDFFile]);
      
      // Verify all components reflect the addition
      expect(fileUpload.getFiles()).toHaveLength(1);
      
      // Remove file
      const fileId = fileUpload.files[0].id;
      fileUpload.removeFile(fileId);
      
      // Verify all components reflect the removal
      expect(fileUpload.getFiles()).toHaveLength(0);
    });

    it('should maintain consistent state across components', async () => {
      fileUpload.handleFiles([mockPDFFile]);
      await fileUpload.startProcessing();
      
      // Complete processing
      const fileId = fileUpload.files[0].id;
      eventBus.emit('processing-completed', {
        id: fileId,
        fileName: mockPDFFile.name,
        result: { pagesProcessed: 1 }
      });
      
      // Verify summary stats are consistent
      const summary = resultsPanel.results.summary;
      expect(summary.totalFiles).toBe(1);
      expect(summary.processedFiles).toBe(1);
    });
  });
});