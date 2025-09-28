/**
 * DocumentManager Component
 * 
 * Main orchestrator for the PDF document management system.
 * Coordinates between all components and manages the overall workflow.
 * 
 * @version 1.0.0
 */

import { eventBus } from '../utils/eventBus.js';
import { auditLogger } from '../utils/auditLogger.js';
import { Toast } from '../utils/toast.js';

/**
 * DocumentManager Class
 * Manages the complete document workflow from upload to index generation
 */
export class DocumentManager {
  /**
   * Create a new DocumentManager instance
   * @param {string} containerId - Container element ID
   * @param {Object} options - Configuration options
   */
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.options = {
      maxFileSize: options.maxFileSize || 50 * 1024 * 1024, // 50MB
      allowedTypes: options.allowedTypes || ['application/pdf'],
      ...options
    };

    // State management
    this.state = {
      files: {
        uploaded: [],
        selected: [],
        processing: [],
        processed: [],
        order: []
      },
      indexGeneration: {
        descriptionType: 'filename', // 'filename', 'ai', 'custom'
        formatting: {
          includePageNumbers: true,
          hierarchy: true,
          customFormat: null
        },
        currentConfig: null
      },
      pdfMerge: {
        selectedFiles: [],
        mergeOptions: {
          maintainPageNumbering: true,
          generateTOC: true,
          customTOCTitle: 'Table of Contents'
        },
        mergeOrder: []
      },
      ui: {
        activeTab: 'upload',
        previewVisible: false,
        processing: false,
        progress: 0
      }
    };

    // Component references
    this.components = {
      fileUpload: null,
      pdfViewer: null,
      processingQueue: null,
      resultsPanel: null
    };

