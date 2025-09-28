import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PDFViewer } from '@components/PDFViewer';
import { renderWithProviders } from '@utils/testHelpers';

describe('PDFViewer', () => {
  let container;
  let pdfViewer;

  beforeEach(() => {
    // Create mock container
    container = document.createElement('div');
    container.id = 'pdf-viewer-container';
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
    
    // Mock PDF.js
    global.window = {
      ...global.window,
      pdfjsLib: {
        getDocument: vi.fn(() => ({
          promise: Promise.resolve({
            numPages: 3,
            getPage: vi.fn((pageNum) => Promise.resolve({
              getViewport: vi.fn(({ scale }) => ({ width: 600 * scale, height: 800 * scale })),
              render: vi.fn(() => ({ promise: Promise.resolve() }))
            }))
          })
        })),
        GlobalWorkerOptions: {
          workerSrc: ''
        }
      }
    };
  });

  afterEach(() => {
    if (pdfViewer) {
      pdfViewer.destroy();
    }
    container.remove();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw error if container not found', () => {
      expect(() => new PDFViewer('nonexistent-container')).toThrow();
    });

    it('should initialize with default options', () => {
      pdfViewer = new PDFViewer('pdf-viewer-container');
      
      expect(pdfViewer.options.scale).toBe(1.0);
      expect(pdfViewer.options.minScale).toBe(0.25);
      expect(pdfViewer.options.maxScale).toBe(3.0);
      expect(pdfViewer.currentPage).toBe(1);
      expect(pdfViewer.totalPages).toBe(0);
    });

    it('should merge custom options', () => {
      const options = {
        scale: 1.5,
        minScale: 0.5,
        maxScale: 4.0
      };
      
      pdfViewer = new PDFViewer('pdf-viewer-container', options);
      
      expect(pdfViewer.options.scale).toBe(1.5);
      expect(pdfViewer.options.minScale).toBe(0.5);
      expect(pdfViewer.options.maxScale).toBe(4.0);
    });
  });

  describe('render()', () => {
    beforeEach(() => {
      pdfViewer = new PDFViewer('pdf-viewer-container');
    });

    it('should render PDF viewer with correct structure', () => {
      const toolbar = container.querySelector('.pdf-toolbar');
      expect(toolbar).toBeTruthy();
      
      const canvasContainer = container.querySelector('.pdf-canvas-container');
      expect(canvasContainer).toBeTruthy();
      
      const pagesContainer = container.querySelector('.pdf-pages');
      expect(pagesContainer).toBeTruthy();
    });

    it('should render navigation controls', () => {
      const prevBtn = container.querySelector('.prev-page');
      const nextBtn = container.querySelector('.next-page');
      const pageInput = container.querySelector('.current-page');
      
      expect(prevBtn).toBeTruthy();
      expect(nextBtn).toBeTruthy();
      expect(pageInput).toBeTruthy();
      expect(prevBtn.disabled).toBe(true);
      expect(nextBtn.disabled).toBe(true);
    });

    it('should render zoom controls', () => {
      const zoomOut = container.querySelector('.zoom-out');
      const zoomIn = container.querySelector('.zoom-in');
      const zoomSelect = container.querySelector('.zoom-select');
      
      expect(zoomOut).toBeTruthy();
      expect(zoomIn).toBeTruthy();
      expect(zoomSelect).toBeTruthy();
      expect(zoomSelect.value).toBe('1');
    });

    it('should render view mode controls', () => {
      const singlePageBtn = container.querySelector('.single-page');
      const doublePageBtn = container.querySelector('.double-page');
      
      expect(singlePageBtn).toBeTruthy();
      expect(doublePageBtn).toBeTruthy();
    });

    it('should render fullscreen button', () => {
      const fullscreenBtn = container.querySelector('.fullscreen-btn');
      expect(fullscreenBtn).toBeTruthy();
      
      const enterIcon = fullscreenBtn.querySelector('.fullscreen-icon-enter');
      const exitIcon = fullscreenBtn.querySelector('.fullscreen-icon-exit');
      
      expect(enterIcon).toBeTruthy();
      expect(exitIcon.classList.contains('hidden')).toBe(true);
    });
  });

  describe('loadPDF()', () => {
    beforeEach(async () => {
      pdfViewer = new PDFViewer('pdf-viewer-container');
      // Wait for PDF.js to load
      await pdfViewer.init();
    });

    it('should load PDF document successfully', async () => {
      await pdfViewer.loadPDF('test.pdf');
      
      expect(window.pdfjsLib.getDocument).toHaveBeenCalledWith({
        url: 'test.pdf',
        data: null,
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true
      });
      
      expect(pdfViewer.totalPages).toBe(3);
      expect(pdfViewer.currentPage).toBe(1);
      expect(pdfViewer.pdfDoc).toBeTruthy();
    });

    it('should show loading indicator', async () => {
      const loadingPromise = pdfViewer.loadPDF('test.pdf');
      
      const loader = container.querySelector('.loading-indicator');
      expect(loader.classList.contains('hidden')).toBe(false);
      
      await loadingPromise;
    });

    it('should update page info after loading', async () => {
      await pdfViewer.loadPDF('test.pdf');
      
      const currentPageInput = container.querySelector('.current-page');
      const totalPagesSpan = container.querySelector('.total-pages');
      
      expect(currentPageInput.value).toBe('1');
      expect(totalPagesSpan.textContent).toBe('3');
    });

    it('should emit pdf-loaded event', async () => {
      await pdfViewer.loadPDF('test.pdf');
      
      expect(eventBus.emit).toHaveBeenCalledWith('pdf-loaded', {
        totalPages: 3,
        currentPage: 1
      });
    });

    it('should log PDF loading', async () => {
      await pdfViewer.loadPDF('test.pdf');
      
      expect(auditLogger.log).toHaveBeenCalledWith('pdf_loaded', {
        totalPages: 3,
        filename: 'test.pdf'
      });
    });

    it('should handle loading errors', async () => {
      const error = new Error('Failed to load PDF');
      window.pdfjsLib.getDocument.mockReturnValue({
        promise: Promise.reject(error)
      });
      
      await pdfViewer.loadPDF('test.pdf');
      
      expect(showToast).toHaveBeenCalledWith('Failed to load PDF', 'error');
      expect(eventBus.emit).toHaveBeenCalledWith('pdf-load-error', error);
    });
  });

  describe('renderPage()', () => {
    beforeEach(async () => {
      pdfViewer = new PDFViewer('pdf-viewer-container');
      await pdfViewer.init();
      await pdfViewer.loadPDF('test.pdf');
    });

    it('should create canvas for page', async () => {
      await pdfViewer.renderPage(1);
      
      const canvas = document.getElementById('pdf-page-1');
      expect(canvas).toBeTruthy();
      expect(canvas.className).toContain('pdf-page');
      expect(canvas.getAttribute('role')).toBe('img');
      expect(canvas.getAttribute('aria-label')).toBe('Page 1');
    });

    it('should render with correct dimensions', async () => {
      await pdfViewer.renderPage(1);
      
      const canvas = document.getElementById('pdf-page-1');
      expect(canvas.width).toBe(600); // 600 * scale(1.0)
      expect(canvas.height).toBe(800); // 800 * scale(1.0)
    });

    it('should reuse existing canvas', async () => {
      // Create canvas manually
      const existingCanvas = document.createElement('canvas');
      existingCanvas.id = 'pdf-page-1';
      container.querySelector('.pdf-pages').appendChild(existingCanvas);
      
      const spy = vi.spyOn(document, 'createElement');
      await pdfViewer.renderPage(1);
      
      expect(spy).not.toHaveBeenCalledWith('canvas');
    });

    it('should scroll to page after rendering', async () => {
      const scrollIntoViewSpy = vi.fn();
      document.getElementById = vi.fn(() => ({
        scrollIntoView: scrollIntoViewSpy
      }));
      
      await pdfViewer.renderPage(1);
      
      expect(scrollIntoViewSpy).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start'
      });
    });

    it('should emit page-rendered event', async () => {
      await pdfViewer.renderPage(1);
      
      expect(eventBus.emit).toHaveBeenCalledWith('page-rendered', {
        pageNum: 1,
        scale: 1.0
      });
    });
  });

  describe('navigation', () => {
    beforeEach(async () => {
      pdfViewer = new PDFViewer('pdf-viewer-container');
      await pdfViewer.init();
      await pdfViewer.loadPDF('test.pdf');
    });

    it('should navigate to previous page', () => {
      pdfViewer.currentPage = 2;
      pdfViewer.previousPage();
      
      expect(pdfViewer.currentPage).toBe(1);
    });

    it('should not navigate before first page', () => {
      pdfViewer.currentPage = 1;
      pdfViewer.previousPage();
      
      expect(pdfViewer.currentPage).toBe(1);
    });

    it('should navigate to next page', () => {
      pdfViewer.nextPage();
      
      expect(pdfViewer.currentPage).toBe(2);
    });

    it('should not navigate after last page', () => {
      pdfViewer.currentPage = 3;
      pdfViewer.nextPage();
      
      expect(pdfViewer.currentPage).toBe(3);
    });

    it('should go to specific page', () => {
      pdfViewer.goToPage(3);
      
      expect(pdfViewer.currentPage).toBe(3);
    });

    it('should validate page number', () => {
      pdfViewer.goToPage(0);
      expect(pdfViewer.currentPage).toBe(1);
      
      pdfViewer.goToPage(5);
      expect(pdfViewer.currentPage).toBe(3);
    });

    it('should log page navigation', () => {
      pdfViewer.currentPage = 1;
      pdfViewer.goToPage(3);
      
      expect(auditLogger.log).toHaveBeenCalledWith('page_navigated', {
        from: 1,
        to: 3
      });
    });

    it('should handle page input change', async () => {
      const pageInput = container.querySelector('.current-page');
      
      pageInput.value = '2';
      pageInput.dispatchEvent(new Event('change'));
      
      await vi.runAllTimersAsync();
      
      expect(pdfViewer.currentPage).toBe(2);
    });

    it('should reset invalid page input', async () => {
      const pageInput = container.querySelector('.current-page');
      
      pageInput.value = '5';
      pageInput.dispatchEvent(new Event('change'));
      
      await vi.runAllTimersAsync();
      
      expect(pageInput.value).toBe('1');
      expect(pdfViewer.currentPage).toBe(1);
    });
  });

  describe('zoom', () => {
    beforeEach(async () => {
      pdfViewer = new PDFViewer('pdf-viewer-container');
      await pdfViewer.init();
      await pdfViewer.loadPDF('test.pdf');
    });

    it('should zoom in', () => {
      pdfViewer.zoomIn();
      
      expect(pdfViewer.scale).toBe(1.25);
    });

    it('should not zoom beyond max scale', () => {
      pdfViewer.scale = 3.0;
      pdfViewer.zoomIn();
      
      expect(pdfViewer.scale).toBe(3.0);
    });

    it('should zoom out', () => {
      pdfViewer.zoomOut();
      
      expect(pdfViewer.scale).toBe(0.75);
    });

    it('should not zoom below min scale', () => {
      pdfViewer.scale = 0.25;
      pdfViewer.zoomOut();
      
      expect(pdfViewer.scale).toBe(0.25);
    });

    it('should set specific scale', () => {
      pdfViewer.setScale(2.0);
      
      expect(pdfViewer.scale).toBe(2.0);
      expect(container.querySelector('.zoom-select').value).toBe('2');
    });

    it('should render page with new scale', async () => {
      const renderSpy = vi.spyOn(pdfViewer, 'renderPage');
      
      pdfViewer.setScale(1.5);
      
      expect(renderSpy).toHaveBeenCalledWith(1);
    });

    it('should fit to width', async () => {
      const mockGetPage = vi.fn(() => Promise.resolve({
        getViewport: vi.fn(() => ({ width: 800, height: 1000 }))
      }));
      pdfViewer.pdfDoc.getPage = mockGetPage;
      
      // Mock container width
      Object.defineProperty(container.querySelector('.pdf-canvas-container'), 'clientWidth', {
        value: 600,
        configurable: true
      });
      
      await pdfViewer.fitToWidth();
      
      expect(pdfViewer.scale).toBeCloseTo(0.71, 2); // (600 - 32) / 800
    });

    it('should fit to page', async () => {
      const mockGetPage = vi.fn(() => Promise.resolve({
        getViewport: vi.fn(() => ({ width: 800, height: 1200 }))
      }));
      pdfViewer.pdfDoc.getPage = mockGetPage;
      
      // Mock container dimensions
      const canvasContainer = container.querySelector('.pdf-canvas-container');
      Object.defineProperty(canvasContainer, 'clientWidth', {
        value: 600,
        configurable: true
      });
      Object.defineProperty(canvasContainer, 'clientHeight', {
        value: 800,
        configurable: true
      });
      
      await pdfViewer.fitToPage();
      
      expect(pdfViewer.scale).toBeCloseTo(0.64, 2); // min(568/800, 768/1200)
    });

    it('should handle zoom select change', async () => {
      const zoomSelect = container.querySelector('.zoom-select');
      
      zoomSelect.value = 'fit-width';
      zoomSelect.dispatchEvent(new Event('change'));
      
      await vi.runAllTimersAsync();
      
      // fitToWidth should be called
      expect(zoomSelect.value).toBe('fit-width');
    });
  });

  describe('fullscreen', () => {
    beforeEach(async () => {
      pdfViewer = new PDFViewer('pdf-viewer-container');
      await pdfViewer.init();
    });

    it('should toggle fullscreen', () => {
      const requestFullscreenSpy = vi.fn();
      const exitFullscreenSpy = vi.fn();
      
      container.requestFullscreen = requestFullscreenSpy;
      document.exitFullscreen = exitFullscreenSpy;
      
      // Enter fullscreen
      pdfViewer.toggleFullscreen();
      expect(requestFullscreenSpy).toHaveBeenCalled();
      expect(pdfViewer.isFullscreen).toBe(true);
      
      // Exit fullscreen
      pdfViewer.toggleFullscreen();
      expect(exitFullscreenSpy).toHaveBeenCalled();
      expect(pdfViewer.isFullscreen).toBe(false);
    });

    it('should update fullscreen button icon', () => {
      const enterIcon = container.querySelector('.fullscreen-icon-enter');
      const exitIcon = container.querySelector('.fullscreen-icon-exit');
      
      pdfViewer.isFullscreen = true;
      pdfViewer.updateFullscreenButton();
      
      expect(enterIcon.classList.contains('hidden')).toBe(true);
      expect(exitIcon.classList.contains('hidden')).toBe(false);
    });
  });

  describe('keyboard navigation', () => {
    beforeEach(async () => {
      pdfViewer = new PDFViewer('pdf-viewer-container');
      await pdfViewer.init();
      await pdfViewer.loadPDF('test.pdf');
    });

    it('should handle arrow keys', () => {
      // Left arrow
      pdfViewer.currentPage = 2;
      const leftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
      document.dispatchEvent(leftEvent);
      expect(pdfViewer.currentPage).toBe(1);
      
      // Right arrow
      const rightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      document.dispatchEvent(rightEvent);
      expect(pdfViewer.currentPage).toBe(2);
    });

    it('should handle Ctrl/Cmd plus for zoom in', () => {
      const event = new KeyboardEvent('keydown', { key: '+', ctrlKey: true });
      document.dispatchEvent(event);
      expect(pdfViewer.scale).toBe(1.25);
    });

    it('should handle Ctrl/Cmd minus for zoom out', () => {
      const event = new KeyboardEvent('keydown', { key: '-', ctrlKey: true });
      document.dispatchEvent(event);
      expect(pdfViewer.scale).toBe(0.75);
    });

    it('should handle Ctrl/Cmd 0 for reset zoom', () => {
      pdfViewer.scale = 2.0;
      const event = new KeyboardEvent('keydown', { key: '0', ctrlKey: true });
      document.dispatchEvent(event);
      expect(pdfViewer.scale).toBe(1);
    });

    it('should handle Ctrl/Cmd f for fullscreen', () => {
      container.requestFullscreen = vi.fn();
      
      const event = new KeyboardEvent('keydown', { key: 'f', ctrlKey: true });
      document.dispatchEvent(event);
      
      expect(container.requestFullscreen).toHaveBeenCalled();
    });

    it('should not handle keys when focus is outside', () => {
      const spy = vi.spyOn(pdfViewer, 'nextPage');
      
      // Mock focus outside container
      document.activeElement = document.body;
      
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      document.dispatchEvent(event);
      
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('wheel zoom', () => {
    beforeEach(async () => {
      pdfViewer = new PDFViewer('pdf-viewer-container');
      await pdfViewer.init();
      await pdfViewer.loadPDF('test.pdf');
    });

    it('should zoom in with Ctrl+wheel up', () => {
      const canvasContainer = container.querySelector('.pdf-canvas-container');
      
      const event = new WheelEvent('wheel', {
        deltaY: -100,
        ctrlKey: true,
        bubbles: true
      });
      
      canvasContainer.dispatchEvent(event);
      expect(pdfViewer.scale).toBe(1.25);
    });

    it('should zoom out with Ctrl+wheel down', () => {
      const canvasContainer = container.querySelector('.pdf-canvas-container');
      
      const event = new WheelEvent('wheel', {
        deltaY: 100,
        ctrlKey: true,
        bubbles: true
      });
      
      canvasContainer.dispatchEvent(event);
      expect(pdfViewer.scale).toBe(0.75);
    });

    it('should not zoom without Ctrl key', () => {
      const canvasContainer = container.querySelector('.pdf-canvas-container');
      
      const event = new WheelEvent('wheel', {
        deltaY: -100,
        ctrlKey: false,
        bubbles: true
      });
      
      canvasContainer.dispatchEvent(event);
      expect(pdfViewer.scale).toBe(1.0);
    });
  });

  describe('updatePageInfo()', () => {
    beforeEach(async () => {
      pdfViewer = new PDFViewer('pdf-viewer-container');
      await pdfViewer.init();
      await pdfViewer.loadPDF('test.pdf');
    });

    it('should update page display', () => {
      pdfViewer.currentPage = 2;
      pdfViewer.updatePageInfo();
      
      const pageInput = container.querySelector('.current-page');
      const prevBtn = container.querySelector('.prev-page');
      const nextBtn = container.querySelector('.next-page');
      
      expect(pageInput.value).toBe('2');
      expect(prevBtn.disabled).toBe(false);
      expect(nextBtn.disabled).toBe(false);
    });

    it('should disable buttons at boundaries', () => {
      pdfViewer.currentPage = 1;
      pdfViewer.updatePageInfo();
      
      const prevBtn = container.querySelector('.prev-page');
      const nextBtn = container.querySelector('.next-page');
      
      expect(prevBtn.disabled).toBe(true);
      expect(nextBtn.disabled).toBe(false);
      
      pdfViewer.currentPage = 3;
      pdfViewer.updatePageInfo();
      
      expect(prevBtn.disabled).toBe(false);
      expect(nextBtn.disabled).toBe(true);
    });

    it('should update zoom buttons', () => {
      pdfViewer.scale = 0.25;
      pdfViewer.updatePageInfo();
      
      const zoomOutBtn = container.querySelector('.zoom-out');
      const zoomInBtn = container.querySelector('.zoom-in');
      
      expect(zoomOutBtn.disabled).toBe(true);
      expect(zoomInBtn.disabled).toBe(false);
    });
  });

  describe('view mode', () => {
    beforeEach(async () => {
      pdfViewer = new PDFViewer('pdf-viewer-container');
      await pdfViewer.init();
    });

    it('should set spread mode', () => {
      pdfViewer.setSpreadMode('odd');
      expect(pdfViewer.options.spreadMode).toBe('odd');
      
      pdfViewer.setSpreadMode('none');
      expect(pdfViewer.options.spreadMode).toBe('none');
    });

    it('should show toast for view mode change', () => {
      pdfViewer.setSpreadMode('none');
      expect(showToast).toHaveBeenCalledWith('Single page view activated', 'info');
    });
  });

  describe('showLoading()', () => {
    beforeEach(async () => {
      pdfViewer = new PDFViewer('pdf-viewer-container');
      await pdfViewer.init();
    });

    it('should show loading indicator', () => {
      pdfViewer.showLoading(true);
      const loader = container.querySelector('.loading-indicator');
      expect(loader.classList.contains('hidden')).toBe(false);
    });

    it('should hide loading indicator', () => {
      pdfViewer.showLoading(false);
      const loader = container.querySelector('.loading-indicator');
      expect(loader.classList.contains('hidden')).toBe(true);
    });
  });

  describe('getter methods', () => {
    beforeEach(async () => {
      pdfViewer = new PDFViewer('pdf-viewer-container');
      await pdfViewer.init();
      await pdfViewer.loadPDF('test.pdf');
    });

    it('should return current page', () => {
      pdfViewer.currentPage = 2;
      expect(pdfViewer.getCurrentPage()).toBe(2);
    });

    it('should return total pages', () => {
      expect(pdfViewer.getTotalPages()).toBe(3);
    });

    it('should return current scale', () => {
      pdfViewer.scale = 1.5;
      expect(pdfViewer.getScale()).toBe(1.5);
    });
  });

  describe('destroy()', () => {
    it('should clean up component', () => {
      pdfViewer = new PDFViewer('pdf-viewer-container');
      
      pdfViewer.destroy();
      
      expect(container.innerHTML).toBe('');
    });
  });
});