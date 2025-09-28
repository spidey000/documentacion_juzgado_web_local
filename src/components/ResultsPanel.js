import { eventBus } from '../utils/eventBus.js';
import { showToast } from '../utils/toast.js';
import { auditLogger } from '../utils/auditLogger.js';

/**
 * ResultsPanel Component
 * Displays processing results with tabbed interface, file lists, and export options
 */
export class ResultsPanel {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container with id "${containerId}" not found`);
    }

    // Default options
    this.options = {
      showFileSize: true,
      showProcessingTime: true,
      maxItemsPerTab: 50,
      exportFormats: ['json', 'csv', 'pdf'],
      ...options
    };

    this.results = {
      processed: [],
      excluded: [],
      errors: [],
      summary: {
        totalFiles: 0,
        processedFiles: 0,
        excludedFiles: 0,
        errorFiles: 0,
        totalSize: 0,
        processingTime: 0
      }
    };

    this.activeTab = 'processed';
    this.sortBy = 'name';
    this.sortOrder = 'asc';

    this.init();
  }

  /**
   * Initialize the component
   */
  init() {
    this.render();
    this.attachEventListeners();
    this.setupEventBusListeners();
  }

  /**
   * Render the component HTML
   */
  render() {
    this.container.innerHTML = `
      <div class="results-panel-container" role="region" aria-label="Results panel">
        <!-- Header -->
        <div class="results-header bg-white border-b border-gray-200 px-6 py-4">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold text-gray-900">Processing Results</h2>
            <div class="header-actions flex items-center space-x-3">
              <!-- Sort Dropdown -->
              <div class="sort-dropdown relative">
                <select 
                  class="sort-select appearance-none bg-white border border-gray-300 rounded-md px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Sort results"
                >
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                  <option value="size-asc">Size (Smallest)</option>
                  <option value="size-desc">Size (Largest)</option>
                  <option value="date-asc">Date (Oldest)</option>
                  <option value="date-desc">Date (Newest)</option>
                </select>
                <svg class="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </div>

