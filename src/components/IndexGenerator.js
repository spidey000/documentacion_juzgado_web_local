/**
 * IndexGenerator Component
 * 
 * Handles document index generation with various formatting options.
 * This component provides a UI for generating and exporting document indexes.
 * 
 * @version 1.0.0
 */

import { eventBus } from '../utils/eventBus.js';
import { auditLogger } from '../utils/auditLogger.js';
import { IndexGenerator as CoreIndexGenerator } from '../core/indexGenerator.js';
import { toast } from '../utils/toast.js';

/**
 * IndexGenerator Component Class
 */
export class IndexGenerator {
  /**
   * Constructor
   * @param {Object} options - Component options
   */
  constructor(options = {}) {
    this.id = options.id || 'index-generator-' + Date.now();
    this.container = options.container || document.body;
    this.files = options.files || [];
    this.descriptions = options.descriptions || {};
    this.config = {
      indexType: 'simple',
      numberingScheme: 'continuous',
      includeDescriptions: true,
      ...options.config
    };
    
    // Initialize core index generator
    this.coreGenerator = new CoreIndexGenerator();
    
    // Component state
    this.state = {
      isGenerating: false,
      progress: 0,
      generatedIndex: null,
      error: null
    };
    
    // UI elements
    this.elements = {};
    
    // Initialize component
    this.init();
  }

  /**
   * Initialize the component
   */
  init() {
    // Create component UI
    this.render();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Log initialization
    auditLogger.info('IndexGenerator component initialized', {
      componentId: this.id,
      fileCount: this.files.length
    });
  }

  /**
   * Render the component UI
   */
  render() {
    const component = document.createElement('div');
    component.id = this.id;
    component.className = 'index-generator-component bg-white rounded-lg shadow-md p-6';
    
    component.innerHTML = `
      <div class="component-header mb-6">
        <h2 class="text-2xl font-bold text-gray-800 mb-2">Document Index Generator</h2>
        <p class="text-gray-600">Generate and export document indexes in various formats</p>
      </div>

      <!-- Configuration Section -->
      <div class="configuration-section mb-6">
        <h3 class="text-lg font-semibold text-gray-700 mb-4">Index Configuration</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <!-- Index Type -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Index Type</label>
            <select id="${this.id}-index-type" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="simple">Simple List</option>
              <option value="detailed">Detailed List</option>
              <option value="hierarchical">Hierarchical Index</option>
            </select>
          </div>

          <!-- Numbering Scheme -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Page Numbering</label>
            <select id="${this.id}-numbering-scheme" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="continuous">Continuous</option>
              <option value="document">Document-specific</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <!-- Include Descriptions -->
          <div class="flex items-center">
            <input type="checkbox" id="${this.id}-include-descriptions" class="mr-2" checked>
            <label for="${this.id}-include-descriptions" class="text-sm font-medium text-gray-700">
              Include Descriptions
            </label>
          </div>
        </div>

        <!-- Files Info -->
        <div class="mt-4 p-4 bg-gray-50 rounded-md">
          <p class="text-sm text-gray-600">
            <span class="font-medium">${this.files.length}</span> files selected for index generation
          </p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="action-section mb-6">
        <div class="flex flex-wrap gap-3">
          <button id="${this.id}-generate-btn" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
            Generate Index
          </button>
          
          <div id="${this.id}-export-section" class="hidden flex flex-wrap gap-2">
            <button data-format="text" class="export-btn px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500">
              Export as Text
            </button>
            <button data-format="html" class="export-btn px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500">
              Export as HTML
            </button>
            <button data-format="pdf" class="export-btn px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500">
              Export as PDF
            </button>
            <button data-format="json" class="export-btn px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500">
              Export as JSON
            </button>
            <button data-format="markdown" class="export-btn px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              Export as Markdown
            </button>
          </div>
        </div>
      </div>

      <!-- Progress Indicator -->
      <div id="${this.id}-progress" class="hidden mb-6">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-gray-700">Generating Index...</span>
          <span id="${this.id}-progress-text" class="text-sm text-gray-600">0%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div id="${this.id}-progress-bar" class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
        </div>
      </div>

      <!-- Error Display -->
      <div id="${this.id}-error" class="hidden mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-800">Error</h3>
            <div id="${this.id}-error-message" class="mt-2 text-sm text-red-700"></div>
          </div>
        </div>
      </div>

      <!-- Preview Section -->
      <div id="${this.id}-preview" class="hidden">
        <h3 class="text-lg font-semibold text-gray-700 mb-4">Index Preview</h3>
        <div class="border border-gray-200 rounded-md p-4 max-h-96 overflow-y-auto bg-gray-50">
          <pre id="${this.id}-preview-content" class="text-sm whitespace-pre-wrap"></pre>
        </div>
      </div>
    `;

    // Add to container
    this.container.appendChild(component);

    // Store element references
    this.elements = {
      component,
      indexType: document.getElementById(`${this.id}-index-type`),
      numberingScheme: document.getElementById(`${this.id}-numbering-scheme`),
      includeDescriptions: document.getElementById(`${this.id}-include-descriptions`),
      generateBtn: document.getElementById(`${this.id}-generate-btn`),
      exportSection: document.getElementById(`${this.id}-export-section`),
      progress: document.getElementById(`${this.id}-progress`),
      progressBar: document.getElementById(`${this.id}-progress-bar`),
      progressText: document.getElementById(`${this.id}-progress-text`),
      error: document.getElementById(`${this.id}-error`),
      errorMessage: document.getElementById(`${this.id}-error-message`),
      preview: document.getElementById(`${this.id}-preview`),
      previewContent: document.getElementById(`${this.id}-preview-content`)
    };
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Generate button
    this.elements.generateBtn.addEventListener('click', () => this.generateIndex());

    // Configuration changes
    this.elements.indexType.addEventListener('change', () => this.updateConfig());
    this.elements.numberingScheme.addEventListener('change', () => this.updateConfig());
    this.elements.includeDescriptions.addEventListener('change', () => this.updateConfig());

    // Export buttons
    this.elements.exportSection.addEventListener('click', (e) => {
      if (e.target.classList.contains('export-btn')) {
        const format = e.target.dataset.format;
        this.exportIndex(format);
      }
    });

    // Event bus subscriptions
    eventBus
      .on('filesUpdated', (data) => this.handleFilesUpdated(data))
      .on('descriptionsUpdated', (data) => this.handleDescriptionsUpdated(data));
  }

