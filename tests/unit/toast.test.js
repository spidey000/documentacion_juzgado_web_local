import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Toast } from '@utils/toast';
import { waitFor } from '@testing-library/dom';

describe('Toast', () => {
  let originalDocument;
  let mockContainer;

  beforeEach(() => {
    // Mock document methods
    originalDocument = global.document;
    mockContainer = {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      innerHTML: '',
      className: ''
    };
    
    global.document = {
      ...originalDocument,
      getElementById: vi.fn((id) => id === 'toast-container' ? mockContainer : null),
      createElement: vi.fn((tag) => {
        const element = {
          tagName: tag.toUpperCase(),
          className: '',
          innerHTML: '',
          dataset: {},
          classList: {
            add: vi.fn(),
            remove: vi.fn(),
            contains: vi.fn()
          },
          addEventListener: vi.fn(),
          remove: vi.fn()
        };
        return element;
      }),
      body: {
        appendChild: vi.fn()
      }
    };
    
    // Mock setTimeout
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.document = originalDocument;
    vi.restoreAllMocks();
  });

  describe('show()', () => {
    it('should create container if it doesn\'t exist', () => {
      document.getElementById.mockReturnValue(null);
      
      Toast.show('Test message');
      
      expect(document.createElement).toHaveBeenCalledWith('div');
      expect(document.body.appendChild).toHaveBeenCalled();
    });

    it('should use existing container', () => {
      document.getElementById.mockReturnValue(mockContainer);
      
      Toast.show('Test message');
      
      expect(document.body.appendChild).not.toHaveBeenCalled();
    });

    it('should create toast element with correct classes', () => {
      document.getElementById.mockReturnValue(mockContainer);
      
      Toast.show('Test message', 'success');
      
      const toastElement = document.createElement.mock.results[0].value;
      expect(toastElement.className).toContain('toast-success');
      expect(toastElement.className).toContain('translate-y-full');
      expect(toastElement.className).toContain('opacity-0');
    });

    it('should escape HTML in message', () => {
      document.getElementById.mockReturnValue(mockContainer);
      
      Toast.show('<script>alert("xss")</script>');
      
      const toastElement = document.createElement.mock.results[0].value;
      expect(toastElement.innerHTML).not.toContain('<script>');
      expect(toastElement.innerHTML).toContain('&lt;script&gt;');
    });

    it('should set auto-remove timeout', () => {
      document.getElementById.mockReturnValue(mockContainer);
      
      Toast.show('Test message', 'info', 3000);
      
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 3000);
    });

    it('should add hover pause behavior', () => {
      document.getElementById.mockReturnValue(mockContainer);
      
      Toast.show('Test message');
      
      const toastElement = document.createElement.mock.results[0].value;
      expect(toastElement.addEventListener).toHaveBeenCalledWith('mouseenter', expect.any(Function));
      expect(toastElement.addEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));
    });

    it('should trigger animation after creation', () => {
      document.getElementById.mockReturnValue(mockContainer);
      
      Toast.show('Test message');
      
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 10);
    });
  });

  describe('remove()', () => {
    it('should add removal classes and remove element', () => {
      const toast = {
        classList: {
          add: vi.fn()
        },
        remove: vi.fn()
      };
      
      Toast.remove(toast);
      
      expect(toast.classList.add).toHaveBeenCalledWith('translate-y-full', 'opacity-0');
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 300);
    });
  });

  describe('success()', () => {
    it('should call show with success type', () => {
      const spy = vi.spyOn(Toast, 'show');
      
      Toast.success('Success message', 2000);
      
      expect(spy).toHaveBeenCalledWith('Success message', 'success', 2000);
    });
  });

  describe('error()', () => {
    it('should call show with error type and default duration', () => {
      const spy = vi.spyOn(Toast, 'show');
      
      Toast.error('Error message');
      
      expect(spy).toHaveBeenCalledWith('Error message', 'error', 5000);
    });

    it('should use custom duration when provided', () => {
      const spy = vi.spyOn(Toast, 'show');
      
      Toast.error('Error message', 3000);
      
      expect(spy).toHaveBeenCalledWith('Error message', 'error', 3000);
    });
  });

  describe('warning()', () => {
    it('should call show with warning type', () => {
      const spy = vi.spyOn(Toast, 'show');
      
      Toast.warning('Warning message', 2000);
      
      expect(spy).toHaveBeenCalledWith('Warning message', 'warning', 2000);
    });
  });

  describe('info()', () => {
    it('should call show with info type', () => {
      const spy = vi.spyOn(Toast, 'show');
      
      Toast.info('Info message', 2000);
      
      expect(spy).toHaveBeenCalledWith('Info message', 'info', 2000);
    });
  });

  describe('getIcon()', () => {
    it('should return correct icon for success', () => {
      const icon = Toast.getIcon('success');
      expect(icon).toContain('text-green-400');
      expect(icon).toContain('path stroke-linecap');
    });

    it('should return correct icon for error', () => {
      const icon = Toast.getIcon('error');
      expect(icon).toContain('text-red-400');
    });

    it('should return correct icon for warning', () => {
      const icon = Toast.getIcon('warning');
      expect(icon).toContain('text-yellow-400');
    });

    it('should return correct icon for info', () => {
      const icon = Toast.getIcon('info');
      expect(icon).toContain('text-blue-400');
    });

    it('should return info icon for unknown type', () => {
      const icon = Toast.getIcon('unknown');
      expect(icon).toContain('text-blue-400');
    });
  });

  describe('escapeHtml()', () => {
    it('should escape HTML entities', () => {
      const input = '<div>& " \'</div>';
      const escaped = Toast.escapeHtml(input);
      
      expect(escaped).toBe('&lt;div&gt;&amp; &quot; &#039;&lt;/div&gt;');
    });

    it('should handle empty string', () => {
      expect(Toast.escapeHtml('')).toBe('');
    });

    it('should handle string without HTML', () => {
      expect(Toast.escapeHtml('plain text')).toBe('plain text');
    });
  });

  describe('clear()', () => {
    it('should clear all toasts from container', () => {
      mockContainer.innerHTML = '<div>Toast 1</div><div>Toast 2</div>';
      
      Toast.clear();
      
      expect(mockContainer.innerHTML).toBe('');
    });

    it('should do nothing if container doesn\'t exist', () => {
      document.getElementById.mockReturnValue(null);
      
      expect(() => Toast.clear()).not.toThrow();
    });
  });

  describe('lifecycle', () => {
    it('should handle complete toast lifecycle', async () => {
      document.getElementById.mockReturnValue(mockContainer);
      
      // Show toast
      Toast.show('Test message');
      
      // Simulate animation start
      vi.advanceTimersByTime(10);
      
      // Simulate auto-removal
      const timeoutCallback = setTimeout.mock.calls[0][0];
      timeoutCallback();
      
      // Verify removal animation
      const toastElement = document.createElement.mock.results[0].value;
      expect(toastElement.classList.add).toHaveBeenCalledWith('translate-y-full', 'opacity-0');
    });

    it('should handle hover pause during auto-removal', () => {
      document.getElementById.mockReturnValue(mockContainer);
      
      Toast.show('Test message');
      
      const toastElement = document.createElement.mock.results[0].value;
      
      // Get mouseenter handler
      const mouseenterHandler = toastElement.addEventListener.mock.calls.find(
        call => call[0] === 'mouseenter'
      )[1];
      
      // Get original timeout
      const originalTimeout = setTimeout.mock.calls[0][0];
      vi.clearAllTimers();
      
      // Simulate hover
      mouseenterHandler();
      
      // Verify timeout was cleared
      expect(clearTimeout).toHaveBeenCalled();
      
      // Get mouseleave handler
      const mouseleaveHandler = toastElement.addEventListener.mock.calls.find(
        call => call[0] === 'mouseleave'
      )[1];
      
      // Simulate mouse leave
      mouseleaveHandler();
      
      // Verify new timeout was set
      expect(setTimeout).toHaveBeenCalled();
    });
  });

  describe('multiple toasts', () => {
    it('should show multiple toasts', () => {
      document.getElementById.mockReturnValue(mockContainer);
      
      Toast.show('First message');
      Toast.show('Second message');
      
      expect(mockContainer.appendChild).toHaveBeenCalledTimes(2);
    });
  });
});