    // Initialize
    this.init();
  }

  /**
   * Initialize the DocumentManager
   */
  init() {
    // Get container element
    this.container = document.getElementById(this.containerId);
    if (!this.container) {
      throw new Error(`Container element with ID '${this.containerId}' not found`);
    }

    // Render main UI
    this.render();

    // Set up event listeners
    this.setupEventListeners();

    // Log initialization
    auditLogger.info('DocumentManager initialized', {
      containerId: this.containerId,
      options: this.options
    });
  }

  /**
   * Render the main UI
   */
  render() {
    this.container.innerHTML = `
      <div class="document-manager">
        <!-- Header -->
        <header class="bg-white shadow-sm border-b border-gray-200">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center py-4">
              <h1 class="text-2xl font-bold text-gray-900">PDF Document Management System</h1>
              <div class="flex space-x-4">
                <button id="create-sumario-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200 ease-in-out transform hover:scale-105">
                  CREAR SUMARIO
                </button>
              </div>
            </div>
          </div>
        </header>

        <!-- Main Content -->
        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <!-- Tabs -->
          <div class="border-b border-gray-200 mb-6">
            <nav class="-mb-px flex space-x-8">
              <button class="tab-button active" data-tab="upload">
                <span>Upload Files</span>
              </button>
              <button class="tab-button" data-tab="organize">
                <span>Organize</span>
              </button>
              <button class="tab-button" data-tab="index">
                <span>Generate Index</span>
              </button>
              <button class="tab-button" data-tab="merge">
                <span>Merge PDFs</span>
              </button>
              <button class="tab-button" data-tab="results">
                <span>Results</span>
              </button>
            </nav>
          </div>

          <!-- Tab Content -->
          <div class="tab-content">
            <!-- Upload Tab -->
            <div id="upload-tab" class="tab-panel active">
              <div id="file-upload-container"></div>
            </div>

            <!-- Organize Tab -->
            <div id="organize-tab" class="tab-panel hidden">
              <div class="bg-white rounded-lg shadow p-6">
                <h2 class="text-lg font-semibold mb-4">Organize Files</h2>
                <div id="file-organizer-container"></div>
              </div>
            </div>

            <!-- Index Tab -->
            <div id="index-tab" class="tab-panel hidden">
              <div class="bg-white rounded-lg shadow p-6">
                <h2 class="text-lg font-semibold mb-4">Generate Document Index</h2>
                <div id="index-generator-container"></div>
              </div>
            </div>

            <!-- Merge Tab -->
            <div id="merge-tab" class="tab-panel hidden">
              <div class="bg-white rounded-lg shadow p-6">
                <h2 class="text-lg font-semibold mb-4">Merge PDF Files</h2>
                <div id="pdf-merger-container"></div>
              </div>
            </div>

            <!-- Results Tab -->
            <div id="results-tab" class="tab-panel hidden">
              <div id="results-panel-container"></div>
            </div>
          </div>

          <!-- Processing Queue -->
          <div class="mt-8">
            <div id="processing-queue-container"></div>
          </div>

          <!-- PDF Viewer -->
          <div id="pdf-viewer-container" class="mt-8"></div>
        </main>
      </div>
    `;

    // Initialize child components
    this.initializeComponents();
  }

  /**
   * Initialize child components
   */
  initializeComponents() {
    // These will be initialized when the respective components are created
    // For now, we'll set up event listeners for the CREAR SUMARIO button
    const createSumarioBtn = document.getElementById('create-sumario-btn');
    if (createSumarioBtn) {
      createSumarioBtn.addEventListener('click', () => this.createSumario());
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Tab switching
    const tabButtons = this.container.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const tabName = e.currentTarget.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // Event bus listeners
    eventBus
      .on('files-selected', this.handleFileUpload.bind(this))
      .on('file-processing-complete', this.handleFileProcessingComplete.bind(this))
      .on('files-reordered', this.handleFilesReordered.bind(this))
      .on('index-generation-requested', this.handleIndexGenerationRequested.bind(this))
      .on('pdf-merge-requested', this.handlePDFMergeRequested.bind(this))
      .on('error', this.handleError.bind(this));
  }

  /**
   * Switch between tabs
   * @param {string} tabName - Name of the tab to switch to
   */
  switchTab(tabName) {
    // Update active tab button
    this.container.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    this.container.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update active tab panel
    this.container.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.add('hidden');
      panel.classList.remove('active');
    });
    this.container.getElementById(`${tabName}-tab`).classList.remove('hidden');
    this.container.getElementById(`${tabName}-tab`).classList.add('active');

    // Update state
    this.state.ui.activeTab = tabName;

    // Log tab switch
    auditLogger.info('Tab switched', { tabName });
  }

  /**
   * Handle file upload
   * @param {Object} data - Event data
   */
  async handleFileUpload(data) {
    const { files } = data;

    try {
      // Validate files
      const validFiles = this.validateFiles(files);
      
      if (validFiles.length === 0) {
        Toast.error('No valid PDF files found');
        return;
      }

      // Add files to state
      this.state.files.uploaded = [...this.state.files.uploaded, ...validFiles];
      this.state.files.selected = validFiles.map(f => f.id);

      // Update UI
      this.updateFileList();

      // Show success message
      Toast.success(`${validFiles.length} file(s) uploaded successfully`);

      // Log upload
      auditLogger.info('Files uploaded', {
        count: validFiles.length,
        files: validFiles.map(f => ({ name: f.name, size: f.size }))
      });

      // Switch to organize tab
      this.switchTab('organize');

    } catch (error) {
      this.handleError({
        type: 'FileUploadError',
        message: error.message,
        context: 'handleFileUpload'
      });
    }
  }

  /**
   * Validate uploaded files
   * @param {FileList} files - Files to validate
   * @returns {Array} Valid files
   */
  validateFiles(files) {
    const validFiles = [];

    for (const file of files) {
      // Check file type
      if (!this.options.allowedTypes.includes(file.type)) {
        Toast.warning(`Skipping ${file.name}: Not a PDF file`);
        continue;
      }

      // Check file size
      if (file.size > this.options.maxFileSize) {
        Toast.warning(`Skipping ${file.name}: File too large`);
        continue;
      }

      // Create file object with metadata
      const fileObj = {
        id: this.generateFileId(),
        file: file,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        status: 'uploaded'
      };

      validFiles.push(fileObj);
    }

    return validFiles;
  }

  /**
   * Generate unique file ID
   * @returns {string} Unique ID
   */
  generateFileId() {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update file list UI
   */
  updateFileList() {
    // This will be implemented when FileOrganizer component is created
    eventBus.emit('files-updated', {
      files: this.state.files.uploaded,
      selected: this.state.files.selected
    });
  }

  /**
   * Handle file processing complete
   * @param {Object} data - Event data
   */
  handleFileProcessingComplete(data) {
    const { fileId, result } = data;

    // Update file status
    const fileIndex = this.state.files.uploaded.findIndex(f => f.id === fileId);
    if (fileIndex !== -1) {
      this.state.files.uploaded[fileIndex].status = 'processed';
      this.state.files.uploaded[fileIndex].processedAt = new Date().toISOString();
      this.state.files.uploaded[fileIndex].result = result;

      // Move to processed array
      this.state.files.processed.push(this.state.files.uploaded[fileIndex]);
    }

    // Update progress
    this.updateProcessingProgress();

    // Check if all files are processed
    if (this.state.files.processing.length === 0) {
      this.state.ui.processing = false;
      Toast.success('All files processed successfully');
    }
  }

  /**
   * Handle files reordered
   * @param {Object} data - Event data
   */
  handleFilesReordered(data) {
    const { newOrder } = data;
    this.state.files.order = newOrder;
    
    // Log reordering
    auditLogger.info('Files reordered', { newOrder });
  }

  /**
   * Handle index generation requested
   * @param {Object} data - Event data
   */
  async handleIndexGenerationRequested(data) {
    const { files, options } = data;

    try {
      this.state.ui.processing = true;
      this.state.indexGeneration.currentConfig = options;

      // Emit start event
      eventBus.emit('index-generation-started', { files, options });

      // Process files and generate index
      const indexData = await this.generateIndex(files, options);

      // Emit completion event
      eventBus.emit('index-generation-completed', { indexData });

      // Show results
      this.switchTab('results');

      // Log success
      auditLogger.success('Index generation completed', {
        fileCount: files.length,
        options
      });

    } catch (error) {
      eventBus.emit('index-generation-error', { error: error.message });
      this.handleError({
        type: 'IndexGenerationError',
        message: error.message,
        context: 'handleIndexGenerationRequested'
      });
    } finally {
      this.state.ui.processing = false;
    }
  }

  /**
   * Handle PDF merge requested
   * @param {Object} data - Event data
   */
  async handlePDFMergeRequested(data) {
    const { files, options } = data;

    try {
      this.state.ui.processing = true;

      // Emit start event
      eventBus.emit('pdf-merge-started', { files, options });

      // Merge PDFs
      const mergedPDF = await this.mergePDFs(files, options);

      // Emit completion event
      eventBus.emit('pdf-merge-completed', { mergedPDF });

      // Show results
      this.switchTab('results');

      // Log success
      auditLogger.success('PDF merge completed', {
        fileCount: files.length,
        options
      });

    } catch (error) {
      eventBus.emit('pdf-merge-error', { error: error.message });
      this.handleError({
        type: 'PDFMergeError',
        message: error.message,
        context: 'handlePDFMergeRequested'
      });
    } finally {
      this.state.ui.processing = false;
    }
  }

  /**
   * Handle errors
   * @param {Object} errorData - Error data
   */
  handleError(errorData) {
    const { type, message, context, recoverable = true } = errorData;

    // Log error
    auditLogger.error(`Error in ${context}`, {
      type,
      message,
      context,
      recoverable
    });

    // Show user-friendly message
    Toast.error(message, 5000);

    // Reset processing state if needed
    if (this.state.ui.processing) {
      this.state.ui.processing = false;
      this.state.ui.progress = 0;
    }
  }

  /**
   * Main workflow for "CREAR SUMARIO" button
   */
  async createSumario() {
    try {
      // Check if we have files
      if (this.state.files.uploaded.length === 0) {
        Toast.warning('Please upload files first');
        this.switchTab('upload');
        return;
      }

      // Log workflow start
      auditLogger.info('CREAR SUMARIO workflow started', {
        fileCount: this.state.files.uploaded.length
      });

      // Switch to index tab
      this.switchTab('index');

      // Auto-start index generation with default settings
      await this.handleIndexGenerationRequested({
        files: this.state.files.uploaded,
        options: {
          descriptionType: this.state.indexGeneration.descriptionType,
          formatting: this.state.indexGeneration.formatting
        }
      });

    } catch (error) {
      this.handleError({
        type: 'WorkflowError',
        message: 'Failed to create sumario',
        context: 'createSumario',
        cause: error
      });
    }
  }

  /**
   * Generate document index
   * @param {Array} files - Files to index
   * @param {Object} options - Index generation options
   * @returns {Promise<Object>} Generated index data
   */
  async generateIndex(files, options) {
    const indexData = {
      title: 'Document Index',
      generatedAt: new Date().toISOString(),
      entries: [],
      options
    };

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const progress = ((i + 1) / files.length) * 100;

      // Update progress
      this.state.ui.progress = progress;
      eventBus.emit('index-generation-progress', {
        fileId: file.id,
        progress,
        currentFile: file.name
      });

      // Generate description based on type
      let description = '';
      switch (options.descriptionType) {
        case 'filename':
          description = file.name.replace('.pdf', '');
          break;
        case 'ai':
          // This will use the AI describer when implemented
          description = await this.generateAIDescription(file);
          break;
        case 'custom':
          description = file.customDescription || file.name.replace('.pdf', '');
          break;
      }

      // Add entry
      indexData.entries.push({
        fileId: file.id,
        fileName: file.name,
        description,
        pageNumber: file.startPage || 1,
        pageCount: file.pageCount || 1
      });

      // Small delay to prevent UI blocking
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    return indexData;
  }

  /**
   * Generate AI description for a file
   * @param {Object} file - File object
   * @returns {Promise<string>} AI-generated description
   */
  async generateAIDescription(file) {
    // This will be implemented when integrating with AI describer
    // For now, return filename as fallback
    return file.name.replace('.pdf', '');
  }

  /**
   * Merge PDF files
   * @param {Array} files - Files to merge
   * @param {Object} options - Merge options
   * @returns {Promise<Blob>} Merged PDF blob
   */
  async mergePDFs(files, options) {
    // This will be implemented when PDFMerger component is created
    // For now, return a mock blob
    return new Blob(['Mock merged PDF'], { type: 'application/pdf' });
  }

  /**
   * Organize files
   * @param {string} criteria - Sorting criteria
   */
  organizeFiles(criteria) {
    const sortedFiles = [...this.state.files.uploaded];

    switch (criteria) {
      case 'filename':
        sortedFiles.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'date':
        sortedFiles.sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt));
        break;
      case 'size':
        sortedFiles.sort((a, b) => a.size - b.size);
        break;
    }

    this.state.files.uploaded = sortedFiles;
    this.updateFileList();

    // Log organization
    auditLogger.info('Files organized', { criteria });
  }

  /**
   * Update processing progress
   */
  updateProcessingProgress() {
    eventBus.emit('processing-progress-updated', {
      progress: this.state.ui.progress,
      processing: this.state.files.processing.length,
      total: this.state.files.uploaded.length
    });
  }

  /**
   * Get current state
   * @returns {Object} Current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Reset all state
   */
  reset() {
    this.state = {
      files: {
        uploaded: [],
        selected: [],
        processing: [],
        processed: [],
        order: []
      },
      indexGeneration: {
        descriptionType: 'filename',
        formatting: {
          includePageNumbers: true,
          hierarchy: true,
          customFormat: null
        },
        currentConfig: null
      },
      pdfMerge: {
        selectedFiles: [],
        mergeOptions: {
          maintainPageNumbering: true,
          generateTOC: true,
          customTOCTitle: 'Table of Contents'
        },
        mergeOrder: []
      },
      ui: {
        activeTab: 'upload',
        previewVisible: false,
        processing: false,
        progress: 0
      }
    };

    // Switch to upload tab
    this.switchTab('upload');

    // Log reset
    auditLogger.info('DocumentManager state reset');
  }

  /**
   * Clean up resources
   */
  destroy() {
    // Remove event listeners
    eventBus.off('files-selected');
    eventBus.off('file-processing-complete');
    eventBus.off('files-reordered');
    eventBus.off('index-generation-requested');
    eventBus.off('pdf-merge-requested');
    eventBus.off('error');

    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
    }

    // Log destruction
    auditLogger.info('DocumentManager destroyed');
  }
}

// Export default
export default DocumentManager;