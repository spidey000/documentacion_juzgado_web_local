import { eventBus } from '../utils/eventBus.js';
import { showToast } from '../utils/toast.js';
import { auditLogger } from '../utils/auditLogger.js';

/**
 * PDFViewer Component
 * Renders PDF documents with navigation, zoom, and text selection capabilities
 */
export class PDFViewer {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container with id "${containerId}" not found`);
    }

    // Default options
    this.options = {
      scale: 1.0,
      minScale: 0.25,
      maxScale: 3.0,
      scaleStep: 0.25,
      scrollMode: 'vertical',
      spreadMode: 'none',
      ...options
    };

    this.pdfDoc = null;
    this.currentPage = 1;
    this.totalPages = 0;
    this.scale = this.options.scale;
    this.isFullscreen = false;
    this.renderingQueue = [];
    this.isRendering = false;

    this.init();
  }

  /**
   * Initialize the component
   */
  async init() {
    this.render();
    this.attachEventListeners();
    this.setupKeyboardNavigation();
    
    // Load PDF.js dynamically
    await this.loadPDFJS();
  }

  /**
   * Render the component HTML
   */
  render() {
    this.container.innerHTML = `
      <div class="pdf-viewer-container h-full flex flex-col" role="region" aria-label="PDF viewer">
        <!-- Toolbar -->
        <div class="pdf-toolbar bg-gray-100 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
          <div class="toolbar-left flex items-center space-x-2">
            <!-- Page Navigation -->
            <div class="page-navigation flex items-center space-x-2">
              <button 
                class="nav-btn prev-page p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Previous page"
                disabled
              >
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
              </button>
              
              <div class="page-input flex items-center">
                <input 
                  type="number" 
                  class="current-page w-12 px-2 py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value="${this.currentPage}"
                  min="1"
                  aria-label="Current page number"
                >
                <span class="mx-1 text-gray-600">/</span>
                <span class="total-pages text-gray-600" aria-label="Total pages">0</span>
              </div>
              
              <button 
                class="nav-btn next-page p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Next page"
                disabled
              >
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>

            <!-- Zoom Controls -->
            <div class="zoom-controls flex items-center space-x-2 ml-4">
              <button 
                class="zoom-btn zoom-out p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Zoom out"
              >
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clip-rule="evenodd" />
                </svg>
              </button>
              
              <select 
                class="zoom-select px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Zoom level"
              >
                <option value="0.5">50%</option>
                <option value="0.75">75%</option>
                <option value="1" selected>100%</option>
                <option value="1.25">125%</option>
                <option value="1.5">150%</option>
                <option value="2">200%</option>
                <option value="fit-width">Fit Width</option>
                <option value="fit-page">Fit Page</option>
              </select>
              
              <button 
                class="zoom-btn zoom-in p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Zoom in"
              >
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          </div>

          <div class="toolbar-right flex items-center space-x-2">
            <!-- View Mode -->
            <div class="view-mode flex items-center space-x-2">
              <button 
                class="mode-btn single-page p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded"
                aria-label="Single page view"
                title="Single Page"
              >
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fill-rule="evenodd" d="M4 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 2a1 1 0 000 2h6a1 1 0 100-2H7zm0 4a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd" />
                </svg>
              </button>
              
              <button 
                class="mode-btn double-page p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded"
                aria-label="Double page view"
                title="Double Page"
              >
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M7 2a1 1 0 000 2h1a1 1 0 100-2H7zM4 5a2 2 0 012-2h1a1 1 0 100 2H6a1 1 0 000 2h1a1 1 0 100 2H6a2 2 0 00-2 2v5a2 2 0 002 2h8a2 2 0 002-2V9a2 2 0 00-2-2h-1a1 1 0 100-2h1a1 1 0 100-2h-1a1 1 0 100-2h1a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" />
                </svg>
              </button>
            </div>

            <!-- Fullscreen -->
            <button 
              class="fullscreen-btn p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded ml-4"
              aria-label="Toggle fullscreen"
            >
              <svg class="h-5 w-5 fullscreen-icon-enter" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 110-2h4a1 1 0 011 1v4a1 1 0 11-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 110 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 110-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z" />
              </svg>
              <svg class="h-5 w-5 fullscreen-icon-exit hidden" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 4a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V4z" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Loading Indicator -->
        <div class="loading-indicator hidden absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
          <div class="flex flex-col items-center">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p class="mt-2 text-gray-600">Loading PDF...</p>
          </div>
        </div>

        <!-- PDF Canvas Container -->
        <div class="pdf-canvas-container flex-1 overflow-auto bg-gray-100 relative">
          <div class="pdf-pages flex flex-col items-center p-4"></div>
        </div>

