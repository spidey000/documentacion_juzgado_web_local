/**
 * Simple Event Bus for application-wide event management
 * 
 * Provides a centralized event system for communication between
 * different components without tight coupling.
 * 
 * @version 1.0.0
 */

/**
 * EventBus Class
 * Implements a publish/subscribe pattern for component communication
 */
export class EventBus {
  constructor() {
    this.events = {};
    this.onceEvents = {};
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {EventBus} Instance for chaining
   */
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
    return this;
  }

  /**
   * Subscribe to an event once
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {EventBus} Instance for chaining
   */
  once(event, callback) {
    if (!this.onceEvents[event]) {
      this.onceEvents[event] = [];
    }
    this.onceEvents[event].push(callback);
    return this;
  }

  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {*} data - Data to pass to callbacks
   * @returns {EventBus} Instance for chaining
   */
  emit(event, data) {
    // Execute regular subscribers
    if (this.events[event]) {
      this.events[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }

    // Execute once subscribers and remove them
    if (this.onceEvents[event]) {
      this.onceEvents[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in once event handler for ${event}:`, error);
        }
      });
      delete this.onceEvents[event];
    }

    return this;
  }

  /**
   * Remove all subscribers for an event
   * @param {string} event - Event name
   * @returns {EventBus} Instance for chaining
   */
  off(event) {
    delete this.events[event];
    delete this.onceEvents[event];
    return this;
  }

  /**
   * Remove a specific callback from an event
   * @param {string} event - Event name
   * @param {Function} callback - Callback to remove
   * @returns {EventBus} Instance for chaining
   */
  removeListener(event, callback) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
    if (this.onceEvents[event]) {
      this.onceEvents[event] = this.onceEvents[event].filter(cb => cb !== callback);
    }
    return this;
  }

  /**
   * Get all event names
   * @returns {string[]} Array of event names
   */
  getEventNames() {
    return [
      ...Object.keys(this.events),
      ...Object.keys(this.onceEvents),
    ];
  }

  /**
   * Get number of listeners for an event
   * @param {string} event - Event name
   * @returns {number} Number of listeners
   */
  listenerCount(event) {
    const regularCount = this.events[event] ? this.events[event].length : 0;
    const onceCount = this.onceEvents[event] ? this.onceEvents[event].length : 0;
    return regularCount + onceCount;
  }

  /**
   * Clear all events
   * @returns {EventBus} Instance for chaining
   */
  clear() {
    this.events = {};
    this.onceEvents = {};
    return this;
  }
}

// Create and export a singleton instance
export const eventBus = new EventBus();

// Export the class as default for custom instances
export default EventBus;