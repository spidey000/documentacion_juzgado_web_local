import { eventBus } from '../utils/eventBus.js';
import { showToast } from '../utils/toast.js';
import { auditLogger } from '../utils/auditLogger.js';

/**
 * ProcessingQueue Component
 * Displays processing progress, queue status, and provides control over the processing workflow
 */
export class ProcessingQueue {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container with id "${containerId}" not found`);
    }

    // Default options
    this.options = {
      showEstimatedTime: true,
      autoHideCompleted: false,
      maxVisibleItems: 10,
      refreshInterval: 1000,
      ...options
    };

    this.queue = [];
    this.processing = [];
    this.completed = [];
    this.failed = [];
    this.refreshTimer = null;
    this.startTime = null;
    this.totalItems = 0;
    this.processedItems = 0;

    this.init();
  }

  /**
   * Initialize the component
   */
  init() {
    this.render();
    this.attachEventListeners();
    this.setupEventBusListeners();
    this.startRefreshTimer();
  }

  /**
   * Render the component HTML
   */
  render() {
    this.container.innerHTML = `
      <div class="processing-queue-container" role="region" aria-label="Processing queue">
        <!-- Queue Header -->
        <div class="queue-header bg-gray-50 border-b border-gray-200 px-4 py-3">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900">Processing Queue</h2>
            <div class="queue-stats flex items-center space-x-4 text-sm">
              <div class="stat-item">
                <span class="text-gray-600">Total:</span>
                <span class="font-medium total-count" aria-label="Total items">0</span>
              </div>
              <div class="stat-item">
                <span class="text-gray-600">Processing:</span>
                <span class="font-medium text-blue-600 processing-count" aria-label="Processing items">0</span>
              </div>
              <div class="stat-item">
                <span class="text-gray-600">Completed:</span>
                <span class="font-medium text-green-600 completed-count" aria-label="Completed items">0</span>
              </div>
              <div class="stat-item">
                <span class="text-gray-600">Failed:</span>
                <span class="font-medium text-red-600 failed-count" aria-label="Failed items">0</span>
              </div>
            </div>
          </div>
          