        <!-- Text Selection Layer (Hidden by default) -->
        <div class="text-selection-layer hidden absolute inset-0 pointer-events-none"></div>
      </div>
    `;
  }

  /**
   * Load PDF.js library dynamically
   */
  async loadPDFJS() {
    return new Promise((resolve, reject) => {
      if (window.pdfjsLib) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        // Set worker source
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Page navigation
    this.container.querySelector('.prev-page').addEventListener('click', () => this.previousPage());
    this.container.querySelector('.next-page').addEventListener('click', () => this.nextPage());
    
    const pageInput = this.container.querySelector('.current-page');
    pageInput.addEventListener('change', (e) => {
      const page = parseInt(e.target.value);
      if (page >= 1 && page <= this.totalPages) {
        this.goToPage(page);
      } else {
        e.target.value = this.currentPage;
      }
    });

    // Zoom controls
    this.container.querySelector('.zoom-out').addEventListener('click', () => this.zoomOut());
    this.container.querySelector('.zoom-in').addEventListener('click', () => this.zoomIn());
    
    const zoomSelect = this.container.querySelector('.zoom-select');
    zoomSelect.addEventListener('change', (e) => {
      const value = e.target.value;
      if (value === 'fit-width') {
        this.fitToWidth();
      } else if (value === 'fit-page') {
        this.fitToPage();
      } else {
        this.setScale(parseFloat(value));
      }
    });

    // View mode
    this.container.querySelector('.single-page').addEventListener('click', () => {
      this.setSpreadMode('none');
    });
    this.container.querySelector('.double-page').addEventListener('click', () => {
      this.setSpreadMode('odd');
    });

    // Fullscreen
    this.container.querySelector('.fullscreen-btn').addEventListener('click', () => {
      this.toggleFullscreen();
    });

    // Wheel zoom with Ctrl
    const canvasContainer = this.container.querySelector('.pdf-canvas-container');
    canvasContainer.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          this.zoomIn();
        } else {
          this.zoomOut();
        }
      }
    });
  }

  /**
   * Setup keyboard navigation
   */
  setupKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
      if (!this.container.contains(document.activeElement)) return;

      switch(e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          this.previousPage();
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.nextPage();
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (e.ctrlKey) {
            this.zoomIn();
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (e.ctrlKey) {
            this.zoomOut();
          }
          break;
        case '+':
        case '=':
          if (e.ctrlKey) {
            e.preventDefault();
            this.zoomIn();
          }
          break;
        case '-':
          if (e.ctrlKey) {
            e.preventDefault();
            this.zoomOut();
          }
          break;
        case '0':
          if (e.ctrlKey) {
            e.preventDefault();
            this.setScale(1);
          }
          break;
        case 'f':
          if (e.ctrlKey) {
            e.preventDefault();
            this.toggleFullscreen();
          }
          break;
      }
    });
  }

  /**
   * Load a PDF document
   */
  async loadPDF(url, data = null) {
    this.showLoading(true);
    
    try {
      const loadingTask = window.pdfjsLib.getDocument({
        url: url,
        data: data,
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true
      });

      this.pdfDoc = await loadingTask.promise;
      this.totalPages = this.pdfDoc.numPages;
      this.currentPage = 1;

      this.updatePageInfo();
      this.renderPage(this.currentPage);
      
      auditLogger.log('pdf_loaded', {
        totalPages: this.totalPages,
        filename: url.split('/').pop()
      });

      eventBus.emit('pdf-loaded', {
        totalPages: this.totalPages,
        currentPage: this.currentPage
      });
    } catch (error) {
      console.error('Error loading PDF:', error);
      showToast('Failed to load PDF', 'error');
      eventBus.emit('pdf-load-error', error);
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Render a specific page
   */
  async renderPage(pageNum) {
    if (!this.pdfDoc) return;

    const page = await this.pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: this.scale });

    // Create canvas if it doesn't exist
    let canvas = document.getElementById(`pdf-page-${pageNum}`);
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = `pdf-page-${pageNum}`;
      canvas.className = 'pdf-page mb-4 shadow-lg';
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `Page ${pageNum}`);
      
      const pagesContainer = this.container.querySelector('.pdf-pages');
      pagesContainer.appendChild(canvas);
    }

    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };

    await page.render(renderContext).promise;
    
    // Scroll to page
    canvas.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    eventBus.emit('page-rendered', {
      pageNum: pageNum,
      scale: this.scale
    });
  }

  /**
   * Navigation methods
   */
  previousPage() {
    if (this.currentPage > 1) {
      this.goToPage(this.currentPage - 1);
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.goToPage(this.currentPage + 1);
    }
  }

  goToPage(pageNum) {
    if (pageNum >= 1 && pageNum <= this.totalPages) {
      this.currentPage = pageNum;
      this.updatePageInfo();
      this.renderPage(pageNum);
      
      auditLogger.log('page_navigated', {
        from: this.currentPage,
        to: pageNum
      });
    }
  }

  /**
   * Zoom methods
   */
  zoomIn() {
    const newScale = Math.min(this.scale + this.options.scaleStep, this.options.maxScale);
    this.setScale(newScale);
  }

  zoomOut() {
    const newScale = Math.max(this.scale - this.options.scaleStep, this.options.minScale);
    this.setScale(newScale);
  }

  setScale(scale) {
    this.scale = scale;
    this.container.querySelector('.zoom-select').value = scale;
    
    if (this.pdfDoc) {
      this.renderPage(this.currentPage);
    }
  }

  fitToWidth() {
    if (!this.pdfDoc) return;
    
    const container = this.container.querySelector('.pdf-canvas-container');
    const containerWidth = container.clientWidth - 32; // Account for padding
    
    this.pdfDoc.getPage(this.currentPage).then(page => {
      const viewport = page.getViewport({ scale: 1 });
      const scale = containerWidth / viewport.width;
      this.setScale(Math.min(scale, this.options.maxScale));
    });
  }

  fitToPage() {
    if (!this.pdfDoc) return;
    
    const container = this.container.querySelector('.pdf-canvas-container');
    const containerWidth = container.clientWidth - 32;
    const containerHeight = container.clientHeight - 32;
    
    this.pdfDoc.getPage(this.currentPage).then(page => {
      const viewport = page.getViewport({ scale: 1 });
      const scaleX = containerWidth / viewport.width;
      const scaleY = containerHeight / viewport.height;
      const scale = Math.min(scaleX, scaleY, this.options.maxScale);
      this.setScale(scale);
    });
  }

  /**
   * Fullscreen methods
   */
  toggleFullscreen() {
    if (!this.isFullscreen) {
      this.enterFullscreen();
    } else {
      this.exitFullscreen();
    }
  }

  enterFullscreen() {
    const container = this.container;
    
    if (container.requestFullscreen) {
      container.requestFullscreen();
    } else if (container.webkitRequestFullscreen) {
      container.webkitRequestFullscreen();
    } else if (container.msRequestFullscreen) {
      container.msRequestFullscreen();
    }
    
    this.isFullscreen = true;
    this.updateFullscreenButton();
  }

  exitFullscreen() {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
    
    this.isFullscreen = false;
    this.updateFullscreenButton();
  }

  updateFullscreenButton() {
    const enterIcon = this.container.querySelector('.fullscreen-icon-enter');
    const exitIcon = this.container.querySelector('.fullscreen-icon-exit');
    
    if (this.isFullscreen) {
      enterIcon.classList.add('hidden');
      exitIcon.classList.remove('hidden');
    } else {
      enterIcon.classList.remove('hidden');
      exitIcon.classList.add('hidden');
    }
  }

  /**
   * Set spread mode for viewing
   */
  setSpreadMode(mode) {
    this.options.spreadMode = mode;
    // Implementation would need to handle double page rendering
    showToast(`${mode === 'none' ? 'Single' : 'Double'} page view activated`, 'info');
  }

  /**
   * Update page information display
   */
  updatePageInfo() {
    this.container.querySelector('.current-page').value = this.currentPage;
    this.container.querySelector('.total-pages').textContent = this.totalPages;
    
    // Update navigation buttons
    this.container.querySelector('.prev-page').disabled = this.currentPage <= 1;
    this.container.querySelector('.next-page').disabled = this.currentPage >= this.totalPages;
    
    // Update zoom buttons
    this.container.querySelector('.zoom-out').disabled = this.scale <= this.options.minScale;
    this.container.querySelector('.zoom-in').disabled = this.scale >= this.options.maxScale;
  }

  /**
   * Show/hide loading indicator
   */
  showLoading(show) {
    const loader = this.container.querySelector('.loading-indicator');
    if (show) {
      loader.classList.remove('hidden');
    } else {
      loader.classList.add('hidden');
    }
  }

  /**
   * Get current page number
   */
  getCurrentPage() {
    return this.currentPage;
  }

  /**
   * Get total pages
   */
  getTotalPages() {
    return this.totalPages;
  }

  /**
   * Get current scale
   */
  getScale() {
    return this.scale;
  }

  /**
   * Destroy the component
   */
  destroy() {
    this.container.innerHTML = '';
    // Remove event listeners
    document.removeEventListener('keydown', this.setupKeyboardNavigation);
  }
}