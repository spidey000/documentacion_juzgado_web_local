/**
 * Toast Notification Utility
 * 
 * Provides a simple toast notification system for user feedback
 * 
 * @version 1.0.0
 */

/**
 * Toast Class
 * Manages toast notifications
 */
export class Toast {
  /**
   * Show a toast notification
   * @param {string} message - Message to display
   * @param {string} type - Toast type (success, error, warning, info)
   * @param {number} duration - Duration in milliseconds
   */
  static show(message, type = 'info', duration = 3000) {
    // Create toast container if it doesn't exist
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'fixed bottom-0 right-0 p-4 space-y-2 z-50';
      document.body.appendChild(container);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} shadow-lg rounded-lg p-4 mb-2 transform transition-all duration-300 translate-y-full opacity-0`;
    
    // Create toast content
    const icon = this.getIcon(type);
    toast.innerHTML = `
      <div class="flex items-center">
        <div class="flex-shrink-0">
          ${icon}
        </div>
        <div class="ml-3">
          <p class="text-sm font-medium">${this.escapeHtml(message)}</p>
        </div>
        <div class="ml-auto pl-3">
          <button onclick="this.parentElement.parentElement.remove()" class="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Add to container
    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => {
      toast.classList.remove('translate-y-full', 'opacity-0');
    }, 10);

    // Auto-remove after duration
    const timeoutId = setTimeout(() => {
      this.remove(toast);
    }, duration);

    // Store timeout ID for manual removal
    toast.dataset.timeoutId = timeoutId;

    // Pause on hover
    toast.addEventListener('mouseenter', () => {
      clearTimeout(timeoutId);
    });

    // Resume on mouse leave
    toast.addEventListener('mouseleave', () => {
      const newTimeoutId = setTimeout(() => {
        this.remove(toast);
      }, duration);
      toast.dataset.timeoutId = newTimeoutId;
    });
  }

  /**
   * Remove a toast element
   * @param {HTMLElement} toast - Toast element to remove
   */
  static remove(toast) {
    toast.classList.add('translate-y-full', 'opacity-0');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }

  /**
   * Show success toast
   * @param {string} message - Success message
   * @param {number} duration - Duration in milliseconds
   */
  static success(message, duration) {
    this.show(message, 'success', duration);
  }

  /**
   * Show error toast
   * @param {string} message - Error message
   * @param {number} duration - Duration in milliseconds
   */
  static error(message, duration) {
    this.show(message, 'error', duration || 5000); // Errors stay longer
  }

  /**
   * Show warning toast
   * @param {string} message - Warning message
   * @param {number} duration - Duration in milliseconds
   */
  static warning(message, duration) {
    this.show(message, 'warning', duration);
  }

  /**
   * Show info toast
   * @param {string} message - Info message
   * @param {number} duration - Duration in milliseconds
   */
  static info(message, duration) {
    this.show(message, 'info', duration);
  }

  /**
   * Get icon HTML for toast type
   * @param {string} type - Toast type
   * @returns {string} Icon HTML
   */
  static getIcon(type) {
    const icons = {
      success: `
        <svg class="h-6 w-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      `,
      error: `
        <svg class="h-6 w-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      `,
      warning: `
        <svg class="h-6 w-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>
      `,
      info: `
        <svg class="h-6 w-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      `,
    };

    return icons[type] || icons.info;
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  static escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Clear all toasts
   */
  static clear() {
    const container = document.getElementById('toast-container');
    if (container) {
      container.innerHTML = '';
    }
  }
}

// Export singleton instance for backward compatibility
export default Toast;