  /**
   * Update configuration from UI
   */
  updateConfig() {
    this.config = {
      indexType: this.elements.indexType.value,
      numberingScheme: this.elements.numberingScheme.value,
      includeDescriptions: this.elements.includeDescriptions.checked
    };

    auditLogger.info('IndexGenerator configuration updated', this.config);
  }

  /**
   * Generate document index
   */
  async generateIndex() {
    if (this.state.isGenerating) return;
    if (this.files.length === 0) {
      toast.error('No files selected for index generation');
      return;
    }

    try {
      // Update state
      this.state.isGenerating = true;
      this.state.error = null;
      
      // Update UI
      this.elements.generateBtn.disabled = true;
      this.elements.generateBtn.textContent = 'Generating...';
      this.showProgress();
      this.hideError();
      this.hideExportSection();
      this.hidePreview();

      // Emit start event
      eventBus.emit('indexGenerationStarted', {
        fileCount: this.files.length,
        config: this.config
      });

      // Simulate progress (in real app, this would be based on actual progress)
      await this.simulateProgress();

      // Generate index using core generator
      const indexData = await this.coreGenerator.generateDocumentIndex(
        this.files,
        this.descriptions,
        this.config
      );

      // Store generated index
      this.state.generatedIndex = indexData;

      // Update UI
      this.hideProgress();
      this.showExportSection();
      this.showPreview(indexData);

      // Emit completion event
      eventBus.emit('indexGenerated', {
        indexData,
        fileCount: this.files.length
      });

      // Log success
      auditLogger.success('Document index generated successfully', {
        fileCount: this.files.length,
        indexType: this.config.indexType,
        totalEntries: indexData.index.length
      });

      toast.success('Index generated successfully!');

    } catch (error) {
      console.error('Error generating index:', error);
      
      // Update state
      this.state.error = error.message;
      
      // Update UI
      this.hideProgress();
      this.showError(error.message);

      // Emit error event
      eventBus.emit('indexError', {
        error: error.message,
        config: this.config
      });

      // Log error
      auditLogger.error('Failed to generate document index', {
        error: error.message,
        config: this.config
      });

      toast.error('Failed to generate index: ' + error.message);

    } finally {
      // Reset state
      this.state.isGenerating = false;
      this.elements.generateBtn.disabled = false;
      this.elements.generateBtn.textContent = 'Generate Index';
    }
  }

