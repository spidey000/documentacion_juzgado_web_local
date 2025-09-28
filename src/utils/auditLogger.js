/**
 * Audit Logger Utility
 * 
 * Provides comprehensive logging for audit trail and debugging purposes
 * All actions are logged with timestamps and contextual information
 * 
 * @version 1.0.0
 */

/**
 * AuditLogger Class
 * Manages application audit logs
 */
export class AuditLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000; // Keep last 1000 log entries
    this.storageKey = 'pdf-processor-audit-logs';
    
    // Load logs from localStorage
    this.loadFromStorage();
  }

  /**
   * Log an info message
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  static info(message, data = {}) {
    const logger = new AuditLogger();
    logger.log('info', message, data);
  }

  /**
   * Log a warning message
   * @param {string} message - Warning message
   * @param {Object} data - Additional data to log
   */
  static warning(message, data = {}) {
    const logger = new AuditLogger();
    logger.log('warning', message, data);
  }

  /**
   * Log an error message
   * @param {string} message - Error message
   * @param {Object} data - Additional data to log
   */
  static error(message, data = {}) {
    const logger = new AuditLogger();
    logger.log('error', message, data);
  }

  /**
   * Log a success message
   * @param {string} message - Success message
   * @param {Object} data - Additional data to log
   */
  static success(message, data = {}) {
    const logger = new AuditLogger();
    logger.log('success', message, data);
  }

  /**
   * Log a message with specified level
   * @param {string} level - Log level (info, warning, error, success)
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  log(level, message, data = {}) {
    const entry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Add to logs array
    this.logs.push(entry);

    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Save to localStorage
    this.saveToStorage();

    // Update UI if audit log is visible
    this.updateUI(entry);

    // Also log to console for debugging
    this.logToConsole(entry);
  }

  /**
   * Generate unique ID for log entry
   * @returns {string} Unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Save logs to localStorage
   */
  saveToStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.logs));
    } catch (error) {
      console.error('Failed to save audit logs to localStorage:', error);
    }
  }

  /**
   * Load logs from localStorage
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load audit logs from localStorage:', error);
      this.logs = [];
    }
  }

  /**
   * Update UI with new log entry
   * @param {Object} entry - Log entry
   */
  updateUI(entry) {
    const container = document.getElementById('audit-log-entries');
    if (!container) return;

    // Create log entry element
    const entryElement = document.createElement('div');
    entryElement.className = `audit-log-entry ${entry.level} animate-fadeIn`;
    entryElement.dataset.level = entry.level;
    entryElement.innerHTML = `
      <div class="flex justify-between items-start">
        <div class="flex-1">
          <div class="flex items-center space-x-2">
            <span class="text-xs font-medium text-gray-500">${this.formatTime(entry.timestamp)}</span>
            <span class="badge badge-${entry.level}">${entry.level.toUpperCase()}</span>
          </div>
          <p class="mt-1 text-sm text-gray-900">${this.escapeHtml(entry.message)}</p>
          ${Object.keys(entry.data).length > 0 ? `
            <details class="mt-2">
              <summary class="text-xs text-gray-500 cursor-pointer hover:text-gray-700">Show details</summary>
              <pre class="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">${JSON.stringify(entry.data, null, 2)}</pre>
            </details>
          ` : ''}
        </div>
        <button onclick="this.parentElement.remove()" class="ml-2 text-gray-400 hover:text-gray-600">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    `;

    // Add to top of container
    container.insertBefore(entryElement, container.firstChild);

    // Apply current filter
    const filter = document.getElementById('log-filter')?.value || 'all';
    if (filter !== 'all' && entry.level !== filter) {
      entryElement.style.display = 'none';
    }
  }

  /**
   * Log entry to console with appropriate level
   * @param {Object} entry - Log entry
   */
  logToConsole(entry) {
    const { level, message, data, timestamp } = entry;
    const prefix = `[${timestamp}] ${level.toUpperCase()}:`;
    
    switch (level) {
      case 'error':
        console.error(prefix, message, data);
        break;
      case 'warning':
        console.warn(prefix, message, data);
        break;
      case 'success':
        console.log(`%c${prefix} ${message}`, 'color: green', data);
        break;
      default:
        console.log(prefix, message, data);
    }
  }

  /**
   * Format timestamp for display
   * @param {string} timestamp - ISO timestamp
   * @returns {string} Formatted time
   */
  formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }

  /**
   * Get all logs
   * @returns {Array} Array of log entries
   */
  getLogs() {
    return [...this.logs];
  }

  /**
   * Get logs filtered by level
   * @param {string} level - Log level to filter by
   * @returns {Array} Filtered log entries
   */
  getLogsByLevel(level) {
    return this.logs.filter(entry => entry.level === level);
  }

  /**
   * Clear all logs
   */
  clear() {
    this.logs = [];
    this.saveToStorage();
    
    // Clear UI
    const container = document.getElementById('audit-log-entries');
    if (container) {
      container.innerHTML = '';
    }
  }

  /**
   * Export logs as JSON
   * @returns {Object} Export data
   */
  export() {
    return {
      application: {
        name: __APP_NAME__,
        version: __APP_VERSION__,
      },
      exportDate: new Date().toISOString(),
      logs: this.logs,
      summary: this.getSummary(),
    };
  }

  /**
   * Get logs summary
   * @returns {Object} Summary statistics
   */
  getSummary() {
    const summary = {
      total: this.logs.length,
      info: 0,
      warning: 0,
      error: 0,
      success: 0,
    };

    this.logs.forEach(entry => {
      if (summary.hasOwnProperty(entry.level)) {
        summary[entry.level]++;
      }
    });

    return summary;
  }

  /**
   * Search logs by message
   * @param {string} query - Search query
   * @returns {Array} Matching log entries
   */
  search(query) {
    const lowerQuery = query.toLowerCase();
    return this.logs.filter(entry => 
      entry.message.toLowerCase().includes(lowerQuery) ||
      JSON.stringify(entry.data).toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get logs within date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Array} Log entries within range
   */
  getLogsInRange(startDate, endDate) {
    return this.logs.filter(entry => {
      const entryDate = new Date(entry.timestamp);
      return entryDate >= startDate && entryDate <= endDate;
    });
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();

// Export class as default
export default AuditLogger;