import { eventBus } from '../utils/eventBus.js';
import { showToast } from '../utils/toast.js';
import { auditLogger } from '../utils/auditLogger.js';

/**
 * FileUpload Component
 * Handles file uploads with drag-and-drop support, validation, and progress tracking
 */
export class FileUpload {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container with id "${containerId}" not found`);
    }

    // Default options
    this.options = {
      maxFileSize: 50 * 1024 * 1024, // 50MB
      allowedTypes: ['application/pdf'],
      maxFiles: 10,
      chunkSize: 1024 * 1024, // 1MB chunks for large files
      ...options
    };

    this.files = [];
    this.isDragging = false;
    this.abortControllers = new Map();

    this.init();
  }

  /**
   * Initialize the component
   */
  init() {
    this.render();
    this.attachEventListeners();
    this.setupKeyboardNavigation();
  }

  /**
   * Render the component HTML
   */
  render() {
    this.container.innerHTML = `
      <div class="file-upload-container" role="region" aria-label="File upload area">
        <div 
          class="upload-area border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors hover:border-blue-500 focus-within:border-blue-500"
          tabindex="0"
          role="button"
          aria-label="Drop files here or click to select"
        >
          <div class="upload-icon mb-4">
            <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <div class="upload-text">
            <p class="text-lg font-medium text-gray-700 mb-2">
              Drop files here or click to select
            </p>
            <p class="text-sm text-gray-500">
              PDF files up to ${this.formatFileSize(this.options.maxFileSize)}
            </p>
          </div>
          <input 
            type="file" 
            id="file-input"
            class="hidden" 
            accept="${this.options.allowedTypes.join(',')}"
            multiple
            aria-label="Select files to upload"
          >
        </div>

        <div class="file-list mt-6 space-y-2" role="list" aria-label="Uploaded files"></div>

        <div class="upload-actions mt-4 flex justify-end space-x-3">
          <button 
            type="button" 
            class="cancel-btn px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            disabled
            aria-label="Cancel all uploads"
          >
            Cancel All
          </button>
          <button 
            type="button" 
            class="upload-btn px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            disabled
            aria-label="Start processing"
          >
            Process Files
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const uploadArea = this.container.querySelector('.upload-area');
    const fileInput = this.container.querySelector('#file-input');
    const uploadBtn = this.container.querySelector('.upload-btn');
    const cancelBtn = this.container.querySelector('.cancel-btn');

    // Click to upload
    uploadArea.addEventListener('click', (e) => {
      if (e.target === uploadArea || uploadArea.contains(e.target)) {
        fileInput.click();
      }
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
      this.handleFiles(Array.from(e.target.files));
    });