  /**
   * Simulate progress for better UX
   */
  simulateProgress() {
    return new Promise(resolve => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          resolve();
        }
        this.updateProgress(progress);
        
        // Emit progress event
        eventBus.emit('indexGenerationProgress', {
          progress: Math.round(progress),
          fileCount: this.files.length
        });
      }, 100);
    });
  }

  /**
   * Update progress indicator
   * @param {number} percent - Progress percentage
   */
  updateProgress(percent) {
    this.elements.progressBar.style.width = `${percent}%`;
    this.elements.progressText.textContent = `${Math.round(percent)}%`;
  }

  /**
   * Export index in specified format
   * @param {string} format - Export format
   */
  async exportIndex(format) {
    if (!this.state.generatedIndex) {
      toast.error('No index to export');
      return;
    }

    try {
      // Show loading state
      const exportBtn = this.elements.exportSection.querySelector(`[data-format="${format}"]`);
      const originalText = exportBtn.textContent;
      exportBtn.disabled = true;
      exportBtn.textContent = 'Exporting...';

      // Export using core generator
      const exportedContent = await this.coreGenerator.exportDocumentIndex(
        this.state.generatedIndex,
        format
      );

      // Create download
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `document-index-${timestamp}.${format === 'markdown' ? 'md' : format}`;
      
      if (format === 'pdf' && exportedContent instanceof Blob) {
        // Handle PDF blob
        this.downloadBlob(exportedContent, filename);
      } else {
        // Handle text content
        this.downloadText(exportedContent, filename);
      }

      // Log success
      auditLogger.success('Index exported successfully', {
        format,
        filename,
        indexType: this.state.generatedIndex.type
      });

      toast.success(`Index exported as ${format.toUpperCase()}!`);

    } catch (error) {
      console.error('Error exporting index:', error);
      
      // Log error
      auditLogger.error('Failed to export index', {
        format,
        error: error.message
      });

      toast.error(`Failed to export as ${format.toUpperCase()}: ${error.message}`);

    } finally {
      // Reset button state
      const exportBtn = this.elements.exportSection.querySelector(`[data-format="${format}"]`);
      exportBtn.disabled = false;
      exportBtn.textContent = originalText;
    }
  }

  /**
   * Download text content as file
   * @param {string} content - Content to download
   * @param {string} filename - File name
   */
  downloadText(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    this.downloadBlob(blob, filename);
  }

  /**
   * Download blob as file
   * @param {Blob} blob - Blob to download
   * @param {string} filename - File name
   */
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Show progress indicator
   */
  showProgress() {
    this.elements.progress.classList.remove('hidden');
    this.updateProgress(0);
  }

  /**
   * Hide progress indicator
   */
  hideProgress() {
    this.elements.progress.classList.add('hidden');
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    this.elements.errorMessage.textContent = message;
    this.elements.error.classList.remove('hidden');
  }

  /**
   * Hide error message
   */
  hideError() {
    this.elements.error.classList.add('hidden');
  }

  /**
   * Show export section
   */
  showExportSection() {
    this.elements.exportSection.classList.remove('hidden');
  }

  /**
   * Hide export section
   */
  hideExportSection() {
    this.elements.exportSection.classList.add('hidden');
  }

  /**
   * Show preview
   * @param {Object} indexData - Index data to preview
   */
  showPreview(indexData) {
    // Generate text preview
    const preview = this.coreGenerator.exportIndexAsText(
      indexData.index,
      indexData.metadata
    );
    
    this.elements.previewContent.textContent = preview;
    this.elements.preview.classList.remove('hidden');
  }

  /**
   * Hide preview
   */
  hidePreview() {
    this.elements.preview.classList.add('hidden');
  }

  /**
   * Handle files updated event
   * @param {Object} data - Event data
   */
  handleFilesUpdated(data) {
    this.files = data.files || [];
    
    // Update UI
    const filesInfo = this.elements.component.querySelector('.bg-gray-50 p-4');
    if (filesInfo) {
      filesInfo.innerHTML = `
        <p class="text-sm text-gray-600">
          <span class="font-medium">${this.files.length}</span> files selected for index generation
        </p>
      `;
    }
  }

  /**
   * Handle descriptions updated event
   * @param {Object} data - Event data
   */
  handleDescriptionsUpdated(data) {
    this.descriptions = data.descriptions || {};
  }

  /**
   * Update files for index generation
   * @param {Array} files - Array of file objects
   */
  setFiles(files) {
    this.files = files;
    this.handleFilesUpdated({ files });
  }

  /**
   * Update descriptions for index generation
   * @param {Object} descriptions - Descriptions mapping
   */
  setDescriptions(descriptions) {
    this.descriptions = descriptions;
    this.handleDescriptionsUpdated({ descriptions });
  }

  /**
   * Destroy the component
   */
  destroy() {
    // Remove from DOM
    if (this.elements.component && this.elements.component.parentNode) {
      this.elements.component.parentNode.removeChild(this.elements.component);
    }

    // Log destruction
    auditLogger.info('IndexGenerator component destroyed', {
      componentId: this.id
    });
  }
}

// Export default
export default IndexGenerator;