import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileUpload } from '@components/FileUpload';
import { mockPDFFile, mockImageFile, mockInvalidFile, createMockFileInput } from '@utils/mockData';
import { simulateFileUpload, simulateDragAndDrop, renderWithProviders } from '@utils/testHelpers';

describe('FileUpload', () => {
  let container;
  let fileUpload;

  beforeEach(() => {
    // Create mock container
    container = document.createElement('div');
    container.id = 'file-upload-container';
    document.body.appendChild(container);
    
    // Mock dependencies
    vi.mock('@utils/eventBus', () => ({
      eventBus: {
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn()
      }
    }));
    
    vi.mock('@utils/toast', () => ({
      showToast: vi.fn()
    }));
    
    vi.mock('@utils/auditLogger', () => ({
      auditLogger: {
        log: vi.fn()
      }
    }));
  });

  afterEach(() => {
    if (fileUpload) {
      fileUpload.destroy();
    }
    container.remove();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw error if container not found', () => {
      expect(() => new FileUpload('nonexistent-container')).toThrow();
    });

    it('should initialize with default options', () => {
      fileUpload = new FileUpload('file-upload-container');
      
      expect(fileUpload.options.maxFileSize).toBe(50 * 1024 * 1024);
      expect(fileUpload.options.allowedTypes).toEqual(['application/pdf']);
      expect(fileUpload.options.maxFiles).toBe(10);
      expect(fileUpload.files).toEqual([]);
    });

    it('should merge custom options', () => {
      const options = {
        maxFileSize: 1024,
        allowedTypes: ['image/png'],
        maxFiles: 5
      };
      
      fileUpload = new FileUpload('file-upload-container', options);
      
      expect(fileUpload.options.maxFileSize).toBe(1024);
      expect(fileUpload.options.allowedTypes).toEqual(['image/png']);
      expect(fileUpload.options.maxFiles).toBe(5);
    });
  });

  describe('render()', () => {
    it('should render upload area with correct structure', () => {
      fileUpload = new FileUpload('file-upload-container');
      
      const uploadArea = container.querySelector('.upload-area');
      expect(uploadArea).toBeTruthy();
      expect(uploadArea.getAttribute('role')).toBe('button');
      expect(uploadArea.getAttribute('aria-label')).toBe('Drop files here or click to select');
      
      const fileInput = container.querySelector('#file-input');
      expect(fileInput).toBeTruthy();
      expect(fileInput.accept).toBe('application/pdf');
      expect(fileInput.multiple).toBe(true);
    });

    it('should display correct max file size', () => {
      fileUpload = new FileUpload('file-upload-container', {
        maxFileSize: 1024 * 1024 // 1MB
      });
      
      const uploadText = container.querySelector('.upload-text');
      expect(uploadText.textContent).toContain('1MB');
    });
  });

  describe('handleFiles()', () => {
    beforeEach(() => {
      fileUpload = new FileUpload('file-upload-container');
    });

    it('should accept valid PDF files', () => {
      const files = [mockPDFFile];
      fileUpload.handleFiles(files);
      
      expect(fileUpload.files).toHaveLength(1);
      expect(fileUpload.files[0].file).toBe(mockPDFFile);
      expect(fileUpload.files[0].status).toBe('pending');
    });

    it('should reject invalid file types', () => {
      const files = [mockImageFile];
      fileUpload.handleFiles(files);
      
      expect(fileUpload.files).toHaveLength(0);
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining('not a supported file type'),
        'error'
      );
    });

    it('should reject files exceeding max size', () => {
      const largeFile = createMockFile('large.pdf', 60 * 1024 * 1024, 'application/pdf');
      fileUpload.handleFiles([largeFile]);
      
      expect(fileUpload.files).toHaveLength(0);
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining('exceeds the maximum file size'),
        'error'
      );
    });

    it('should reject when exceeding max files', () => {
      // Set max files to 1
      fileUpload.options.maxFiles = 1;
      
      const files = [mockPDFFile, mockPDFFile];
      fileUpload.handleFiles(files);
      
      expect(fileUpload.files).toHaveLength(1);
      expect(showToast).toHaveBeenCalledWith(
        'Maximum 1 files allowed',
        'error'
      );
    });

    it('should log file selection', () => {
      fileUpload.handleFiles([mockPDFFile]);
      
      expect(auditLogger.log).toHaveBeenCalledWith('files_selected', {
        count: 1,
        totalSize: mockPDFFile.size
      });
    });

    it('should render file items for valid files', () => {
      fileUpload.handleFiles([mockPDFFile]);
      
      const fileItems = container.querySelectorAll('.file-item');
      expect(fileItems).toHaveLength(1);
      
      const fileName = fileItems[0].querySelector('.file-name');
      expect(fileName.textContent).toBe(mockPDFFile.name);
    });
  });

  describe('removeFile()', () => {
    beforeEach(() => {
      fileUpload = new FileUpload('file-upload-container');
      fileUpload.handleFiles([mockPDFFile]);
    });

    it('should remove file from list', () => {
      const fileId = fileUpload.files[0].id;
      fileUpload.removeFile(fileId);
      
      expect(fileUpload.files).toHaveLength(0);
    });

    it('should remove file from DOM', () => {
      const fileId = fileUpload.files[0].id;
      fileUpload.removeFile(fileId);
      
      const fileItems = container.querySelectorAll('.file-item');
      expect(fileItems).toHaveLength(0);
    });

    it('should cancel upload if in progress', () => {
      const fileId = fileUpload.files[0].id;
      fileUpload.files[0].status = 'uploading';
      const abortController = new AbortController();
      fileUpload.abortControllers.set(fileId, abortController);
      
      fileUpload.removeFile(fileId);
      
      expect(abortController.signal.aborted).toBe(true);
    });

    it('should log file removal', () => {
      const fileId = fileUpload.files[0].id;
      fileUpload.removeFile(fileId);
      
      expect(auditLogger.log).toHaveBeenCalledWith('file_removed', {
        fileName: mockPDFFile.name
      });
    });
  });

  describe('startProcessing()', () => {
    beforeEach(() => {
      fileUpload = new FileUpload('file-upload-container');
      fileUpload.handleFiles([mockPDFFile]);
    });

    it('should emit start-processing event', async () => {
      await fileUpload.startProcessing();
      
      expect(eventBus.emit).toHaveBeenCalledWith('start-processing', {
        files: [{
          id: fileUpload.files[0].id,
          file: mockPDFFile
        }]
      });
    });

    it('should disable upload button during processing', async () => {
      await fileUpload.startProcessing();
      
      const uploadBtn = container.querySelector('.upload-btn');
      expect(uploadBtn.disabled).toBe(true);
    });

    it('should simulate upload progress', async () => {
      const progressSpy = vi.spyOn(fileUpload, 'simulateUpload');
      await fileUpload.startProcessing();
      
      expect(progressSpy).toHaveBeenCalledWith(fileUpload.files[0]);
    });
  });

  describe('simulateUpload()', () => {
    beforeEach(() => {
      fileUpload = new FileUpload('file-upload-container');
      fileUpload.handleFiles([mockPDFFile]);
    });

    it('should update progress during upload', async () => {
      vi.useFakeTimers();
      
      const uploadPromise = fileUpload.simulateUpload(fileUpload.files[0]);
      
      // Fast-forward through progress updates
      vi.advanceTimersByTime(1000);
      
      expect(fileUpload.files[0].progress).toBeGreaterThan(0);
      expect(fileUpload.files[0].status).toBe('uploading');
      
      // Complete upload
      vi.advanceTimersByTime(2000);
      await uploadPromise;
      
      expect(fileUpload.files[0].progress).toBe(100);
      expect(fileUpload.files[0].status).toBe('completed');
      
      vi.useRealTimers();
    });

    it('should handle upload cancellation', async () => {
      vi.useFakeTimers();
      
      const uploadPromise = fileUpload.simulateUpload(fileUpload.files[0]);
      
      // Cancel after some progress
      vi.advanceTimersByTime(500);
      fileUpload.abortControllers.get(fileUpload.files[0].id).abort();
      
      await uploadPromise;
      
      expect(fileUpload.files[0].status).toBe('cancelled');
      
      vi.useRealTimers();
    });

    it('should emit file-completed event when done', async () => {
      vi.useFakeTimers();
      
      const uploadPromise = fileUpload.simulateUpload(fileUpload.files[0]);
      vi.advanceTimersByTime(3000);
      await uploadPromise;
      
      expect(eventBus.emit).toHaveBeenCalledWith('file-completed', {
        id: fileUpload.files[0].id,
        file: mockPDFFile
      });
      
      vi.useRealTimers();
    });
  });

  describe('cancelAllUploads()', () => {
    beforeEach(() => {
      fileUpload = new FileUpload('file-upload-container');
      fileUpload.handleFiles([mockPDFFile, mockPDFFile]);
    });

    it('should abort all uploads', () => {
      // Set files to uploading state
      fileUpload.files.forEach(file => {
        file.status = 'uploading';
        fileUpload.abortControllers.set(file.id, new AbortController());
      });
      
      fileUpload.cancelAllUploads();
      
      fileUpload.files.forEach(file => {
        expect(file.status).toBe('cancelled');
      });
    });

    it('should show toast notification', () => {
      fileUpload.cancelAllUploads();
      
      expect(showToast).toHaveBeenCalledWith('All uploads cancelled', 'info');
    });
  });

  describe('updateButtons()', () => {
    beforeEach(() => {
      fileUpload = new FileUpload('file-upload-container');
    });

    it('should enable buttons when files are present', () => {
      fileUpload.handleFiles([mockPDFFile]);
      
      const uploadBtn = container.querySelector('.upload-btn');
      const cancelBtn = container.querySelector('.cancel-btn');
      
      expect(uploadBtn.disabled).toBe(false);
      expect(cancelBtn.disabled).toBe(true); // No uploading files
    });

    it('should disable buttons when no files', () => {
      const uploadBtn = container.querySelector('.upload-btn');
      const cancelBtn = container.querySelector('.cancel-btn');
      
      expect(uploadBtn.disabled).toBe(true);
      expect(cancelBtn.disabled).toBe(true);
    });

    it('should enable cancel when uploading', () => {
      fileUpload.handleFiles([mockPDFFile]);
      fileUpload.files[0].status = 'uploading';
      fileUpload.updateButtons();
      
      const cancelBtn = container.querySelector('.cancel-btn');
      expect(cancelBtn.disabled).toBe(false);
    });
  });

  describe('formatFileSize()', () => {
    beforeEach(() => {
      fileUpload = new FileUpload('file-upload-container');
    });

    it('should format bytes correctly', () => {
      expect(fileUpload.formatFileSize(0)).toBe('0 Bytes');
      expect(fileUpload.formatFileSize(1024)).toBe('1 KB');
      expect(fileUpload.formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(fileUpload.formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });

  describe('event listeners', () => {
    beforeEach(() => {
      fileUpload = new FileUpload('file-upload-container');
    });

    it('should handle file input change', () => {
      const fileInput = container.querySelector('#file-input');
      const files = [mockPDFFile];
      
      // Mock files property
      Object.defineProperty(fileInput, 'files', {
        value: files,
        writable: false
      });
      
      const changeEvent = new Event('change', { bubbles: true });
      fileInput.dispatchEvent(changeEvent);
      
      expect(fileUpload.files).toHaveLength(1);
    });

    it('should handle drag and drop', () => {
      const uploadArea = container.querySelector('.upload-area');
      
      // Drag enter
      const dragEnterEvent = new DragEvent('dragenter', {
        dataTransfer: { files: [] }
      });
      uploadArea.dispatchEvent(dragEnterEvent);
      expect(uploadArea.classList.contains('border-blue-500')).toBe(true);
      
      // Drag leave
      const dragLeaveEvent = new DragEvent('dragleave', {
        dataTransfer: { files: [] }
      });
      uploadArea.dispatchEvent(dragLeaveEvent);
      expect(uploadArea.classList.contains('border-blue-500')).toBe(false);
      
      // Drop
      const dropEvent = new DragEvent('drop', {
        dataTransfer: { files: [mockPDFFile] }
      });
      uploadArea.dispatchEvent(dropEvent);
      
      expect(fileUpload.files).toHaveLength(1);
    });

    it('should handle keyboard navigation', () => {
      const uploadArea = container.querySelector('.upload-area');
      const fileInput = container.querySelector('#file-input');
      const clickSpy = vi.spyOn(fileInput, 'click');
      
      // Enter key
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      uploadArea.dispatchEvent(enterEvent);
      expect(clickSpy).toHaveBeenCalled();
      
      // Space key
      const spaceEvent = new KeyboardEvent('keydown', { key: ' ' });
      uploadArea.dispatchEvent(spaceEvent);
      expect(clickSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      fileUpload = new FileUpload('file-upload-container');
    });

    it('should handle empty file list', () => {
      fileUpload.handleFiles([]);
      expect(fileUpload.files).toHaveLength(0);
    });

    it('should handle files with special characters in name', () => {
      const fileWithSpecialName = new File(['content'], 'file name (1).pdf', {
        type: 'application/pdf'
      });
      
      fileUpload.handleFiles([fileWithSpecialName]);
      
      const fileName = container.querySelector('.file-name');
      expect(fileName.textContent).toBe(fileWithSpecialName.name);
    });

    it('should handle multiple valid and invalid files', () => {
      const files = [mockPDFFile, mockImageFile, mockInvalidFile];
      fileUpload.handleFiles(files);
      
      expect(fileUpload.files).toHaveLength(1);
      expect(showToast).toHaveBeenCalledTimes(2); // One for invalid type, one for invalid file
    });
  });

  describe('destroy()', () => {
    it('should clean up component', () => {
      fileUpload = new FileUpload('file-upload-container');
      fileUpload.handleFiles([mockPDFFile]);
      
      fileUpload.destroy();
      
      expect(container.innerHTML).toBe('');
      expect(fileUpload.abortControllers.size).toBe(0);
    });
  });
});