              <!-- Export Button -->
              <div class="export-dropdown relative">
                <button 
                  class="export-btn flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Export results"
                  aria-expanded="false"
                >
                  <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                  Export
                  <svg class="w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                </button>
                <div class="export-menu hidden absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                  ${this.options.exportFormats.map(format => `
                    <button 
                      class="export-option block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      data-format="${format}"
                    >
                      Export as ${format.toUpperCase()}
                    </button>
                  `).join('')}
                </div>
              </div>

              <!-- Clear Results Button -->
              <button 
                class="clear-btn px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Clear all results"
              >
                Clear
              </button>
            </div>
          </div>

          <!-- Summary Stats -->
          <div class="summary-stats mt-4 grid grid-cols-2 md:grid-cols-5 gap-4">
            <div class="stat-card bg-gray-50 rounded-lg p-3">
              <div class="stat-value text-2xl font-bold text-gray-900 total-files">0</div>
              <div class="stat-label text-sm text-gray-600">Total Files</div>
            </div>
            <div class="stat-card bg-green-50 rounded-lg p-3">
              <div class="stat-value text-2xl font-bold text-green-600 processed-files">0</div>
              <div class="stat-label text-sm text-gray-600">Processed</div>
            </div>
            <div class="stat-card bg-yellow-50 rounded-lg p-3">
              <div class="stat-value text-2xl font-bold text-yellow-600 excluded-files">0</div>
              <div class="stat-label text-sm text-gray-600">Excluded</div>
            </div>
            <div class="stat-card bg-red-50 rounded-lg p-3">
              <div class="stat-value text-2xl font-bold text-red-600 error-files">0</div>
              <div class="stat-label text-sm text-gray-600">Errors</div>
            </div>
            <div class="stat-card bg-blue-50 rounded-lg p-3">
              <div class="stat-value text-2xl font-bold text-blue-600 processing-time">0s</div>
              <div class="stat-label text-sm text-gray-600">Time</div>
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="results-tabs bg-white border-b border-gray-200">
          <nav class="flex -mb-px" aria-label="Results tabs">
            <button 
              class="tab-btn px-6 py-3 text-sm font-medium text-blue-600 border-b-2 border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-tab="processed"
              aria-selected="true"
              aria-controls="processed-panel"
            >
              Processed
              <span class="tab-count ml-2 bg-blue-100 text-blue-600 py-0.5 px-2 rounded-full text-xs">0</span>
            </button>
            <button 
              class="tab-btn px-6 py-3 text-sm font-medium text-gray-500 border-b-2 border-transparent hover:text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-tab="excluded"
              aria-selected="false"
              aria-controls="excluded-panel"
            >
              Excluded
              <span class="tab-count ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">0</span>
            </button>
            <button 
              class="tab-btn px-6 py-3 text-sm font-medium text-gray-500 border-b-2 border-transparent hover:text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-tab="errors"
              aria-selected="false"
              aria-controls="errors-panel"
            >
              Errors
              <span class="tab-count ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">0</span>
            </button>
          </nav>
        </div>

        <!-- Tab Panels -->
        <div class="results-content bg-gray-50">
          <!-- Processed Tab -->
          <div id="processed-panel" class="tab-panel p-6" role="tabpanel" aria-labelledby="processed-tab">
            <div class="tab-content">
              <!-- Processed files will be rendered here -->
            </div>
          </div>

          <!-- Excluded Tab -->
          <div id="excluded-panel" class="tab-panel hidden p-6" role="tabpanel" aria-labelledby="excluded-tab">
            <div class="tab-content">
              <!-- Excluded files will be rendered here -->
            </div>
          </div>

          <!-- Errors Tab -->
          <div id="errors-panel" class="tab-panel hidden p-6" role="tabpanel" aria-labelledby="errors-tab">
            <div class="tab-content">
              <!-- Error files will be rendered here -->
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
    // Tab switching
    this.container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Sort dropdown
    this.container.querySelector('.sort-select').addEventListener('change', (e) => {
      const [sortBy, sortOrder] = e.target.value.split('-');
      this.setSort(sortBy, sortOrder);
    });

    // Export dropdown
    const exportBtn = this.container.querySelector('.export-btn');
    const exportMenu = this.container.querySelector('.export-menu');
    
    exportBtn.addEventListener('click', () => {
      exportMenu.classList.toggle('hidden');
      exportBtn.setAttribute('aria-expanded', !exportMenu.classList.contains('hidden'));
    });

    // Export options
    this.container.querySelectorAll('.export-option').forEach(option => {
      option.addEventListener('click', (e) => {
        this.exportResults(e.target.dataset.format);
        exportMenu.classList.add('hidden');
        exportBtn.setAttribute('aria-expanded', 'false');
      });
    });

    // Clear button
    this.container.querySelector('.clear-btn').addEventListener('click', () => {
      this.clearResults();
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.export-dropdown')) {
        exportMenu.classList.add('hidden');
        exportBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /**
   * Setup event bus listeners
   */
  setupEventBusListeners() {
    eventBus.on('processing-completed', (data) => {
      this.addProcessedResult(data);
    });

    eventBus.on('processing-excluded', (data) => {
      this.addExcludedResult(data);
    });

    eventBus.on('processing-failed', (data) => {
      this.addErrorResult(data);
    });

    eventBus.on('processing-finished', (data) => {
      this.setProcessingSummary(data);
    });
  }

  /**
   * Switch to a different tab
   */
  switchTab(tabName) {
    // Update tab buttons
    this.container.querySelectorAll('.tab-btn').forEach(btn => {
      if (btn.dataset.tab === tabName) {
        btn.classList.add('text-blue-600', 'border-blue-600');
        btn.classList.remove('text-gray-500', 'border-transparent');
        btn.setAttribute('aria-selected', 'true');
      } else {
        btn.classList.remove('text-blue-600', 'border-blue-600');
        btn.classList.add('text-gray-500', 'border-transparent');
        btn.setAttribute('aria-selected', 'false');
      }
    });

    // Update tab panels
    this.container.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.add('hidden');
    });

    this.container.getElementById(`${tabName}-panel`).classList.remove('hidden');
    this.activeTab = tabName;

    this.renderTabContent(tabName);
  }

  /**
   * Set sort options
   */
  setSort(sortBy, sortOrder) {
    this.sortBy = sortBy;
    this.sortOrder = sortOrder;
    this.renderTabContent(this.activeTab);
  }

  /**
   * Add a processed result
   */
  addProcessedResult(data) {
    this.results.processed.push({
      id: data.id,
      fileName: data.fileName,
      fileSize: data.fileSize,
      processedAt: new Date(),
      processingTime: data.processingTime,
      result: data.result,
      downloadUrl: data.downloadUrl || null
    });

    this.updateResults();
  }

  /**
   * Add an excluded result
   */
  addExcludedResult(data) {
    this.results.excluded.push({
      id: data.id,
      fileName: data.fileName,
      fileSize: data.fileSize,
      excludedAt: new Date(),
      reason: data.reason,
      rule: data.rule
    });

    this.updateResults();
  }

  /**
   * Add an error result
   */
  addErrorResult(data) {
    this.results.errors.push({
      id: data.id,
      fileName: data.fileName,
      fileSize: data.fileSize,
      errorAt: new Date(),
      error: data.error,
      stack: data.stack
    });

    this.updateResults();
  }

  /**
   * Set processing summary
   */
  setProcessingSummary(data) {
    this.results.summary = {
      ...this.results.summary,
      ...data
    };

    this.updateSummaryStats();
  }

  /**
   * Update all results display
   */
  updateResults() {
    this.updateSummaryStats();
    this.updateTabCounts();
    this.renderTabContent(this.activeTab);
  }

  /**
   * Update summary statistics
   */
  updateSummaryStats() {
    const summary = this.results.summary;
    
    this.container.querySelector('.total-files').textContent = summary.totalFiles;
    this.container.querySelector('.processed-files').textContent = summary.processedFiles;
    this.container.querySelector('.excluded-files').textContent = summary.excludedFiles;
    this.container.querySelector('.error-files').textContent = summary.errorFiles;
    this.container.querySelector('.processing-time').textContent = this.formatDuration(summary.processingTime);
  }

  /**
   * Update tab counts
   */
  updateTabCounts() {
    this.container.querySelector('[data-tab="processed"] .tab-count').textContent = this.results.processed.length;
    this.container.querySelector('[data-tab="excluded"] .tab-count').textContent = this.results.excluded.length;
    this.container.querySelector('[data-tab="errors"] .tab-count').textContent = this.results.errors.length;
  }

  /**
   * Render tab content
   */
  renderTabContent(tabName) {
    const panel = this.container.getElementById(`${tabName}-panel`);
    const content = panel.querySelector('.tab-content');
    
    let items = [];
    switch (tabName) {
      case 'processed':
        items = this.sortResults(this.results.processed);
        break;
      case 'excluded':
        items = this.sortResults(this.results.excluded);
        break;
      case 'errors':
        items = this.sortResults(this.results.errors);
        break;
    }

    if (items.length === 0) {
      content.innerHTML = `
        <div class="empty-state text-center py-12">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd" />
          </svg>
          <p class="mt-2 text-sm text-gray-500">No ${tabName} files</p>
        </div>
      `;
    } else {
      content.innerHTML = `
        <div class="results-table-container bg-white rounded-lg shadow overflow-hidden">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              ${this.renderTableHeader(tabName)}
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              ${items.map(item => this.renderTableRow(item, tabName)).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  }

