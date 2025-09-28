import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResultsPanel } from '@components/ResultsPanel';
import { eventBus } from '@utils/eventBus';

describe('ResultsPanel', () => {
  let container;
  let resultsPanel;

  beforeEach(() => {
    // Create mock container
    container = document.createElement('div');
    container.id = 'results-panel-container';
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
    if (resultsPanel) {
      resultsPanel.destroy();
    }
    container.remove();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw error if container not found', () => {
      expect(() => new ResultsPanel('nonexistent-container')).toThrow();
    });

    it('should initialize with default options', () => {
      resultsPanel = new ResultsPanel('results-panel-container');
      
      expect(resultsPanel.options.showFileSize).toBe(true);
      expect(resultsPanel.options.showProcessingTime).toBe(true);
      expect(resultsPanel.options.maxItemsPerTab).toBe(50);
      expect(resultsPanel.options.exportFormats).toEqual(['json', 'csv', 'pdf']);
    });

    it('should initialize with empty results', () => {
      resultsPanel = new ResultsPanel('results-panel-container');
      
      expect(resultsPanel.results.processed).toEqual([]);
      expect(resultsPanel.results.excluded).toEqual([]);
      expect(resultsPanel.results.errors).toEqual([]);
      expect(resultsPanel.results.summary.totalFiles).toBe(0);
    });
  });

  describe('render()', () => {
    beforeEach(() => {
      resultsPanel = new ResultsPanel('results-panel-container');
    });

    it('should render results panel with correct structure', () => {
      const header = container.querySelector('.results-header');
      expect(header).toBeTruthy();
      
      const tabs = container.querySelector('.results-tabs');
      expect(tabs).toBeTruthy();
      
      const content = container.querySelector('.results-content');
      expect(content).toBeTruthy();
    });

    it('should render summary stats cards', () => {
      const statCards = container.querySelectorAll('.stat-card');
      expect(statCards).toHaveLength(5);
      
      const totalFiles = container.querySelector('.total-files');
      const processedFiles = container.querySelector('.processed-files');
      expect(totalFiles.textContent).toBe('0');
      expect(processedFiles.textContent).toBe('0');
    });

    it('should render tabs with counts', () => {
      const processedTab = container.querySelector('[data-tab="processed"]');
      const excludedTab = container.querySelector('[data-tab="excluded"]');
      const errorsTab = container.querySelector('[data-tab="errors"]');
      
      expect(processedTab).toBeTruthy();
      expect(excludedTab).toBeTruthy();
      expect(errorsTab).toBeTruthy();
      
      expect(processedTab.querySelector('.tab-count').textContent).toBe('0');
      expect(excludedTab.querySelector('.tab-count').textContent).toBe('0');
      expect(errorsTab.querySelector('.tab-count').textContent).toBe('0');
    });

    it('should render sort dropdown', () => {
      const sortSelect = container.querySelector('.sort-select');
      expect(sortSelect).toBeTruthy();
      
      const options = sortSelect.querySelectorAll('option');
      expect(options.length).toBeGreaterThan(0);
      expect(options[0].value).toBe('name-asc');
    });

    it('should render export button with dropdown', () => {
      const exportBtn = container.querySelector('.export-btn');
      const exportMenu = container.querySelector('.export-menu');
      
      expect(exportBtn).toBeTruthy();
      expect(exportMenu).toBeTruthy();
      expect(exportMenu.classList.contains('hidden')).toBe(true);
    });

    it('should render clear button', () => {
      const clearBtn = container.querySelector('.clear-btn');
      expect(clearBtn).toBeTruthy();
      expect(clearBtn.textContent).toBe('Clear');
    });
  });

  describe('switchTab()', () => {
    beforeEach(() => {
      resultsPanel = new ResultsPanel('results-panel-container');
    });

    it('should update active tab styling', () => {
      const processedTab = container.querySelector('[data-tab="processed"]');
      const excludedTab = container.querySelector('[data-tab="excluded"]');
      
      // Switch to excluded tab
      resultsPanel.switchTab('excluded');
      
      expect(processedTab.classList.contains('text-blue-600')).toBe(false);
      expect(excludedTab.classList.contains('text-blue-600')).toBe(true);
    });

    it('should show/hide tab panels', () => {
      resultsPanel.switchTab('excluded');
      
      const processedPanel = container.querySelector('#processed-panel');
      const excludedPanel = container.querySelector('#excluded-panel');
      
      expect(processedPanel.classList.contains('hidden')).toBe(true);
      expect(excludedPanel.classList.contains('hidden')).toBe(false);
    });

    it('should update activeTab property', () => {
      resultsPanel.switchTab('errors');
      expect(resultsPanel.activeTab).toBe('errors');
    });
  });

  describe('addProcessedResult()', () => {
    beforeEach(() => {
      resultsPanel = new ResultsPanel('results-panel-container');
    });

    it('should add processed result to results', () => {
      const data = {
        id: 1,
        fileName: 'test.pdf',
        fileSize: 1024,
        processingTime: 1500,
        result: { pagesProcessed: 3 }
      };
      
      resultsPanel.addProcessedResult(data);
      
      expect(resultsPanel.results.processed).toHaveLength(1);
      expect(resultsPanel.results.processed[0].fileName).toBe('test.pdf');
      expect(resultsPanel.results.processed[0].result).toEqual({ pagesProcessed: 3 });
    });

    it('should set processed date', () => {
      const before = new Date();
      resultsPanel.addProcessedResult({
        id: 1,
        fileName: 'test.pdf',
        fileSize: 1024
      });
      
      const after = new Date();
      const processedDate = new Date(resultsPanel.results.processed[0].processedAt);
      
      expect(processedDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(processedDate.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('addExcludedResult()', () => {
    beforeEach(() => {
      resultsPanel = new ResultsPanel('results-panel-container');
    });

    it('should add excluded result to results', () => {
      const data = {
        id: 1,
        fileName: 'invalid.pdf',
        fileSize: 2048,
        reason: 'File size exceeds limit',
        rule: 'MAX_SIZE'
      };
      
      resultsPanel.addExcludedResult(data);
      
      expect(resultsPanel.results.excluded).toHaveLength(1);
      expect(resultsPanel.results.excluded[0].fileName).toBe('invalid.pdf');
      expect(resultsPanel.results.excluded[0].reason).toBe('File size exceeds limit');
    });
  });

  describe('addErrorResult()', () => {
    beforeEach(() => {
      resultsPanel = new ResultsPanel('results-panel-container');
    });

    it('should add error result to results', () => {
      const data = {
        id: 1,
        fileName: 'corrupt.pdf',
        fileSize: 512,
        error: 'Invalid PDF format',
        stack: 'Error: Invalid PDF format\\n    at parsePDF'
      };
      
      resultsPanel.addErrorResult(data);
      
      expect(resultsPanel.results.errors).toHaveLength(1);
      expect(resultsPanel.results.errors[0].fileName).toBe('corrupt.pdf');
      expect(resultsPanel.results.errors[0].error).toBe('Invalid PDF format');
      expect(resultsPanel.results.errors[0].stack).toBe('Error: Invalid PDF format\\n    at parsePDF');
    });
  });

  describe('setProcessingSummary()', () => {
    beforeEach(() => {
      resultsPanel = new ResultsPanel('results-panel-container');
    });

    it('should update summary statistics', () => {
      const summary = {
        totalFiles: 10,
        processedFiles: 8,
        excludedFiles: 1,
        errorFiles: 1,
        totalSize: 1024 * 1024 * 10,
        processingTime: 15000
      };
      
      resultsPanel.setProcessingSummary(summary);
      
      expect(resultsPanel.results.summary).toEqual(summary);
    });

    it('should update summary display', () => {
      const updateSummaryStatsSpy = vi.spyOn(resultsPanel, 'updateSummaryStats');
      
      resultsPanel.setProcessingSummary({
        totalFiles: 5,
        processedFiles: 3
      });
      
      expect(updateSummaryStatsSpy).toHaveBeenCalled();
    });
  });

  describe('updateResults()', () => {
    beforeEach(() => {
      resultsPanel = new ResultsPanel('results-panel-container');
    });

    it('should call all update methods', () => {
      const updateSummaryStatsSpy = vi.spyOn(resultsPanel, 'updateSummaryStats');
      const updateTabCountsSpy = vi.spyOn(resultsPanel, 'updateTabCounts');
      const renderTabContentSpy = vi.spyOn(resultsPanel, 'renderTabContent');
      
      resultsPanel.updateResults();
      
      expect(updateSummaryStatsSpy).toHaveBeenCalled();
      expect(updateTabCountsSpy).toHaveBeenCalled();
      expect(renderTabContentSpy).toHaveBeenCalledWith('processed');
    });
  });

  describe('updateSummaryStats()', () => {
    beforeEach(() => {
      resultsPanel = new ResultsPanel('results-panel-container');
    });

    it('should update stat values correctly', () => {
      resultsPanel.results.summary = {
        totalFiles: 10,
        processedFiles: 7,
        excludedFiles: 2,
        errorFiles: 1,
        processingTime: 12345
      };
      
      resultsPanel.updateSummaryStats();
      
      expect(container.querySelector('.total-files').textContent).toBe('10');
      expect(container.querySelector('.processed-files').textContent).toBe('7');
      expect(container.querySelector('.excluded-files').textContent).toBe('2');
      expect(container.querySelector('.error-files').textContent).toBe('1');
      expect(container.querySelector('.processing-time').textContent).toBe('12s');
    });
  });

  describe('updateTabCounts()', () => {
    beforeEach(() => {
      resultsPanel = new ResultsPanel('results-panel-container');
    });

    it('should update tab counts correctly', () => {
      resultsPanel.results.processed = [
        { id: 1 }, { id: 2 }, { id: 3 }
      ];
      resultsPanel.results.excluded = [{ id: 4 }];
      resultsPanel.results.errors = [{ id: 5 }];
      
      resultsPanel.updateTabCounts();
      
      expect(container.querySelector('[data-tab="processed"] .tab-count').textContent).toBe('3');
      expect(container.querySelector('[data-tab="excluded"] .tab-count').textContent).toBe('1');
      expect(container.querySelector('[data-tab="errors"] .tab-count').textContent).toBe('1');
    });
  });

  describe('renderTabContent()', () => {
    beforeEach(() => {
      resultsPanel = new ResultsPanel('results-panel-container');
    });

    it('should show empty state when no items', () => {
      resultsPanel.renderTabContent('processed');
      
      const emptyState = container.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
      expect(emptyState.textContent).toContain('No processed files');
    });

    it('should render table when items exist', () => {
      resultsPanel.results.processed = [
        {
          id: 1,
          fileName: 'test.pdf',
          fileSize: 1024,
          processedAt: new Date(),
          result: { pagesProcessed: 3 }
        }
      ];
      
      resultsPanel.renderTabContent('processed');
      
      const table = container.querySelector('.results-table-container');
      expect(table).toBeTruthy();
      
      const rows = table.querySelectorAll('tbody tr');
      expect(rows).toHaveLength(1);
    });
  });

  describe('renderTableHeader()', () => {
    beforeEach(() => {
      resultsPanel = new ResultsPanel('results-panel-container');
    });

    it('should render correct headers for processed tab', () => {
      const html = resultsPanel.renderTableHeader('processed');
      
      expect(html).toContain('File Name');
      expect(html).toContain('Size');
      expect(html).toContain('Pages');
      expect(html).toContain('Processing Time');
      expect(html).toContain('Actions');
    });

    it('should render correct headers for excluded tab', () => {
      const html = resultsPanel.renderTableHeader('excluded');
      
      expect(html).toContain('File Name');
      expect(html).toContain('Size');
      expect(html).toContain('Reason');
      expect(html).toContain('Rule');
      expect(html).not.toContain('Actions');
    });

    it('should render correct headers for errors tab', () => {
      const html = resultsPanel.renderTableHeader('errors');
      
      expect(html).toContain('File Name');
      expect(html).toContain('Size');
      expect(html).toContain('Error');
      expect(html).not.toContain('Actions');
    });
  });

  describe('renderTableRow()', () => {
    beforeEach(() => {
      resultsPanel = new ResultsPanel('results-panel-container');
    });

    it('should render processed row with download link', () => {
      const item = {
        id: 1,
        fileName: 'test.pdf',
        fileSize: 1024,
        processedAt: new Date(),
        result: { pagesProcessed: 3 },
        downloadUrl: 'blob:test-url'
      };
      
      const html = resultsPanel.renderTableRow(item, 'processed');
      
      expect(html).toContain('test.pdf');
      expect(html).toContain('Download');
      expect(html).toContain('Details');
      expect(html).toContain('3 pages processed');
    });

    it('should render processed row without download link', () => {
      const item = {
        id: 1,
        fileName: 'test.pdf',
        fileSize: 1024,
        processedAt: new Date(),
        result: { pagesProcessed: 3 }
      };
      
      const html = resultsPanel.renderTableRow(item, 'processed');
      
      expect(html).toContain('test.pdf');
      expect(html).not.toContain('Download');
    });

    it('should render excluded row with reason and rule', () => {
      const item = {
        id: 1,
        fileName: 'invalid.pdf',
        fileSize: 2048,
        excludedAt: new Date(),
        reason: 'File exceeds size limit',
        rule: 'MAX_SIZE'
      };
      
      const html = resultsPanel.renderTableRow(item, 'excluded');
      
      expect(html).toContain('invalid.pdf');
      expect(html).toContain('File exceeds size limit');
      expect(html).toContain('MAX_SIZE');
    });

    it('should render error row with error details', () => {
      const item = {
        id: 1,
        fileName: 'corrupt.pdf',
        fileSize: 512,
        errorAt: new Date(),
        error: 'Invalid PDF format',
        stack: 'Error: Invalid PDF format\\n    at parsePDF'
      };
      
      const html = resultsPanel.renderTableRow(item, 'errors');
      
      expect(html).toContain('corrupt.pdf');
      expect(html).toContain('Invalid PDF format');
      expect(html).toContain('Show stack trace');
    });
  });

  describe('sortResults()', () => {
    beforeEach(() => {
      resultsPanel = new ResultsPanel('results-panel-container');
    });

    it('should sort by name ascending', () => {
      resultsPanel.sortBy = 'name';
      resultsPanel.sortOrder = 'asc';
      
      const items = [
        { fileName: 'C.pdf', processedAt: new Date() },
        { fileName: 'A.pdf', processedAt: new Date() },
        { fileName: 'B.pdf', processedAt: new Date() }
      ];
      
      const sorted = resultsPanel.sortResults(items);
      
      expect(sorted[0].fileName).toBe('A.pdf');
      expect(sorted[1].fileName).toBe('B.pdf');
      expect(sorted[2].fileName).toBe('C.pdf');
    });

    it('should sort by name descending', () => {
      resultsPanel.sortBy = 'name';
      resultsPanel.sortOrder = 'desc';
      
      const items = [
        { fileName: 'A.pdf', processedAt: new Date() },
        { fileName: 'C.pdf', processedAt: new Date() },
        { fileName: 'B.pdf', processedAt: new Date() }
      ];
      
      const sorted = resultsPanel.sortResults(items);
      
      expect(sorted[0].fileName).toBe('C.pdf');
      expect(sorted[1].fileName).toBe('B.pdf');
      expect(sorted[2].fileName).toBe('A.pdf');
    });

    it('should sort by size', () => {
      resultsPanel.sortBy = 'size';
      resultsPanel.sortOrder = 'asc';
      
      const items = [
        { fileName: 'A.pdf', fileSize: 2048, processedAt: new Date() },
        { fileName: 'B.pdf', fileSize: 1024, processedAt: new Date() },
        { fileName: 'C.pdf', fileSize: 3072, processedAt: new Date() }
      ];
      
      const sorted = resultsPanel.sortResults(items);
      
      expect(sorted[0].fileSize).toBe(1024);
      expect(sorted[1].fileSize).toBe(2048);
      expect(sorted[2].fileSize).toBe(3072);
    });

    it('should sort by date', () => {
      resultsPanel.sortBy = 'date';
      resultsPanel.sortOrder = 'desc';
      
      const now = new Date();
      const items = [
        { fileName: 'A.pdf', processedAt: new Date(now.getTime() - 3000) },
        { fileName: 'B.pdf', processedAt: new Date(now.getTime() - 1000) },
        { fileName: 'C.pdf', processedAt: new Date(now.getTime() - 2000) }
      ];
      
      const sorted = resultsPanel.sortResults(items);
      
      expect(sorted[0].processedAt.getTime()).toBe(now.getTime() - 1000);
      expect(sorted[1].processedAt.getTime()).toBe(now.getTime() - 2000);
      expect(sorted[2].processedAt.getTime()).toBe(now.getTime() - 3000);
    });
  });

  describe('exportResults()', () => {
    beforeEach(() => {
      resultsPanel = new ResultsPanel('results-panel-container');
      
      // Mock URL.createObjectURL and revokeObjectURL
      global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
      global.URL.revokeObjectURL = vi.fn();
      
      // Mock click simulation
      const mockLink = {
        click: vi.fn()
      };
      global.document.createElement = vi.fn(() => ({
        href: '',
        download: '',
        click: mockLink.click
      }));
    });

    afterEach(() => {
      // Restore mocks
      if (global.URL.createObjectURL.mockRestore) {
        global.URL.createObjectURL.mockRestore();
      }
      if (global.URL.revokeObjectURL.mockRestore) {
        global.URL.revokeObjectURL.mockRestore();
      }
      if (global.document.createElement.mockRestore) {
        global.document.createElement.mockRestore();
      }
    });

    it('should export as JSON', () => {
      resultsPanel.results.processed = [
        {
          id: 1,
          fileName: 'test.pdf',
          fileSize: 1024,
          result: { pagesProcessed: 3 }
        }
      ];
      
      resultsPanel.exportResults('json');
      
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(global.document.createElement).toHaveBeenCalledWith('a');
    });

    it('should export as CSV', () => {
      resultsPanel.results.processed = [
        {
          id: 1,
          fileName: 'test.pdf',
          fileSize: 1024,
          result: { pagesProcessed: 3 }
        }
      ];
      
      resultsPanel.exportResults('csv');
      
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should show warning for PDF export', () => {
      resultsPanel.exportResults('pdf');
      
      expect(showToast).toHaveBeenCalledWith('PDF export not implemented yet', 'warning');
    });

    it('should log export action', () => {
      resultsPanel.results.processed = [
        {
          id: 1,
          fileName: 'test.pdf',
          fileSize: 1024,
          result: { pagesProcessed: 3 }
        }
      ];
      
      resultsPanel.exportResults('json');
      
      expect(auditLogger.log).toHaveBeenCalledWith('results_exported', {
        format: 'json',
        fileSize: expect.any(Number),
        recordCount: 1
      });
    });
  });

  describe('convertToCSV()', () => {
    beforeEach(() => {
      resultsPanel = new ResultsPanel('results-panel-container');
    });

    it('should convert processed results to CSV', () => {
      const data = {
        processed: [
          {
            fileName: 'test.pdf',
            fileSize: 1024,
            result: { pagesProcessed: 3 },
            processingTime: 1500,
            processedAt: '2023-01-01T00:00:00.000Z'
          }
        ],
        excluded: [],
        errors: []
      };
      
      const csv = resultsPanel.convertToCSV(data);
      
      expect(csv).toContain('Status,File Name,Size,Details,Rule,Date');
      expect(csv).toContain('Processed,test.pdf,1024,3,,2023-01-01T00:00:00.000Z');
    });

    it('should escape quotes in CSV', () => {
      const data = {
        processed: [
          {
            fileName: 'test "file".pdf',
            fileSize: 1024,
            result: { pagesProcessed: 3 },
            processingTime: 1500,
            processedAt: '2023-01-01T00:00:00.000Z'
          }
        ],
        excluded: [],
        errors: []
      };
      
      const csv = resultsPanel.convertToCSV(data);
      
      expect(csv).toContain('Processed,"test ""file"".pdf');
    });
  });

  describe('clearResults()', () => {
    beforeEach(() => {
      resultsPanel = new ResultsPanel('results-panel-container');
      
      // Add some results
      resultsPanel.results.processed = [{ id: 1, fileName: 'test.pdf' }];
      resultsPanel.results.excluded = [{ id: 2, fileName: 'invalid.pdf' }];
    });

    it('should show confirmation dialog', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      
      resultsPanel.clearResults();
      
      expect(confirmSpy).toHaveBeenCalledWith(
        'Are you sure you want to clear all results?'
      );
    });

    it('should clear all results when confirmed', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      
      resultsPanel.clearResults();
      
      expect(resultsPanel.results.processed).toEqual([]);
      expect(resultsPanel.results.excluded).toEqual([]);
      expect(resultsPanel.results.errors).toEqual([]);
      expect(resultsPanel.results.summary.totalFiles).toBe(0);
    });

    it('should not clear when not confirmed', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      
      resultsPanel.clearResults();
      
      expect(resultsPanel.results.processed).toHaveLength(1);
      expect(resultsPanel.results.excluded).toHaveLength(1);
    });

    it('should show toast when cleared', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      
      resultsPanel.clearResults();
      
      expect(showToast).toHaveBeenCalledWith('Results cleared', 'info');
    });
  });

  describe('formatFileSize()', () => {
    beforeEach(() => {
      resultsPanel = new ResultsPanel('results-panel-container');
    });

    it('should format file sizes correctly', () => {
      expect(resultsPanel.formatFileSize(0)).toBe('0 Bytes');
      expect(resultsPanel.formatFileSize(1024)).toBe('1 KB');
      expect(resultsPanel.formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(resultsPanel.formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });

  describe('formatDuration()', () => {
    beforeEach(() => {
      resultsPanel = new ResultsPanel('results-panel-container');
    });

    it('should format duration correctly', () => {
      expect(resultsPanel.formatDuration(0)).toBe('0s');
      expect(resultsPanel.formatDuration(5000)).toBe('5s');
      expect(resultsPanel.formatDuration(65000)).toBe('1m 5s');
      expect(resultsPanel.formatDuration(3665000)).toBe('1h 1m');
    });
  });

  describe('formatDate()', () => {
    beforeEach(() => {
      resultsPanel = new ResultsPanel('results-panel-container');
    });

    it('should format date correctly', () => {
      const date = new Date('2023-01-01T12:30:45.000Z');
      const formatted = resultsPanel.formatDate(date);
      
      expect(formatted).toContain('2023');
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('1');
      expect(formatted).toMatch(/12:30/);
    });
  });

  describe('getResults()', () => {
    beforeEach(() => {
      resultsPanel = new ResultsPanel('results-panel-container');
    });

    it('should return all results', () => {
      const testResults = {
        processed: [{ id: 1 }],
        excluded: [{ id: 2 }],
        errors: [{ id: 3 }],
        summary: { totalFiles: 3 }
      };
      
      resultsPanel.results = testResults;
      
      expect(resultsPanel.getResults()).toEqual(testResults);
    });
  });
});