/**
 * Main entry point for the Client-Side PDF Processor
 * 
 * This file initializes the application and sets up all the
 * necessary components and event listeners.
 * 
 * @version 1.0.0
 * @author Client-Side PDF Processor Team
 */

// Import core modules
import { FileUpload } from '@components/FileUpload.js';
import { PDFViewer } from '@components/PDFViewer.js';
import { ProcessingQueue } from '@components/ProcessingQueue.js';
import { ResultsPanel } from '@components/ResultsPanel.js';
import { PDFProcessor } from '@core/pdfProcessor.js';
import { OCRValidator } from '@core/ocrValidator.js';
import { AIDescriber } from '@core/aiDescriber.js';
import { IndexGenerator } from '@core/indexGenerator.js';
import { AuditLogger } from '@utils/auditLogger.js';
import { Toast } from '@utils/toast.js';
import { EventBus } from '@utils/eventBus.js';

// Import styles
import './assets/styles/main.css';

/**
 * Main Application Class
 * 
 * Manages the entire application lifecycle and coordinates
 * between different components.
 */
class App {
  constructor() {
    // Application state
    this.state = {
      files: [],
      processing: false,
      processedFiles: [],
      excludedFiles: [],
      settings: {
        validateOCR: true,
        mergePDFs: false,
        generateAIDescription: false,
        generateIndex: false,
      },
    };

    // Initialize components
    this.initializeComponents();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Log application start
    AuditLogger.info('Application initialized', {
      version: __APP_VERSION__,
      name: __APP_NAME__,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Initialize all application components
   */
  initializeComponents() {
    // Initialize UI components
    this.fileUpload = new FileUpload({
      container: document.getElementById('file-upload-area'),
      onFilesSelected: this.handleFilesSelected.bind(this),
    });

    this.pdfViewer = new PDFViewer({
      container: document.getElementById('pdf-viewer-content'),
      titleElement: document.getElementById('pdf-viewer-title'),
    });

    this.processingQueue = new ProcessingQueue({
      container: document.getElementById('processing-progress'),
      progressBar: document.getElementById('progress-bar'),
      percentageElement: document.getElementById('progress-percentage'),
      taskElement: document.getElementById('current-task'),
    });

    this.resultsPanel = new ResultsPanel({
      container: document.getElementById('results-content'),
      processedContainer: document.getElementById('processed-files-list'),
      excludedContainer: document.getElementById('excluded-files-list'),
      downloadsContainer: document.getElementById('download-list'),
    });

    // Initialize core processing modules
    this.pdfProcessor = new PDFProcessor();
    this.ocrValidator = new OCRValidator();
    this.aiDescriber = new AIDescriber();
    this.indexGenerator = new IndexGenerator();

    // Initialize utility modules
    this.auditLogger = AuditLogger;
    this.eventBus = EventBus;
  }

  /**
   * Set up event listeners for the application
   */
  setupEventListeners() {
    // File upload events
    document.getElementById('clear-files').addEventListener('click', () => {
      this.clearAllFiles();
    });

    document.getElementById('process-files').addEventListener('click', () => {
      this.showProcessingOptions();
    });

    // Processing options events
    document.getElementById('validate-ocr').addEventListener('change', (e) => {
      this.state.settings.validateOCR = e.target.checked;
    });

    document.getElementById('merge-pdfs').addEventListener('change', (e) => {
      this.state.settings.mergePDFs = e.target.checked;
    });

    document.getElementById('ai-description').addEventListener('change', (e) => {
      this.state.settings.generateAIDescription = e.target.checked;
    });

    document.getElementById('generate-index').addEventListener('change', (e) => {
      this.state.settings.generateIndex = e.target.checked;
    });

    document.getElementById('start-processing').addEventListener('click', () => {
      this.startProcessing();
    });

    // Results tab events
    document.querySelectorAll('.results-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.switchResultsTab(e.target.dataset.tab);
      });
    });

    // Audit log events
    document.getElementById('clear-audit').addEventListener('click', () => {
      this.clearAuditLog();
    });

    document.getElementById('export-audit').addEventListener('click', () => {
      this.exportAuditLog();
    });

    document.getElementById('log-filter').addEventListener('change', (e) => {
      this.filterAuditLog(e.target.value);
    });

    // PDF viewer modal events
    document.getElementById('close-pdf-viewer').addEventListener('click', () => {
      this.closePDFViewer();
    });

    // Close modal on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closePDFViewer();
      }
    });

    // Mobile menu toggle
    const mobileMenuButton = document.querySelector('[aria-controls="mobile-menu"]');
    const mobileMenu = document.getElementById('mobile-menu');
    
    mobileMenuButton.addEventListener('click', () => {
      const expanded = mobileMenuButton.getAttribute('aria-expanded') === 'true';
      mobileMenuButton.setAttribute('aria-expanded', !expanded);
      mobileMenu.classList.toggle('hidden');
    });

    // Navigation smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }
      });
    });

    // Listen for custom events
    this.eventBus.on('file:preview', this.handleFilePreview.bind(this));
    this.eventBus.on('processing:complete', this.handleProcessingComplete.bind(this));
    this.eventBus.on('processing:error', this.handleProcessingError.bind(this));
    this.eventBus.on('toast:show', this.showToast.bind(this));
  }

  /**
   * Handle files selected from file upload
   * @param {File[]} files - Array of selected files
   */
  handleFilesSelected(files) {
    this.state.files = [...this.state.files, ...files];
    this.updateFileList();
    
    // Enable process button if we have files
    const processButton = document.getElementById('process-files');
    processButton.disabled = this.state.files.length === 0;
    
    Toast.success(`${files.length} file(s) added successfully`);
    
    this.auditLogger.info('Files selected', {
      count: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      fileNames: files.map(f => f.name),
    });
  }

  /**
   * Update the file list display
   */
  updateFileList() {
    const fileList = document.getElementById('file-list');
    const selectedFiles = document.getElementById('selected-files');
    
    if (this.state.files.length > 0) {
      fileList.classList.remove('hidden');
      
      selectedFiles.innerHTML = this.state.files.map((file, index) => `
        <li class="file-item" data-index="${index}">
          <div class="file-item-info">
            <svg class="file-item-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <div class="file-item-details">
              <div class="file-item-name">${file.name}</div>
              <div class="file-item-size">${this.formatFileSize(file.size)}</div>
            </div>
          </div>
          <div class="file-item-status">
            <button class="text-red-600 hover:text-red-700" onclick="app.removeFile(${index})">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
        </li>
      `).join('');
    } else {
      fileList.classList.add('hidden');
    }
  }

  /**
   * Remove a file from the list
   * @param {number} index - Index of file to remove
   */
  removeFile(index) {
    const removedFile = this.state.files[index];
    this.state.files.splice(index, 1);
    this.updateFileList();
    
    // Disable process button if no files
    const processButton = document.getElementById('process-files');
    processButton.disabled = this.state.files.length === 0;
    
    Toast.info(`Removed ${removedFile.name}`);
    
    this.auditLogger.info('File removed', {
      fileName: removedFile.name,
      remainingFiles: this.state.files.length,
    });
  }

  /**
   * Clear all files from the list
   */
  clearAllFiles() {
    if (this.state.files.length === 0) return;
    
    this.state.files = [];
    this.updateFileList();
    
    // Disable process button
    const processButton = document.getElementById('process-files');
    processButton.disabled = true;
    
    Toast.info('All files cleared');
    
    this.auditLogger.info('All files cleared');
  }

  /**
   * Show processing options section
   */
  showProcessingOptions() {
    document.getElementById('process').classList.remove('hidden');
    document.getElementById('process').scrollIntoView({ behavior: 'smooth' });
    
    this.auditLogger.info('Processing options shown');
  }

  /**
   * Start processing files
   */
  async startProcessing() {
    if (this.state.files.length === 0) {
      Toast.error('No files to process');
      return;
    }
    
    if (this.state.processing) {
      Toast.warning('Processing already in progress');
      return;
    }
    
    this.state.processing = true;
    
    // Show results section
    document.getElementById('results').classList.remove('hidden');
    document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
    
    // Start processing
    this.processingQueue.start(this.state.files.length);
    
    this.auditLogger.info('Processing started', {
      fileCount: this.state.files.length,
      settings: this.state.settings,
    });
    
    try {
      // Process files based on settings
      const results = await this.processFiles();
      
      // Handle results
      this.handleResults(results);
      
      Toast.success('Processing completed successfully');
      
    } catch (error) {
      console.error('Processing error:', error);
      Toast.error('Processing failed: ' + error.message);
      
      this.auditLogger.error('Processing failed', {
        error: error.message,
        stack: error.stack,
      });
      
    } finally {
      this.state.processing = false;
      this.processingQueue.complete();
    }
  }

  /**
   * Process all files based on settings
   * @returns {Promise<Object>} Processing results
   */
  async processFiles() {
    const results = {
      processed: [],
      excluded: [],
      merged: null,
      index: null,
    };
    
    for (let i = 0; i < this.state.files.length; i++) {
      const file = this.state.files[i];
      
      try {
        this.processingQueue.updateTask(`Processing ${file.name}...`, (i / this.state.files.length) * 100);
        
        // Check if file is PDF
        if (file.type !== 'application/pdf') {
          results.excluded.push({
            file,
            reason: 'Not a PDF file',
          });
          continue;
        }
        
        // Validate OCR if enabled
        if (this.state.settings.validateOCR) {
          const hasOCR = await this.ocrValidator.validate(file);
          if (!hasOCR) {
            results.excluded.push({
              file,
              reason: 'No searchable text content found',
            });
            continue;
          }
        }
        
        // Extract text content
        const textContent = await this.pdfProcessor.extractText(file);
        
        // Generate AI description if enabled
        let description = null;
        if (this.state.settings.generateAIDescription && textContent) {
          description = await this.aiDescriber.generateDescription(textContent);
        }
        
        results.processed.push({
          file,
          textContent,
          description,
          pageCount: await this.pdfProcessor.getPageCount(file),
        });
        
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        results.excluded.push({
          file,
          reason: error.message,
        });
      }
    }
    
    // Merge PDFs if enabled
    if (this.state.settings.mergePDFs && results.processed.length > 1) {
      this.processingQueue.updateTask('Merging PDFs...', 90);
      results.merged = await this.pdfProcessor.mergePDFs(
        results.processed.map(p => p.file)
      );
    }
    
    // Generate index if enabled
    if (this.state.settings.generateIndex && results.processed.length > 0) {
      this.processingQueue.updateTask('Generating index...', 95);
      results.index = await this.indexGenerator.generate(results.processed);
    }
    
    return results;
  }

  /**
   * Handle processing results
   * @param {Object} results - Processing results
   */
  handleResults(results) {
    this.state.processedFiles = results.processed;
    this.state.excludedFiles = results.excluded;
    
    // Display results
    this.resultsPanel.displayResults(results);
    
    // Show audit log
    document.getElementById('audit').classList.remove('hidden');
    
    this.auditLogger.info('Processing completed', {
      processedCount: results.processed.length,
      excludedCount: results.excluded.length,
      merged: !!results.merged,
      index: !!results.index,
    });
  }

  /**
   * Switch results tab
   * @param {string} tabName - Tab name to switch to
   */
  switchResultsTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.results-tab').forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active', 'border-blue-500', 'text-blue-600');
        tab.classList.remove('border-transparent', 'text-gray-500');
      } else {
        tab.classList.remove('active', 'border-blue-500', 'text-blue-600');
        tab.classList.add('border-transparent', 'text-gray-500');
      }
    });
    
    // Update tab content
    document.querySelectorAll('.results-tab-content').forEach(content => {
      content.classList.add('hidden');
    });
    
    const activeTab = document.getElementById(`${tabName}-tab`);
    if (activeTab) {
      activeTab.classList.remove('hidden');
    }
  }

  /**
   * Handle file preview request
   * @param {File} file - File to preview
   */
  handleFilePreview(file) {
    if (file.type === 'application/pdf') {
      this.pdfViewer.loadFile(file);
      document.getElementById('pdf-viewer-modal').classList.remove('hidden');
    } else {
      Toast.error('Preview only available for PDF files');
    }
  }

  /**
   * Close PDF viewer modal
   */
  closePDFViewer() {
    document.getElementById('pdf-viewer-modal').classList.add('hidden');
    this.pdfViewer.clear();
  }

  /**
   * Handle processing completion
   * @param {Object} data - Completion data
   */
  handleProcessingComplete(data) {
    this.eventBus.emit('results:update', data);
    Toast.success('Processing completed successfully');
  }

  /**
   * Handle processing error
   * @param {Error} error - Error object
   */
  handleProcessingError(error) {
    console.error('Processing error:', error);
    Toast.error('Processing failed: ' + error.message);
  }

  /**
   * Show toast notification
   * @param {string} message - Message to show
   * @param {string} type - Toast type (success, error, warning, info)
   */
  showToast(message, type = 'info') {
    Toast.show(message, type);
  }

  /**
   * Clear audit log
   */
  clearAuditLog() {
    if (confirm('Are you sure you want to clear the audit log?')) {
      this.auditLogger.clear();
      document.getElementById('audit-log-entries').innerHTML = '';
      Toast.info('Audit log cleared');
    }
  }

  /**
   * Export audit log
   */
  exportAuditLog() {
    const log = this.auditLogger.export();
    const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    Toast.success('Audit log exported');
  }

  /**
   * Filter audit log
   * @param {string} filter - Filter type
   */
  filterAuditLog(filter) {
    const entries = document.querySelectorAll('.audit-log-entry');
    entries.forEach(entry => {
      if (filter === 'all' || entry.classList.contains(filter)) {
        entry.style.display = 'block';
      } else {
        entry.style.display = 'none';
      }
    });
  }

  /**
   * Format file size in human readable format
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get current application state
   * @returns {Object} Current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Update application settings
   * @param {Object} settings - New settings
   */
  updateSettings(settings) {
    this.state.settings = { ...this.state.settings, ...settings };
    this.auditLogger.info('Settings updated', { settings: this.state.settings });
  }
}

/**
 * Initialize application when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
  // Create global app instance
  window.app = new App();
  
  // Log successful initialization
  console.log(`${__APP_NAME__} v${__APP_VERSION__} initialized successfully`);
  
  // Add global error handler
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    AuditLogger.error('Global error', {
      message: event.message,
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
      error: event.error,
    });
  });
  
  // Add unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    AuditLogger.error('Unhandled promise rejection', {
      reason: event.reason,
    });
  });
});

// Export app instance for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = App;
}