import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditLogger } from '@utils/auditLogger';

describe('AuditLogger', () => {
  let logger;
  let mockStorage;

  beforeEach(() => {
    // Mock localStorage
    mockStorage = {};
    global.localStorage = {
      setItem: vi.fn((key, value) => {
        mockStorage[key] = value;
      }),
      getItem: vi.fn((key) => mockStorage[key] || null)
    };
    
    // Mock navigator and window
    global.navigator = {
      userAgent: 'Mozilla/5.0 Test Browser'
    };
    global.window = {
      location: {
        href: 'http://localhost:3000/'
      }
    };
    
    // Mock document
    global.document = {
      getElementById: vi.fn(),
      createElement: vi.fn(() => ({
        className: '',
        dataset: {},
        innerHTML: '',
        addEventListener: vi.fn(),
        remove: vi.fn(),
        parentElement: { remove: vi.fn() }
      }))
    };
    
    // Mock console
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    
    logger = new AuditLogger();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with empty logs array', () => {
      expect(logger.logs).toEqual([]);
    });

    it('should set maxLogs to 1000', () => {
      expect(logger.maxLogs).toBe(1000);
    });

    it('should load logs from localStorage on creation', () => {
      mockStorage['pdf-processor-audit-logs'] = JSON.stringify([
        { id: 'test', message: 'Test log' }
      ]);
      
      const newLogger = new AuditLogger();
      expect(newLogger.logs).toHaveLength(1);
      expect(newLogger.logs[0].message).toBe('Test log');
    });
  });

  describe('static methods', () => {
    it('info() should create instance and log info', () => {
      const spy = vi.spyOn(AuditLogger.prototype, 'log');
      
      AuditLogger.info('Test info', { data: 'test' });
      
      expect(spy).toHaveBeenCalledWith('info', 'Test info', { data: 'test' });
    });

    it('warning() should create instance and log warning', () => {
      const spy = vi.spyOn(AuditLogger.prototype, 'log');
      
      AuditLogger.warning('Test warning');
      
      expect(spy).toHaveBeenCalledWith('warning', 'Test warning', {});
    });

    it('error() should create instance and log error', () => {
      const spy = vi.spyOn(AuditLogger.prototype, 'log');
      
      AuditLogger.error('Test error');
      
      expect(spy).toHaveBeenCalledWith('error', 'Test error', {});
    });

    it('success() should create instance and log success', () => {
      const spy = vi.spyOn(AuditLogger.prototype, 'log');
      
      AuditLogger.success('Test success');
      
      expect(spy).toHaveBeenCalledWith('success', 'Test success', {});
    });
  });

  describe('log()', () => {
    it('should create log entry with correct structure', () => {
      logger.log('info', 'Test message', { key: 'value' });
      
      expect(logger.logs).toHaveLength(1);
      const entry = logger.logs[0];
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('timestamp');
      expect(entry.level).toBe('info');
      expect(entry.message).toBe('Test message');
      expect(entry.data).toEqual({ key: 'value' });
      expect(entry.userAgent).toBe('Mozilla/5.0 Test Browser');
      expect(entry.url).toBe('http://localhost:3000/');
    });

    it('should save to localStorage', () => {
      logger.log('info', 'Test message');
      
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'pdf-processor-audit-logs',
        JSON.stringify(logger.logs)
      );
    });

    it('should keep only maxLogs entries', () => {
      logger.maxLogs = 2;
      
      logger.log('info', 'Message 1');
      logger.log('info', 'Message 2');
      logger.log('info', 'Message 3');
      
      expect(logger.logs).toHaveLength(2);
      expect(logger.logs[0].message).toBe('Message 2');
      expect(logger.logs[1].message).toBe('Message 3');
    });

    it('should call updateUI with log entry', () => {
      const spy = vi.spyOn(logger, 'updateUI');
      
      logger.log('info', 'Test message');
      
      expect(spy).toHaveBeenCalledWith(logger.logs[0]);
    });

    it('should call logToConsole with log entry', () => {
      const spy = vi.spyOn(logger, 'logToConsole');
      
      logger.log('error', 'Test message');
      
      expect(spy).toHaveBeenCalledWith(logger.logs[0]);
    });
  });

  describe('generateId()', () => {
    it('should generate unique IDs', () => {
      const id1 = logger.generateId();
      const id2 = logger.generateId();
      
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
    });
  });

  describe('saveToStorage()', () => {
    it('should handle localStorage errors gracefully', () => {
      localStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      expect(() => logger.saveToStorage()).not.toThrow();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('loadFromStorage()', () => {
    it('should handle invalid JSON gracefully', () => {
      localStorage.getItem.mockReturnValue('invalid json');
      
      logger.loadFromStorage();
      
      expect(logger.logs).toEqual([]);
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle null storage', () => {
      localStorage.getItem.mockReturnValue(null);
      
      logger.loadFromStorage();
      
      expect(logger.logs).toEqual([]);
    });
  });

  describe('updateUI()', () => {
    it('should do nothing if container not found', () => {
      document.getElementById.mockReturnValue(null);
      
      expect(() => logger.updateUI({})).not.toThrow();
    });

    it('should create and append log entry element', () => {
      const mockContainer = {
        insertBefore: vi.fn(),
        getElementsByTagName: vi.fn(() => [])
      };
      document.getElementById.mockReturnValue(mockContainer);
      
      const entry = {
        level: 'info',
        message: 'Test message',
        timestamp: new Date().toISOString(),
        data: { key: 'value' }
      };
      
      logger.updateUI(entry);
      
      expect(document.createElement).toHaveBeenCalled();
      expect(mockContainer.insertBefore).toHaveBeenCalled();
    });

    it('should apply filter if exists', () => {
      const mockContainer = {
        insertBefore: vi.fn(),
        getElementsByTagName: vi.fn(() => [])
      };
      const mockFilter = { value: 'error' };
      document.getElementById
        .mockReturnValueOnce(mockContainer)
        .mockReturnValueOnce(mockFilter);
      
      const entry = {
        level: 'info',
        message: 'Test message',
        timestamp: new Date().toISOString(),
        data: {}
      };
      
      logger.updateUI(entry);
      
      const element = document.createElement.mock.results[0].value;
      expect(element.style.display).toBe('none');
    });
  });

  describe('logToConsole()', () => {
    beforeEach(() => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should log error with console.error', () => {
      const entry = {
        level: 'error',
        message: 'Test error',
        timestamp: '2023-01-01T00:00:00.000Z',
        data: {}
      };
      
      logger.logToConsole(entry);
      
      expect(console.error).toHaveBeenCalledWith(
        '[2023-01-01T00:00:00.000Z] ERROR: Test error',
        {}
      );
    });

    it('should log warning with console.warn', () => {
      const entry = {
        level: 'warning',
        message: 'Test warning',
        timestamp: '2023-01-01T00:00:00.000Z',
        data: {}
      };
      
      logger.logToConsole(entry);
      
      expect(console.warn).toHaveBeenCalledWith(
        '[2023-01-01T00:00:00.000Z] WARNING: Test warning',
        {}
      );
    });

    it('should log success with styled console.log', () => {
      const entry = {
        level: 'success',
        message: 'Test success',
        timestamp: '2023-01-01T00:00:00.000Z',
        data: {}
      };
      
      logger.logToConsole(entry);
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('color: green'),
        'Test success',
        {}
      );
    });
  });

  describe('formatTime()', () => {
    it('should format timestamp correctly', () => {
      const timestamp = '2023-01-01T12:30:45.000Z';
      const formatted = logger.formatTime(timestamp);
      
      expect(formatted).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    });
  });

  describe('getLogs()', () => {
    it('should return copy of logs array', () => {
      logger.logs = [{ id: '1' }, { id: '2' }];
      
      const logs = logger.getLogs();
      
      expect(logs).toEqual(logger.logs);
      expect(logs).not.toBe(logger.logs);
    });
  });

  describe('getLogsByLevel()', () => {
    beforeEach(() => {
      logger.logs = [
        { level: 'info', message: 'Info 1' },
        { level: 'error', message: 'Error 1' },
        { level: 'info', message: 'Info 2' }
      ];
    });

    it('should filter logs by level', () => {
      const infoLogs = logger.getLogsByLevel('info');
      
      expect(infoLogs).toHaveLength(2);
      expect(infoLogs.every(log => log.level === 'info')).toBe(true);
    });

    it('should return empty array for non-existent level', () => {
      const warningLogs = logger.getLogsByLevel('warning');
      
      expect(warningLogs).toEqual([]);
    });
  });

  describe('clear()', () => {
    it('should clear all logs', () => {
      logger.logs = [{ id: '1' }, { id: '2' }];
      
      logger.clear();
      
      expect(logger.logs).toEqual([]);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'pdf-processor-audit-logs',
        '[]'
      );
    });

    it('should clear UI if container exists', () => {
      const mockContainer = { innerHTML: 'content' };
      document.getElementById.mockReturnValue(mockContainer);
      
      logger.clear();
      
      expect(mockContainer.innerHTML).toBe('');
    });
  });

  describe('export()', () => {
    beforeEach(() => {
      global.__APP_NAME__ = 'Test App';
      global.__APP_VERSION__ = '1.0.0';
    });

    afterEach(() => {
      delete global.__APP_NAME__;
      delete global.__APP_VERSION__;
    });

    it('should export with correct structure', () => {
      logger.logs = [
        { level: 'info', message: 'Test log' }
      ];
      
      const exported = logger.export();
      
      expect(exported).toHaveProperty('application');
      expect(exported).toHaveProperty('exportDate');
      expect(exported).toHaveProperty('logs');
      expect(exported).toHaveProperty('summary');
      expect(exported.application.name).toBe('Test App');
      expect(exported.application.version).toBe('1.0.0');
    });
  });

  describe('getSummary()', () => {
    it('should count logs by level', () => {
      logger.logs = [
        { level: 'info' },
        { level: 'info' },
        { level: 'error' },
        { level: 'warning' },
        { level: 'success' },
        { level: 'debug' } // Unknown level
      ];
      
      const summary = logger.getSummary();
      
      expect(summary.total).toBe(6);
      expect(summary.info).toBe(2);
      expect(summary.error).toBe(1);
      expect(summary.warning).toBe(1);
      expect(summary.success).toBe(1);
    });
  });

  describe('search()', () => {
    beforeEach(() => {
      logger.logs = [
        { message: 'Test message', data: { type: 'test' } },
        { message: 'Another log', data: { status: 'ok' } },
        { message: 'Error occurred', data: { error: 'failed' } }
      ];
    });

    it('should search in messages', () => {
      const results = logger.search('test');
      
      expect(results).toHaveLength(1);
      expect(results[0].message).toBe('Test message');
    });

    it('should search in data', () => {
      const results = logger.search('failed');
      
      expect(results).toHaveLength(1);
      expect(results[0].message).toBe('Error occurred');
    });

    it('should be case insensitive', () => {
      const results = logger.search('ERROR');
      
      expect(results).toHaveLength(1);
      expect(results[0].message).toBe('Error occurred');
    });
  });

  describe('getLogsInRange()', () => {
    beforeEach(() => {
      logger.logs = [
        { timestamp: '2023-01-01T10:00:00.000Z' },
        { timestamp: '2023-01-01T12:00:00.000Z' },
        { timestamp: '2023-01-01T14:00:00.000Z' }
      ];
    });

    it('should return logs within date range', () => {
      const startDate = new Date('2023-01-01T11:00:00.000Z');
      const endDate = new Date('2023-01-01T13:00:00.000Z');
      
      const results = logger.getLogsInRange(startDate, endDate);
      
      expect(results).toHaveLength(1);
      expect(results[0].timestamp).toBe('2023-01-01T12:00:00.000Z');
    });

    it('should include start and end dates', () => {
      const startDate = new Date('2023-01-01T10:00:00.000Z');
      const endDate = new Date('2023-01-01T14:00:00.000Z');
      
      const results = logger.getLogsInRange(startDate, endDate);
      
      expect(results).toHaveLength(3);
    });
  });

  describe('escapeHtml()', () => {
    it('should escape HTML entities', () => {
      const input = '<div>& " \'</div>';
      const escaped = logger.escapeHtml(input);
      
      expect(escaped).toBe('&lt;div&gt;&amp; &quot; &#039;&lt;/div&gt;');
    });
  });
});