          <!-- Overall Progress Bar -->
          <div class="mt-3">
            <div class="flex items-center justify-between text-sm mb-1">
              <span class="text-gray-600">Overall Progress</span>
              <span class="font-medium overall-percentage">0%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div class="overall-progress h-full bg-blue-600 transition-all duration-300 ease-out" style="width: 0%"></div>
            </div>
            ${this.options.showEstimatedTime ? `
              <div class="mt-1 text-xs text-gray-500 estimated-time">
                Estimated time remaining: Calculating...
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Queue Actions -->
        <div class="queue-actions bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
          <div class="action-buttons flex items-center space-x-2">
            <button 
              class="pause-btn px-3 py-1 text-sm font-medium text-white bg-yellow-600 rounded hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-50"
              disabled
              aria-label="Pause processing"
            >
              <svg class="inline-block w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              Pause
            </button>
            <button 
              class="resume-btn px-3 py-1 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 hidden"
              aria-label="Resume processing"
            >
              <svg class="inline-block w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
              </svg>
              Resume
            </button>
            <button 
              class="cancel-btn px-3 py-1 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
              disabled
              aria-label="Cancel all processing"
            >
              <svg class="inline-block w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
              Cancel All
            </button>
          </div>
          
          <div class="filter-buttons flex items-center space-x-2">
            <button 
              class="filter-btn active px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              data-filter="all"
              aria-label="Show all items"
            >
              All
            </button>
            <button 
              class="filter-btn px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              data-filter="processing"
              aria-label="Show processing items"
            >
              Processing
            </button>
            <button 
              class="filter-btn px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              data-filter="completed"
              aria-label="Show completed items"
            >
              Completed
            </button>
            <button 
              class="filter-btn px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              data-filter="failed"
              aria-label="Show failed items"
            >
              Failed
            </button>
          </div>
        </div>

        <!-- Queue Items Container -->
        <div class="queue-items-container bg-gray-50 max-h-96 overflow-y-auto">
          <div class="queue-items p-4 space-y-3">
            <!-- Empty State -->
            <div class="empty-state text-center py-8">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
              </svg>
              <p class="mt-2 text-sm text-gray-500">No items in queue</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Action buttons
    this.container.querySelector('.pause-btn').addEventListener('click', () => this.pauseProcessing());
    this.container.querySelector('.resume-btn').addEventListener('click', () => this.resumeProcessing());
    this.container.querySelector('.cancel-btn').addEventListener('click', () => this.cancelAll());

    // Filter buttons
    this.container.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.setFilter(e.target.dataset.filter);
      });
    });
  }

  /**
   * Setup event bus listeners
   */
  setupEventBusListeners() {
    eventBus.on('start-processing', (data) => {
      this.startProcessing(data.files);
    });

    eventBus.on('processing-progress', (data) => {
      this.updateProgress(data);
    });

    eventBus.on('processing-completed', (data) => {
      this.markCompleted(data);
    });

    eventBus.on('processing-failed', (data) => {
      this.markFailed(data);
    });

    eventBus.on('processing-paused', () => {
      this.setPaused(true);
    });

    eventBus.on('processing-resumed', () => {
      this.setPaused(false);
    });
  }

  /**
   * Start processing files
   */
  startProcessing(files) {
    this.queue = [];
    this.processing = [];
    this.completed = [];
    this.failed = [];
    this.startTime = Date.now();
    this.totalItems = files.length;
    this.processedItems = 0;

    // Add files to queue
    files.forEach((fileData, index) => {
      this.queue.push({
        id: fileData.id,
        fileName: fileData.file.name,
        fileSize: fileData.file.size,
        status: 'queued',
        progress: 0,
        startTime: null,
        endTime: null,
        error: null,
        position: index + 1
      });
    });

    this.updateDisplay();
    this.updateButtons();
    
    auditLogger.log('processing_started', {
      totalFiles: this.totalItems,
      totalSize: files.reduce((sum, f) => sum + f.file.size, 0)
    });

    // Start processing first item
    this.processNext();
  }

  /**
   * Process next item in queue
   */
  processNext() {
    if (this.queue.length === 0 || this.processing.length > 0) return;

    const item = this.queue.shift();
    item.status = 'processing';
    item.startTime = Date.now();
    this.processing.push(item);

    this.updateDisplay();
    this.updateButtons();

    // Emit event to start processing this item
    eventBus.emit('process-item', {
      id: item.id,
      fileName: item.fileName,
      position: item.position
    });
  }

  /**
   * Update progress for an item
   */
  updateProgress(data) {
    const item = this.processing.find(i => i.id === data.id);
    if (!item) return;

    item.progress = data.progress;
    item.currentTask = data.currentTask;

    this.updateDisplay();
    this.updateOverallProgress();
  }

  /**
   * Mark an item as completed
   */
  markCompleted(data) {
    const index = this.processing.findIndex(i => i.id === data.id);
    if (index === -1) return;

    const item = this.processing[index];
    item.status = 'completed';
    item.endTime = Date.now();
    item.result = data.result;

    this.processing.splice(index, 1);
    this.completed.push(item);
    this.processedItems++;

    this.updateDisplay();
    this.updateOverallProgress();
    this.updateButtons();

    // Process next item
    this.processNext();

    // Auto-hide if option is enabled
    if (this.options.autoHideCompleted && this.completed.length > this.options.maxVisibleItems) {
      setTimeout(() => {
        this.hideCompletedItem(item.id);
      }, 5000);
    }
  }

  /**
   * Mark an item as failed
   */
  markFailed(data) {
    const index = this.processing.findIndex(i => i.id === data.id);
    if (index === -1) return;

    const item = this.processing[index];
    item.status = 'failed';
    item.endTime = Date.now();
    item.error = data.error;

    this.processing.splice(index, 1);
    this.failed.push(item);
    this.processedItems++;

    this.updateDisplay();
    this.updateOverallProgress();
    this.updateButtons();

    // Process next item
    this.processNext();

    showToast(`Failed to process ${item.fileName}: ${data.error}`, 'error');
  }

  /**
   * Update the display
   */
  updateDisplay() {
    const itemsContainer = this.container.querySelector('.queue-items');
    const allItems = [...this.queue, ...this.processing, ...this.completed, ...this.failed];
    const activeFilter = this.container.querySelector('.filter-btn.active').dataset.filter;
    
    // Filter items
    const filteredItems = this.filterItems(allItems, activeFilter);

    if (filteredItems.length === 0) {
      itemsContainer.innerHTML = `
        <div class="empty-state text-center py-8">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
          </svg>
          <p class="mt-2 text-sm text-gray-500">No ${activeFilter === 'all' ? '' : activeFilter} items</p>
        </div>
      `;
    } else {
      itemsContainer.innerHTML = filteredItems.map(item => this.renderQueueItem(item)).join('');
    }

    // Update stats
    this.updateStats();
  }

  /**
   * Render a single queue item
   */
  renderQueueItem(item) {
    const statusColors = {
      queued: 'bg-gray-100 text-gray-700',
      processing: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700'
    };

    const statusIcons = {
      queued: '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" /></svg>',
      processing: '<svg class="w-4 h-4 animate-spin" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" /></svg>',
      completed: '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>',
      failed: '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" /></svg>'
    };

    return `
      <div class="queue-item bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow" role="listitem">
        <div class="flex items-center justify-between">
          <div class="item-info flex-1">
            <div class="flex items-center space-x-2">
              <span class="status-badge inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[item.status]}">
                ${statusIcons[item.status]}
                <span class="ml-1 capitalize">${item.status}</span>
              </span>
              <span class="file-name font-medium text-gray-900">${this.escapeHtml(item.fileName)}</span>
              ${item.position ? `<span class="text-xs text-gray-500">#${item.position}</span>` : ''}
            </div>
            
            ${item.status === 'processing' ? `
              <div class="mt-2">
                <div class="flex items-center justify-between text-sm mb-1">
                  <span class="text-gray-600">${item.currentTask || 'Processing...'}</span>
                  <span class="font-medium">${Math.round(item.progress)}%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-1.5">
                  <div class="progress-fill h-full bg-blue-600 transition-all duration-300" style="width: ${item.progress}%"></div>
                </div>
              </div>
            ` : ''}
            
            ${item.status === 'failed' && item.error ? `
              <div class="mt-2 text-sm text-red-600">
                Error: ${this.escapeHtml(item.error)}
              </div>
            ` : ''}
            
            ${item.status === 'completed' && item.result ? `
              <div class="mt-2 text-sm text-green-600">
                ${item.result.pagesProcessed || 0} pages processed
              </div>
            ` : ''}
          </div>
          
          <div class="item-actions ml-4">
            ${item.status === 'processing' ? `
              <button 
                class="cancel-item-btn text-red-600 hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 rounded p-1"
                aria-label="Cancel processing this item"
              >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Filter items by status
   */
  filterItems(items, filter) {
    if (filter === 'all') return items;
    return items.filter(item => item.status === filter);
  }

  /**
   * Update statistics
   */
  updateStats() {
    this.container.querySelector('.total-count').textContent = this.totalItems;
    this.container.querySelector('.processing-count').textContent = this.processing.length;
    this.container.querySelector('.completed-count').textContent = this.completed.length;
    this.container.querySelector('.failed-count').textContent = this.failed.length;
  }

  /**
   * Update overall progress
   */
  updateOverallProgress() {
    const percentage = this.totalItems > 0 ? (this.processedItems / this.totalItems) * 100 : 0;
    
    this.container.querySelector('.overall-percentage').textContent = `${Math.round(percentage)}%`;
    this.container.querySelector('.overall-progress').style.width = `${percentage}%`;

    // Update estimated time
    if (this.options.showEstimatedTime && this.processing.length > 0) {
      this.updateEstimatedTime();
    }
  }

  /**
   * Update estimated time remaining
   */
  updateEstimatedTime() {
    if (!this.startTime || this.processedItems === 0) return;

    const elapsed = Date.now() - this.startTime;
    const avgTimePerItem = elapsed / this.processedItems;
    const remainingItems = this.totalItems - this.processedItems;
    const estimatedRemaining = avgTimePerItem * remainingItems;

    const timeElement = this.container.querySelector('.estimated-time');
    if (timeElement) {
      timeElement.textContent = `Estimated time remaining: ${this.formatDuration(estimatedRemaining)}`;
    }
  }

  /**
   * Format duration in milliseconds to human readable format
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Set active filter
   */
  setFilter(filter) {
    this.container.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.remove('active', 'bg-blue-100', 'text-blue-700');
      btn.classList.add('bg-gray-100');
    });

    const activeBtn = this.container.querySelector(`[data-filter="${filter}"]`);
    activeBtn.classList.add('active', 'bg-blue-100', 'text-blue-700');
    activeBtn.classList.remove('bg-gray-100');

    this.updateDisplay();
  }

  /**
   * Pause processing
   */
  pauseProcessing() {
    eventBus.emit('pause-processing');
    this.setPaused(true);
    showToast('Processing paused', 'info');
  }

  /**
   * Resume processing
   */
  resumeProcessing() {
    eventBus.emit('resume-processing');
    this.setPaused(false);
    showToast('Processing resumed', 'info');
  }

  /**
   * Set paused state
   */
  setPaused(paused) {
    const pauseBtn = this.container.querySelector('.pause-btn');
    const resumeBtn = this.container.querySelector('.resume-btn');

    if (paused) {
      pauseBtn.classList.add('hidden');
      resumeBtn.classList.remove('hidden');
    } else {
      pauseBtn.classList.remove('hidden');
      resumeBtn.classList.add('hidden');
    }
  }

  /**
   * Cancel all processing
   */
  cancelAll() {
    if (confirm('Are you sure you want to cancel all processing?')) {
      eventBus.emit('cancel-all-processing');
      
      // Move all processing and queued items to failed
      [...this.processing, ...this.queue].forEach(item => {
        item.status = 'cancelled';
        item.endTime = Date.now();
        this.failed.push(item);
      });

      this.processing = [];
      this.queue = [];

      this.updateDisplay();
      this.updateButtons();
      
      showToast('All processing cancelled', 'warning');
      
      auditLogger.log('processing_cancelled', {
        cancelledItems: this.failed.length,
        processedItems: this.processedItems
      });
    }
  }

  /**
   * Hide a completed item
   */
  hideCompletedItem(itemId) {
    const index = this.completed.findIndex(item => item.id === itemId);
    if (index !== -1) {
      this.completed.splice(index, 1);
      this.updateDisplay();
    }
  }

  /**
   * Update button states
   */
  updateButtons() {
    const hasItems = this.totalItems > 0;
    const hasProcessing = this.processing.length > 0;
    const hasQueued = this.queue.length > 0;

    this.container.querySelector('.pause-btn').disabled = !hasProcessing;
    this.container.querySelector('.resume-btn').disabled = !hasItems;
    this.container.querySelector('.cancel-btn').disabled = !hasItems;
  }

  /**
   * Start refresh timer
   */
  startRefreshTimer() {
    this.refreshTimer = setInterval(() => {
      this.updateDisplay();
      this.updateOverallProgress();
    }, this.options.refreshInterval);
  }

  /**
   * Stop refresh timer
   */
  stopRefreshTimer() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      total: this.totalItems,
      processed: this.processedItems,
      processing: this.processing.length,
      completed: this.completed.length,
      failed: this.failed.length,
      queued: this.queue.length
    };
  }

  /**
   * Clear the queue
   */
  clear() {
    this.queue = [];
    this.processing = [];
    this.completed = [];
    this.failed = [];
    this.totalItems = 0;
    this.processedItems = 0;
    this.startTime = null;

    this.updateDisplay();
    this.updateButtons();
  }

  /**
   * Destroy the component
   */
  destroy() {
    this.stopRefreshTimer();
    this.container.innerHTML = '';
  }
}