    // Drag and drop events
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.isDragging = true;
      uploadArea.classList.add('border-blue-500', 'bg-blue-50');
    });

    uploadArea.addEventListener('dragleave', (e) => {
      e.preventDefault();
      this.isDragging = false;
      uploadArea.classList.remove('border-blue-500', 'bg-blue-50');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      this.isDragging = false;
      uploadArea.classList.remove('border-blue-500', 'bg-blue-50');
      
      const files = Array.from(e.dataTransfer.files);
      this.handleFiles(files);
    });

    // Button actions
    uploadBtn.addEventListener('click', () => this.startProcessing());
    cancelBtn.addEventListener('click', () => this.cancelAllUploads());

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, this.preventDefaults, false);
      document.body.addEventListener(eventName, this.preventDefaults, false);
    });
  }

  /**
   * Setup keyboard navigation
   */
  setupKeyboardNavigation() {
    const uploadArea = this.container.querySelector('.upload-area');
    
    uploadArea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.container.querySelector('#file-input').click();
      }
    });
  }

  /**
   * Prevent default drag behaviors
   */
  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  /**
   * Handle file selection and validation
   */
  handleFiles(files) {
    const validFiles = [];
    const errors = [];

    files.forEach(file => {
      // Validate file type
      if (!this.options.allowedTypes.includes(file.type)) {
        errors.push(`"${file.name}" is not a supported file type`);
        return;
      }

      // Validate file size
      if (file.size > this.options.maxFileSize) {
        errors.push(`"${file.name}" exceeds the maximum file size of ${this.formatFileSize(this.options.maxFileSize)}`);
        return;
      }

      // Validate maximum files
      if (this.files.length + validFiles.length >= this.options.maxFiles) {
        errors.push(`Maximum ${this.options.maxFiles} files allowed`);
        return;
      }

      validFiles.push(file);
    });

    // Show errors
    if (errors.length > 0) {
      showToast(errors.join('. '), 'error');
    }

    // Add valid files
    validFiles.forEach(file => {
      const fileId = Date.now() + Math.random();
      this.files.push({
        id: fileId,
        file: file,
        progress: 0,
        status: 'pending'
      });
      
      this.renderFileItem(fileId, file);
    });

    this.updateButtons();
    
    // Log file selection
    auditLogger.log('files_selected', {
      count: validFiles.length,
      totalSize: validFiles.reduce((sum, file) => sum + file.size, 0)
    });
  }

  /**
   * Render a single file item
   */
  renderFileItem(fileId, file) {
    const fileList = this.container.querySelector('.file-list');
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item flex items-center justify-between p-3 bg-white border border-gray-200 rounded-md';
    fileItem.setAttribute('role', 'listitem');
    fileItem.innerHTML = `
      <div class="file-info flex items-center space-x-3 flex-1">
        <div class="file-icon text-gray-400">
          <svg class="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="file-details">
          <p class="file-name text-sm font-medium text-gray-900">${this.escapeHtml(file.name)}</p>
          <p class="file-size text-sm text-gray-500">${this.formatFileSize(file.size)}</p>
        </div>
      </div>
      <div class="file-actions flex items-center space-x-3">
        <div class="progress-bar w-24 hidden">
          <div class="progress-fill h-2 bg-blue-600 rounded-full transition-all duration-300" style="width: 0%"></div>
        </div>
        <button 
          type="button" 
          class="remove-btn text-gray-400 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
          aria-label="Remove file"
        >
          <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    `;

    // Add remove functionality
    const removeBtn = fileItem.querySelector('.remove-btn');
    removeBtn.addEventListener('click', () => this.removeFile(fileId));

    fileList.appendChild(fileItem);
  }

  /**
   * Remove a file from the list
   */
  removeFile(fileId) {
    const index = this.files.findIndex(f => f.id === fileId);
    if (index !== -1) {
      const file = this.files[index];
      
      // Cancel upload if in progress
      if (file.status === 'uploading' && this.abortControllers.has(fileId)) {
        this.abortControllers.get(fileId).abort();
        this.abortControllers.delete(fileId);
      }

      this.files.splice(index, 1);
      
      // Remove from DOM
      const fileItems = this.container.querySelectorAll('.file-item');
      fileItems[index].remove();

      this.updateButtons();
      
      auditLogger.log('file_removed', { fileName: file.file.name });
    }
  }

  /**
   * Start processing all files
   */
  async startProcessing() {
    const pendingFiles = this.files.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    this.container.querySelector('.upload-btn').disabled = true;
    
    // Emit event to start processing
    eventBus.emit('start-processing', {
      files: pendingFiles.map(f => ({ id: f.id, file: f.file }))
    });

    // Simulate upload progress (in real app, this would be actual upload)
    for (const file of pendingFiles) {
      await this.simulateUpload(file);
    }

    this.updateButtons();
  }

  /**
   * Simulate file upload with progress
   */
  async simulateUpload(fileObj) {
    fileObj.status = 'uploading';
    
    const fileIndex = this.files.findIndex(f => f.id === fileObj.id);
    const fileItem = this.container.querySelectorAll('.file-item')[fileIndex];
    const progressBar = fileItem.querySelector('.progress-bar');
    const progressFill = fileItem.querySelector('.progress-fill');
    
    progressBar.classList.remove('hidden');
    
    // Create abort controller
    const abortController = new AbortController();
    this.abortControllers.set(fileObj.id, abortController);

    return new Promise((resolve, reject) => {
      let progress = 0;
      const interval = setInterval(() => {
        if (abortController.signal.aborted) {
          clearInterval(interval);
          fileObj.status = 'cancelled';
          progressBar.classList.add('hidden');
          showToast(`Upload cancelled for ${fileObj.file.name}`, 'info');
          resolve();
          return;
        }

        progress += Math.random() * 20;
        if (progress > 100) progress = 100;

        fileObj.progress = progress;
        progressFill.style.width = `${progress}%`;

        if (progress >= 100) {
          clearInterval(interval);
          fileObj.status = 'completed';
          progressBar.classList.add('hidden');
          
          // Emit file completed event
          eventBus.emit('file-completed', {
            id: fileObj.id,
            file: fileObj.file
          });
          
          resolve();
        }
      }, 200);
    });
  }

  /**
   * Cancel all uploads
   */
  cancelAllUploads() {
    this.abortControllers.forEach(controller => controller.abort());
    this.abortControllers.clear();
    
    this.files.forEach(file => {
      if (file.status === 'uploading') {
        file.status = 'cancelled';
      }
    });

    // Hide all progress bars
    this.container.querySelectorAll('.progress-bar').forEach(bar => {
      bar.classList.add('hidden');
    });

    this.updateButtons();
    showToast('All uploads cancelled', 'info');
  }

  /**
   * Update button states
   */
  updateButtons() {
    const uploadBtn = this.container.querySelector('.upload-btn');
    const cancelBtn = this.container.querySelector('.cancel-btn');
    const hasFiles = this.files.length > 0;
    const hasPendingFiles = this.files.some(f => f.status === 'pending');
    const hasUploadingFiles = this.files.some(f => f.status === 'uploading');

    uploadBtn.disabled = !hasPendingFiles;
    cancelBtn.disabled = !hasUploadingFiles;
  }

  /**
   * Format file size to human readable format
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
   * Get selected files
   */
  getFiles() {
    return this.files;
  }

  /**
   * Clear all files
   */
  clear() {
    this.files = [];
    this.abortControllers.clear();
    this.container.querySelector('.file-list').innerHTML = '';
    this.updateButtons();
  }

  /**
   * Destroy the component
   */
  destroy() {
    this.cancelAllUploads();
    this.container.innerHTML = '';
  }
}