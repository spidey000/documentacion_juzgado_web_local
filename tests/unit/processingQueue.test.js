import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProcessingQueue } from '@components/ProcessingQueue';
import { eventBus } from '@utils/eventBus';

describe('ProcessingQueue', () => {
  let container;
  let processingQueue;

  beforeEach(() => {
    // Create mock container
    container = document.createElement('div');
    container.id = 'processing-queue-container';
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
    if (processingQueue) {
      processingQueue.destroy();
    }
    container.remove();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw error if container not found', () => {
      expect(() => new ProcessingQueue('nonexistent-container')).toThrow();
    });

    it('should initialize with default options', () => {
      processingQueue = new ProcessingQueue('processing-queue-container');
      
      expect(processingQueue.options.showEstimatedTime).toBe(true);
      expect(processingQueue.options.autoHideCompleted).toBe(false);
      expect(processingQueue.options.maxVisibleItems).toBe(10);
      expect(processingQueue.queue).toEqual([]);
      expect(processingQueue.processing).toEqual([]);
      expect(processingQueue.completed).toEqual([]);
      expect(processingQueue.failed).toEqual([]);
    });

    it('should merge custom options', () => {
      const options = {
        showEstimatedTime: false,
        maxVisibleItems: 20,
        refreshInterval: 2000
      };
      
      processingQueue = new ProcessingQueue('processing-queue-container', options);
      
      expect(processingQueue.options.showEstimatedTime).toBe(false);
      expect(processingQueue.options.maxVisibleItems).toBe(20);
      expect(processingQueue.options.refreshInterval).toBe(2000);
    });
  });

  describe('render()', () => {
    beforeEach(() => {
      processingQueue = new ProcessingQueue('processing-queue-container');
    });

    it('should render queue with correct structure', () => {
      const header = container.querySelector('.queue-header');
      expect(header).toBeTruthy();
      
      const stats = container.querySelector('.queue-stats');
      expect(stats).toBeTruthy();
      
      const progressBar = container.querySelector('.overall-progress');
      expect(progressBar).toBeTruthy();
      
      const itemsContainer = container.querySelector('.queue-items-container');
      expect(itemsContainer).toBeTruthy();
    });

    it('should show estimated time when enabled', () => {
      const estimatedTime = container.querySelector('.estimated-time');
      expect(estimatedTime).toBeTruthy();
    });

    it('should hide estimated time when disabled', () => {
      processingQueue = new ProcessingQueue('processing-queue-container', {
        showEstimatedTime: false
      });
      
      const estimatedTime = container.querySelector('.estimated-time');
      expect(estimatedTime).toBeNull();
    });
  });

  describe('startProcessing()', () => {
    beforeEach(() => {
      processingQueue = new ProcessingQueue('processing-queue-container');
    });

    it('should initialize queue with files', () => {
      const files = [
        { id: 1, file: { name: 'test1.pdf', size: 1024 } },
        { id: 2, file: { name: 'test2.pdf', size: 2048 } }
      ];
      
      processingQueue.startProcessing(files);
      
      expect(processingQueue.totalItems).toBe(2);
      expect(processingQueue.queue).toHaveLength(2);
      expect(processingQueue.processing).toHaveLength(0);
      expect(processingQueue.startTime).toBeTruthy();
    });

    it('should set correct status for queued items', () => {
      const files = [
        { id: 1, file: { name: 'test.pdf', size: 1024 } }
      ];
      
      processingQueue.startProcessing(files);
      
      expect(processingQueue.queue[0].status).toBe('queued');
      expect(processingQueue.queue[0].progress).toBe(0);
      expect(processingQueue.queue[0].position).toBe(1);
    });

    it('should log processing start', () => {
      const files = [
        { id: 1, file: { name: 'test.pdf', size: 1024 } }
      ];
      
      processingQueue.startProcessing(files);
      
      expect(auditLogger.log).toHaveBeenCalledWith('processing_started', {
        totalFiles: 1,
        totalSize: 1024
      });
    });

    it('should start processing first item', () => {
      const files = [
        { id: 1, file: { name: 'test.pdf', size: 1024 } }
      ];
      
      const processSpy = vi.spyOn(processingQueue, 'processNext');
      processingQueue.startProcessing(files);
      
      expect(processSpy).toHaveBeenCalled();
    });
  });

  describe('processNext()', () => {
    beforeEach(() => {
      processingQueue = new ProcessingQueue('processing-queue-container');
      processingQueue.startProcessing([
        { id: 1, file: { name: 'test1.pdf', size: 1024 } },
        { id: 2, file: { name: 'test2.pdf', size: 2048 } }
      ]);
    });

    it('should move first queued item to processing', () => {
      processingQueue.processNext();
      
      expect(processingQueue.queue).toHaveLength(1);
      expect(processingQueue.processing).toHaveLength(1);
      expect(processingQueue.processing[0].status).toBe('processing');
      expect(processingQueue.processing[0].startTime).toBeTruthy();
    });

    it('should emit process-item event', () => {
      processingQueue.processNext();
      
      expect(eventBus.emit).toHaveBeenCalledWith('process-item', {
        id: 1,
        fileName: 'test1.pdf',
        position: 1
      });
    });

    it('should not process when queue is empty', () => {
      processingQueue.queue = [];
      processingQueue.processNext();
      
      expect(eventBus.emit).not.toHaveBeenCalled();
    });

    it('should not process when already processing', () => {
      processingQueue.processing = [{ id: 3, status: 'processing' }];
      processingQueue.processNext();
      
      expect(eventBus.emit).not.toHaveBeenCalled();
    });
  });

  describe('updateProgress()', () => {
    beforeEach(() => {
      processingQueue = new ProcessingQueue('processing-queue-container');
      processingQueue.startProcessing([
        { id: 1, file: { name: 'test.pdf', size: 1024 } }
      ]);
      processingQueue.processNext();
    });

    it('should update item progress', () => {
      processingQueue.updateProgress({
        id: 1,
        progress: 50,
        currentTask: 'Extracting text'
      });
      
      expect(processingQueue.processing[0].progress).toBe(50);
      expect(processingQueue.processing[0].currentTask).toBe('Extracting text');
    });

    it('should update display', () => {
      const updateDisplaySpy = vi.spyOn(processingQueue, 'updateDisplay');
      processingQueue.updateProgress({ id: 1, progress: 50 });
      
      expect(updateDisplaySpy).toHaveBeenCalled();
    });

    it('should ignore progress for non-existent item', () => {
      const updateDisplaySpy = vi.spyOn(processingQueue, 'updateDisplay');
      processingQueue.updateProgress({ id: 999, progress: 50 });
      
      expect(updateDisplaySpy).not.toHaveBeenCalled();
    });
  });

  describe('markCompleted()', () => {
    beforeEach(() => {
      processingQueue = new ProcessingQueue('processing-queue-container');
      processingQueue.startProcessing([
        { id: 1, file: { name: 'test.pdf', size: 1024 } }
      ]);
      processingQueue.processNext();
    });

    it('should move item from processing to completed', () => {
      processingQueue.markCompleted({
        id: 1,
        result: { pagesProcessed: 1 }
      });
      
      expect(processingQueue.processing).toHaveLength(0);
      expect(processingQueue.completed).toHaveLength(1);
      expect(processingQueue.processedItems).toBe(1);
    });

    it('should set completion data', () => {
      processingQueue.markCompleted({
        id: 1,
        result: { pagesProcessed: 1 }
      });
      
      const item = processingQueue.completed[0];
      expect(item.status).toBe('completed');
      expect(item.endTime).toBeTruthy();
      expect(item.result).toEqual({ pagesProcessed: 1 });
    });

    it('should process next item', () => {
      const processSpy = vi.spyOn(processingQueue, 'processNext');
      processingQueue.markCompleted({ id: 1, result: {} });
      
      expect(processSpy).toHaveBeenCalled();
    });

    it('should auto-hide completed items if enabled', () => {
      processingQueue = new ProcessingQueue('processing-queue-container', {
        autoHideCompleted: true,
        maxVisibleItems: 1
      });
      
      // Add items to exceed maxVisibleItems
      for (let i = 0; i < 3; i++) {
        processingQueue.completed.push({ id: i, status: 'completed' });
      }
      
      processingQueue.markCompleted({
        id: 1,
        result: { pagesProcessed: 1 }
      });
      
      // First item should be hidden
      expect(processingQueue.completed).toHaveLength(3);
    });
  });

  describe('markFailed()', () => {
    beforeEach(() => {
      processingQueue = new ProcessingQueue('processing-queue-container');
      processingQueue.startProcessing([
        { id: 1, file: { name: 'test.pdf', size: 1024 } }
      ]);
      processingQueue.processNext();
    });

    it('should move item from processing to failed', () => {
      processingQueue.markFailed({
        id: 1,
        error: 'Processing failed'
      });
      
      expect(processingQueue.processing).toHaveLength(0);
      expect(processingQueue.failed).toHaveLength(1);
      expect(processingQueue.processedItems).toBe(1);
    });

    it('should set error data', () => {
      processingQueue.markFailed({
        id: 1,
        error: 'Invalid PDF format'
      });
      
      const item = processingQueue.failed[0];
      expect(item.status).toBe('failed');
      expect(item.endTime).toBeTruthy();
      expect(item.error).toBe('Invalid PDF format');
    });

    it('should show error toast', () => {
      processingQueue.markFailed({
        id: 1,
        error: 'Invalid PDF format'
      });
      
      expect(showToast).toHaveBeenCalledWith(
        'Failed to process test.pdf: Invalid PDF format',
        'error'
      );
    });
  });

  describe('updateDisplay()', () => {
    beforeEach(() => {
      processingQueue = new ProcessingQueue('processing-queue-container');
    });

    it('should show empty state when no items', () => {
      processingQueue.updateDisplay();
      
      const emptyState = container.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
    });

    it('should render queue items', () => {
      processingQueue.queue.push({
        id: 1,
        fileName: 'test.pdf',
        status: 'queued'
      });
      
      processingQueue.updateDisplay();
      
      const queueItems = container.querySelectorAll('.queue-item');
      expect(queueItems).toHaveLength(1);
    });

    it('should filter items by active filter', () => {
      processingQueue.queue.push({
        id: 1,
        fileName: 'test1.pdf',
        status: 'queued'
      });
      processingQueue.processing.push({
        id: 2,
        fileName: 'test2.pdf',
        status: 'processing'
      });
      
      // Set filter to processing
      container.querySelector('[data-filter="processing"]').click();
      
      const queueItems = container.querySelectorAll('.queue-item');
      expect(queueItems).toHaveLength(1);
      expect(queueItems[0].textContent).toContain('test2.pdf');
    });
  });

  describe('renderQueueItem()', () => {
    beforeEach(() => {
      processingQueue = new ProcessingQueue('processing-queue-container');
    });

    it('should render queued item correctly', () => {
      const item = {
        id: 1,
        fileName: 'test.pdf',
        status: 'queued',
        position: 1
      };
      
      const html = processingQueue.renderQueueItem(item);
      
      expect(html).toContain('test.pdf');
      expect(html).toContain('Queued');
      expect(html).toContain('#1');
    });

    it('should render processing item with progress', () => {
      const item = {
        id: 1,
        fileName: 'test.pdf',
        status: 'processing',
        progress: 50,
        currentTask: 'Extracting text'
      };
      
      const html = processingQueue.renderQueueItem(item);
      
      expect(html).toContain('50%');
      expect(html).toContain('Extracting text');
      expect(html).toContain('progress-fill');
    });

    it('should render completed item', () => {
      const item = {
        id: 1,
        fileName: 'test.pdf',
        status: 'completed',
        result: { pagesProcessed: 3 }
      };
      
      const html = processingQueue.renderQueueItem(item);
      
      expect(html).toContain('3 pages processed');
      expect(html).toContain('Completed');
    });

    it('should render failed item with error', () => {
      const item = {
        id: 1,
        fileName: 'test.pdf',
        status: 'failed',
        error: 'Invalid PDF format'
      };
      
      const html = processingQueue.renderQueueItem(item);
      
      expect(html).toContain('Invalid PDF format');
      expect(html).toContain('Failed');
    });
  });

  describe('updateOverallProgress()', () => {
    beforeEach(() => {
      processingQueue = new ProcessingQueue('processing-queue-container');
    });

    it('should calculate percentage correctly', () => {
      processingQueue.totalItems = 4;
      processingQueue.processedItems = 1;
      
      processingQueue.updateOverallProgress();
      
      const percentage = container.querySelector('.overall-percentage');
      expect(percentage.textContent).toBe('25%');
    });

    it('should update progress bar width', () => {
      processingQueue.totalItems = 2;
      processingQueue.processedItems = 1;
      
      processingQueue.updateOverallProgress();
      
      const progressBar = container.querySelector('.overall-progress');
      expect(progressBar.style.width).toBe('50%');
    });

    it('should update estimated time when enabled', () => {
      processingQueue.totalItems = 2;
      processingQueue.processedItems = 1;
      processingQueue.startTime = Date.now() - 5000; // 5 seconds ago
      
      processingQueue.updateOverallProgress();
      
      const estimatedTime = container.querySelector('.estimated-time');
      expect(estimatedTime.textContent).toMatch(/Estimated time remaining:/);
    });
  });

  describe('formatDuration()', () => {
    beforeEach(() => {
      processingQueue = new ProcessingQueue('processing-queue-container');
    });

    it('should format seconds correctly', () => {
      expect(processingQueue.formatDuration(5000)).toBe('5s');
      expect(processingQueue.formatDuration(30000)).toBe('30s');
    });

    it('should format minutes correctly', () => {
      expect(processingQueue.formatDuration(65000)).toBe('1m 5s');
      expect(processingQueue.formatDuration(120000)).toBe('2m 0s');
    });

    it('should format hours correctly', () => {
      expect(processingQueue.formatDuration(3665000)).toBe('1h 1m 5s');
    });

    it('should handle zero duration', () => {
      expect(processingQueue.formatDuration(0)).toBe('0s');
    });
  });

  describe('pause/resume functionality', () => {
    beforeEach(() => {
      processingQueue = new ProcessingQueue('processing-queue-container');
    });

    it('should emit pause event when paused', () => {
      processingQueue.pauseProcessing();
      
      expect(eventBus.emit).toHaveBeenCalledWith('pause-processing');
    });

    it('should emit resume event when resumed', () => {
      processingQueue.resumeProcessing();
      
      expect(eventBus.emit).toHaveBeenCalledWith('resume-processing');
    });

    it('should update button visibility when paused', () => {
      processingQueue.setPaused(true);
      
      const pauseBtn = container.querySelector('.pause-btn');
      const resumeBtn = container.querySelector('.resume-btn');
      
      expect(pauseBtn.classList.contains('hidden')).toBe(true);
      expect(resumeBtn.classList.contains('hidden')).toBe(false);
    });
  });

  describe('cancelAll()', () => {
    beforeEach(() => {
      processingQueue = new ProcessingQueue('processing-queue-container');
      processingQueue.startProcessing([
        { id: 1, file: { name: 'test.pdf', size: 1024 } }
      ]);
      processingQueue.processNext();
    });

    it('should show confirmation dialog', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      
      processingQueue.cancelAll();
      
      expect(confirmSpy).toHaveBeenCalledWith(
        'Are you sure you want to cancel all processing?'
      );
    });

    it('should cancel all processing when confirmed', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      
      processingQueue.cancelAll();
      
      expect(processingQueue.processing).toHaveLength(0);
      expect(processingQueue.queue).toHaveLength(0);
      expect(processingQueue.failed).toHaveLength(1);
    });

    it('should emit cancel event', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      
      processingQueue.cancelAll();
      
      expect(eventBus.emit).toHaveBeenCalledWith('cancel-all-processing');
    });

    it('should not cancel when not confirmed', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      
      processingQueue.cancelAll();
      
      expect(processingQueue.processing).toHaveLength(1);
    });
  });

  describe('getStats()', () => {
    beforeEach(() => {
      processingQueue = new ProcessingQueue('processing-queue-container');
      processingQueue.startProcessing([
        { id: 1, file: { name: 'test1.pdf', size: 1024 } },
        { id: 2, file: { name: 'test2.pdf', size: 2048 } }
      ]);
    });

    it('should return correct statistics', () => {
      processingQueue.processNext();
      processingQueue.markCompleted({ id: 1, result: {} });
      
      const stats = processingQueue.getStats();
      
      expect(stats.total).toBe(2);
      expect(stats.processed).toBe(1);
      expect(stats.processing).toBe(0);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(0);
      expect(stats.queued).toBe(1);
    });
  });

  describe('clear()', () => {
    beforeEach(() => {
      processingQueue = new ProcessingQueue('processing-queue-container');
      processingQueue.startProcessing([
        { id: 1, file: { name: 'test.pdf', size: 1024 } }
      ]);
    });

    it('should reset all data', () => {
      processingQueue.processNext();
      processingQueue.clear();
      
      expect(processingQueue.queue).toEqual([]);
      expect(processingQueue.processing).toEqual([]);
      expect(processingQueue.completed).toEqual([]);
      expect(processingQueue.failed).toEqual([]);
      expect(processingQueue.totalItems).toBe(0);
      expect(processingQueue.processedItems).toBe(0);
    });
  });

  describe('refresh timer', () => {
    beforeEach(() => {
      processingQueue = new ProcessingQueue('processing-queue-container');
    });

    it('should start refresh timer on init', () => {
      expect(processingQueue.refreshTimer).toBeTruthy();
    });

    it('should stop refresh timer on destroy', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      processingQueue.destroy();
      
      expect(clearIntervalSpy).toHaveBeenCalledWith(processingQueue.refreshTimer);
    });
  });
});