  /**
   * Render table header based on tab type
   */
  renderTableHeader(tabName) {
    const headers = {
      processed: [
        { key: 'name', label: 'File Name', sortable: true },
        { key: 'size', label: 'Size', sortable: true },
        { key: 'pages', label: 'Pages', sortable: true },
        { key: 'time', label: 'Processing Time', sortable: true },
        { key: 'date', label: 'Date', sortable: true },
        { key: 'actions', label: 'Actions', sortable: false }
      ],
      excluded: [
        { key: 'name', label: 'File Name', sortable: true },
        { key: 'size', label: 'Size', sortable: true },
        { key: 'reason', label: 'Reason', sortable: false },
        { key: 'rule', label: 'Rule', sortable: false },
        { key: 'date', label: 'Date', sortable: true }
      ],
      errors: [
        { key: 'name', label: 'File Name', sortable: true },
        { key: 'size', label: 'Size', sortable: true },
        { key: 'error', label: 'Error', sortable: false },
        { key: 'date', label: 'Date', sortable: true }
      ]
    };

    return `
      <tr>
        ${headers[tabName].map(header => `
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            ${header.label}
          </th>
        `).join('')}
      </tr>
    `;
  }

  /**
   * Render a table row
   */
  renderTableRow(item, tabName) {
    const date = new Date(item.processedAt || item.excludedAt || item.errorAt);
    
    if (tabName === 'processed') {
      return `
        <tr class="hover:bg-gray-50">
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="flex items-center">
              <svg class="h-5 w-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
              <div class="text-sm font-medium text-gray-900">${this.escapeHtml(item.fileName)}</div>
            </div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            ${this.formatFileSize(item.fileSize)}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            ${item.result?.pagesProcessed || 0}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            ${this.formatDuration(item.processingTime)}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            ${this.formatDate(date)}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
            ${item.downloadUrl ? `
              <a 
                href="${item.downloadUrl}" 
                class="text-blue-600 hover:text-blue-900 mr-3"
                download
                aria-label="Download ${this.escapeHtml(item.fileName)}"
              >
                Download
              </a>
            ` : ''}
            <button 
              class="text-gray-600 hover:text-gray-900"
              onclick="window.showFileDetails('${item.id}')"
              aria-label="View details for ${this.escapeHtml(item.fileName)}"
            >
              Details
            </button>
          </td>
        </tr>
      `;
    } else if (tabName === 'excluded') {
      return `
        <tr class="hover:bg-gray-50">
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="flex items-center">
              <svg class="h-5 w-5 text-yellow-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              <div class="text-sm font-medium text-gray-900">${this.escapeHtml(item.fileName)}</div>
            </div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            ${this.formatFileSize(item.fileSize)}
          </td>
          <td class="px-6 py-4 text-sm text-gray-500">
            <div class="max-w-xs truncate" title="${this.escapeHtml(item.reason)}">
              ${this.escapeHtml(item.reason)}
            </div>
          </td>
          <td class="px-6 py-4 text-sm text-gray-500">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              ${this.escapeHtml(item.rule)}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            ${this.formatDate(date)}
          </td>
        </tr>
      `;
    } else if (tabName === 'errors') {
      return `
        <tr class="hover:bg-gray-50">
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="flex items-center">
              <svg class="h-5 w-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
              <div class="text-sm font-medium text-gray-900">${this.escapeHtml(item.fileName)}</div>
            </div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            ${this.formatFileSize(item.fileSize)}
          </td>
          <td class="px-6 py-4 text-sm text-gray-500">
            <div class="max-w-xs" title="${this.escapeHtml(item.error)}">
              <div class="truncate">${this.escapeHtml(item.error)}</div>
              ${item.stack ? `
                <button 
                  class="text-blue-600 hover:text-blue-900 text-xs mt-1"
                  onclick="this.nextElementSibling.classList.toggle('hidden')"
                >
                  Show stack trace
                </button>
                <pre class="hidden mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">${this.escapeHtml(item.stack)}</pre>
              ` : ''}
            </div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            ${this.formatDate(date)}
          </td>
        </tr>
      `;
    }
  }

  /**
   * Sort results array
   */
  sortResults(items) {
    return [...items].sort((a, b) => {
      let valueA, valueB;

      switch (this.sortBy) {
        case 'name':
          valueA = a.fileName.toLowerCase();
          valueB = b.fileName.toLowerCase();
          break;
        case 'size':
          valueA = a.fileSize;
          valueB = b.fileSize;
          break;
        case 'date':
          valueA = new Date(a.processedAt || a.excludedAt || a.errorAt);
          valueB = new Date(b.processedAt || b.excludedAt || b.errorAt);
          break;
        default:
          return 0;
      }

      if (valueA < valueB) return this.sortOrder === 'asc' ? -1 : 1;
      if (valueA > valueB) return this.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  /**
   * Export results
   */
  exportResults(format) {
    const exportData = {
      summary: this.results.summary,
      processed: this.results.processed,
      excluded: this.results.excluded,
      errors: this.results.errors,
      exportedAt: new Date().toISOString()
    };

    let content, filename, mimeType;

    switch (format) {
      case 'json':
        content = JSON.stringify(exportData, null, 2);
        filename = `results_${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
        break;
      
      case 'csv':
        content = this.convertToCSV(exportData);
        filename = `results_${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
        break;
      
      case 'pdf':
        // PDF export would require a PDF library
        showToast('PDF export not implemented yet', 'warning');
        return;
    }

    // Create download link
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    showToast(`Results exported as ${format.toUpperCase()}`, 'success');
    
    auditLogger.log('results_exported', {
      format: format,
      fileSize: content.length,
      recordCount: exportData.processed.length + exportData.excluded.length + exportData.errors.length
    });
  }

  /**
   * Convert results to CSV format
   */
  convertToCSV(data) {
    const processedRows = data.processed.map(item => [
      'Processed',
      item.fileName,
      item.fileSize,
      item.result?.pagesProcessed || 0,
      item.processingTime,
      new Date(item.processedAt).toISOString()
    ]);

    const excludedRows = data.excluded.map(item => [
      'Excluded',
      item.fileName,
      item.fileSize,
      item.reason,
      item.rule,
      new Date(item.excludedAt).toISOString()
    ]);

    const errorRows = data.errors.map(item => [
      'Error',
      item.fileName,
      item.fileSize,
      item.error,
      '',
      new Date(item.errorAt).toISOString()
    ]);

    const headers = ['Status', 'File Name', 'Size', 'Details', 'Rule', 'Date'];
    const allRows = [headers, ...processedRows, ...excludedRows, ...errorRows];

    return allRows.map(row => 
      row.map(field => `"${field?.toString().replace(/"/g, '""') || ''}"`).join(',')
    ).join('\n');
  }

  /**
   * Clear all results
   */
  clearResults() {
    if (confirm('Are you sure you want to clear all results?')) {
      this.results = {
        processed: [],
        excluded: [],
        errors: [],
        summary: {
          totalFiles: 0,
          processedFiles: 0,
          excludedFiles: 0,
          errorFiles: 0,
          totalSize: 0,
          processingTime: 0
        }
      };

      this.updateResults();
      showToast('Results cleared', 'info');
      
      auditLogger.log('results_cleared');
    }
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
   * Format duration in milliseconds to human readable format
   */
  formatDuration(ms) {
    if (!ms) return '0s';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Format date
   */
  formatDate(date) {
    return new Intl.DateTimeFormat('default', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
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
   * Get results data
   */
  getResults() {
    return this.results;
  }

  /**
   * Destroy the component
   */
  destroy() {
    this.container.innerHTML = '';
  }
}