/**
 * FileOrganizer Component
 * 
 * Handles file organization including sorting, drag-and-drop reordering,
 * and custom ordering with localStorage persistence.
 * 
 * @version 1.0.0
 */

import { eventBus } from '../utils/eventBus.js';
import { auditLogger } from '../utils/auditLogger.js';
import { Toast } from '../utils/toast.js';

/**
 * FileOrganizer Class
 * Manages file organization with multiple ordering options
 */
export class FileOrganizer {
  /**
   * Create a new FileOrganizer instance
   * @param {string} containerId - Container element ID
   * @param {Array} files - Initial file list
   * @param {Object} options - Configuration options
   */
  constructor(containerId, files = [], options = {}) {
    this.containerId = containerId;
    this.files = files.map(file => ({
      ...file,
      id: file.id || this.generateId(),
      order: file.order || 0
    }));
    
    this.options = {
      enableDragDrop: options.enableDragDrop !== false,
      enableLocalStorage: options.enableLocalStorage !== false,
      storageKey: options.storageKey || 'file-organizer-orders',
      showMoveButtons: options.showMoveButtons !== false,
      responsiveBreakpoint: options.responsiveBreakpoint || 768,
      ...options
    };

    // State
    this.state = {
      mode: 'view', // 'view', 'drag', 'list'
      sortBy: null,
      sortDirection: 'asc',
      isDragging: false,
      draggedElement: null,
      savedOrders: []
    };

    // Sort configurations
    this.sortCriteria = {
      filename: {
        asc: (a, b) => a.name.localeCompare(b.name),
        desc: (a, b) => b.name.localeCompare(a.name)
      },
      date: {
        asc: (a, b) => new Date(a.uploadedAt || 0) - new Date(b.uploadedAt || 0),
        desc: (a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0)
      },
      size: {
        asc: (a, b) => (a.size || 0) - (b.size || 0),
        desc: (a, b) => (b.size || 0) - (a.size || 0)
      },
      type: {
        asc: (a, b) => (a.type || '').localeCompare(b.type || ''),
        desc: (a, b) => (b.type || '').localeCompare(a.type || '')
      }
    };

    // Initialize
    this.init();
  }

  /**
   * Initialize the FileOrganizer
   */
  init() {
    // Get container element
    this.container = document.getElementById(this.containerId);
    if (!this.container) {
      throw new Error(`Container element with ID '${this.containerId}' not found`);
    }

    // Load saved orders
    this.loadSavedOrders();

    // Render initial UI
    this.render();

    // Set up event listeners
    this.setupEventListeners();

    // Log initialization
    auditLogger.info('FileOrganizer initialized', {
      fileCount: this.files.length,
      options: this.options
    });
  }

  /**
   * Render the FileOrganizer UI
   */
  render() {
    this.container.innerHTML = `
      <div class="file-organizer">
        <!-- Controls -->
        <div class="organizer-controls mb-4 flex flex-wrap gap-4 items-center">
          <!-- Sort Options -->
          <div class="sort-controls flex items-center gap-2">
            <label class="text-sm font-medium text-gray-700">Sort by:</label>
            <select id="sort-criteria" class="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Custom Order</option>
              <option value="filename">Filename</option>
              <option value="date">Date</option>
              <option value="size">Size</option>
              <option value="type">Type</option>
            </select>
            <select id="sort-direction" class="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${this.state.sortBy ? '' : 'hidden'}">
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>

          <!-- Mode Toggle -->
          <div class="mode-controls flex items-center gap-2">
            <button id="view-mode-btn" class="px-3 py-1 text-sm rounded-md ${this.state.mode === 'view' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'} hover:bg-blue-600 transition-colors">
              View
            </button>
            <button id="drag-mode-btn" class="px-3 py-1 text-sm rounded-md ${this.state.mode === 'drag' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'} hover:bg-blue-600 transition-colors">
              Drag
            </button>
            <button id="list-mode-btn" class="px-3 py-1 text-sm rounded-md ${this.state.mode === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'} hover:bg-blue-600 transition-colors">
              List
            </button>
          </div>

          <!-- Save/Load Orders -->
          <div class="order-controls flex items-center gap-2">
            <input type="text" id="order-name" placeholder="Order name" class="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <button id="save-order-btn" class="px-3 py-1 text-sm bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors">
              Save Order
            </button>
            <select id="load-order-select" class="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Load Order</option>
              ${this.state.savedOrders.map(order => `
                <option value="${order.name}">${order.name}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <!-- File List Container -->
        <div id="file-list-container" class="file-list-container">
          ${this.renderFileList()}
        </div>

        <!-- Drag Overlay -->
        <div id="drag-overlay" class="fixed inset-0 bg-black bg-opacity-25 pointer-events-none hidden z-50">
          <div class="drag-feedback absolute bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg pointer-events-none hidden">
            Moving file...
          </div>
        </div>
      </div>
    `;

    // Apply drag mode classes if needed
    if (this.state.mode === 'drag') {
      this.container.classList.add('drag-mode');
    }
  }

  /**
   * Render file list based on current mode
   * @returns {string} HTML for file list
   */
  renderFileList() {
    if (this.files.length === 0) {
      return '<div class="text-center text-gray-500 py-8">No files to organize</div>';
    }

    const isMobile = window.innerWidth < this.options.responsiveBreakpoint;

    if (this.state.mode === 'list') {
      return this.renderListMode();
    }

    return `
      <div class="file-list grid gap-3 ${this.state.mode === 'drag' ? 'drag-area' : ''}" 
           ${this.state.mode === 'drag' ? 'data-drag-area="true"' : ''}>
        ${this.files.map((file, index) => this.renderFileItem(file, index, isMobile)).join('')}
      </div>
    `;
  }

  /**
   * Render a single file item
   * @param {Object} file - File object
   * @param {number} index - File index
   * @param {boolean} isMobile - Whether on mobile view
   * @returns {string} HTML for file item
   */
  renderFileItem(file, index, isMobile) {
    const fileSize = this.formatFileSize(file.size || 0);
    const uploadDate = file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString() : 'Unknown';
    
    return `
      <div class="file-item bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow ${this.state.mode === 'drag' ? 'draggable' : ''}" 
           data-file-id="${file.id}"
           data-index="${index}"
           draggable="${this.state.mode === 'drag'}">
        
        ${this.state.mode === 'list' ? `
          <div class="list-item flex items-center gap-4">
            ${this.options.showMoveButtons && !isMobile ? `
              <div class="move-buttons flex flex-col gap-1">
                <button class="move-up-btn p-1 text-gray-400 hover:text-blue-500 transition-colors" data-index="${index}" ${index === 0 ? 'disabled' : ''}>
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
                  </svg>
                </button>
                <button class="move-down-btn p-1 text-gray-400 hover:text-blue-500 transition-colors" data-index="${index}" ${index === this.files.length - 1 ? 'disabled' : ''}>
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </button>
              </div>
            ` : ''}
            
            <div class="drag-handle ${this.state.mode === 'drag' ? 'block' : 'hidden'}">
              <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"></path>
              </svg>
            </div>
            
            <div class="file-icon flex-shrink-0">
              <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </div>
            
            <div class="file-info flex-1 min-w-0">
              <h3 class="font-medium text-gray-900 truncate">${this.escapeHtml(file.name)}</h3>
              <div class="flex flex-wrap gap-2 text-sm text-gray-500 mt-1">
                <span>Size: ${fileSize}</span>
                <span>•</span>
                <span>Added: ${uploadDate}</span>
                ${file.type ? `<span>•</span><span>Type: ${file.type}</span>` : ''}
              </div>
            </div>
            
            <div class="file-position text-sm font-medium text-gray-400">
              #${index + 1}
            </div>
          </div>
        ` : `
          <div class="flex items-start gap-3">
            <div class="drag-handle ${this.state.mode === 'drag' ? 'block' : 'hidden'}">
              <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"></path>
              </svg>
            </div>
            
            <div class="file-icon flex-shrink-0">
              <svg class="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </div>
            
            <div class="file-info flex-1">
              <h3 class="font-medium text-gray-900">${this.escapeHtml(file.name)}</h3>
              <div class="flex flex-wrap gap-2 text-sm text-gray-500 mt-1">
                <span>${fileSize}</span>
                <span>•</span>
                <span>${uploadDate}</span>
                ${file.type ? `<span>•</span><span>${file.type}</span>` : ''}
              </div>
            </div>
            
            <div class="file-position text-lg font-bold text-blue-500">
              ${index + 1}
            </div>
          </div>
        `}
      </div>
    `;
  }

  /**
   * Render list mode with move buttons
   * @returns {string} HTML for list mode
   */
  renderListMode() {
    return `
      <div class="list-mode bg-white rounded-lg shadow overflow-hidden">
        <div class="divide-y divide-gray-200">
          ${this.files.map((file, index) => `
            <div class="list-item p-4 hover:bg-gray-50 transition-colors">
              <div class="flex items-center gap-4">
                <div class="move-buttons flex flex-col gap-1">
                  <button class="move-up-btn p-1 text-gray-400 hover:text-blue-500 transition-colors" data-index="${index}" ${index === 0 ? 'disabled' : ''}>
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
                    </svg>
                  </button>
                  <button class="move-down-btn p-1 text-gray-400 hover:text-blue-500 transition-colors" data-index="${index}" ${index === this.files.length - 1 ? 'disabled' : ''}>
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                  </button>
                </div>
                
                <div class="file-icon flex-shrink-0">
                  <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                </div>
                
                <div class="file-info flex-1">
                  <h3 class="font-medium text-gray-900">${this.escapeHtml(file.name)}</h3>
                  <div class="flex gap-4 text-sm text-gray-500 mt-1">
                    <span>Size: ${this.formatFileSize(file.size || 0)}</span>
                    <span>Position: ${index + 1}</span>
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Sort controls
    const sortCriteria = this.container.querySelector('#sort-criteria');
    const sortDirection = this.container.querySelector('#sort-direction');
    
    sortCriteria?.addEventListener('change', (e) => {
      const criteria = e.target.value;
      this.state.sortBy = criteria;
      
      // Show/hide direction selector
      if (sortDirection) {
        sortDirection.classList.toggle('hidden', !criteria);
      }
      
      if (criteria) {
        this.sortBy(criteria, this.state.sortDirection);
      } else {
        // Reset to custom order
        this.renderFileList();
      }
    });
    
    sortDirection?.addEventListener('change', (e) => {
      this.state.sortDirection = e.target.value;
      if (this.state.sortBy) {
        this.sortBy(this.state.sortBy, this.state.sortDirection);
      }
    });

    // Mode buttons
    this.container.querySelector('#view-mode-btn')?.addEventListener('click', () => {
      this.setMode('view');
    });
    
    this.container.querySelector('#drag-mode-btn')?.addEventListener('click', () => {
      this.setMode('drag');
    });
    
    this.container.querySelector('#list-mode-btn')?.addEventListener('click', () => {
      this.setMode('list');
    });

    // Save/Load orders
    this.container.querySelector('#save-order-btn')?.addEventListener('click', () => {
      const orderName = this.container.querySelector('#order-name')?.value.trim();
      if (orderName) {
        this.saveOrder(orderName);
        this.container.querySelector('#order-name').value = '';
      } else {
        Toast.warning('Please enter an order name');
      }
    });
    
    this.container.querySelector('#load-order-select')?.addEventListener('change', (e) => {
      const orderName = e.target.value;
      if (orderName) {
        this.loadOrder(orderName);
        e.target.value = '';
      }
    });

    // Move buttons (for list mode)
    this.container.addEventListener('click', (e) => {
      if (e.target.closest('.move-up-btn')) {
        const index = parseInt(e.target.closest('.move-up-btn').dataset.index);
        this.moveFile(index, index - 1);
      } else if (e.target.closest('.move-down-btn')) {
        const index = parseInt(e.target.closest('.move-down-btn').dataset.index);
        this.moveFile(index, index + 1);
      }
    });

    // Drag and drop (for drag mode)
    if (this.state.mode === 'drag') {
      this.setupDragAndDrop();
    }

    // Window resize for responsive behavior
    window.addEventListener('resize', () => {
      this.handleResize();
    });
  }

  /**
   * Set the current mode
   * @param {string} mode - Mode to set ('view', 'drag', 'list')
   */
  setMode(mode) {
    this.state.mode = mode;
    
    // Update button states
    this.container.querySelectorAll('.mode-controls button').forEach(btn => {
      btn.classList.remove('bg-blue-500', 'text-white');
      btn.classList.add('bg-gray-200', 'text-gray-700');
    });
    
    const activeBtn = this.container.querySelector(`#${mode}-mode-btn`);
    if (activeBtn) {
      activeBtn.classList.remove('bg-gray-200', 'text-gray-700');
      activeBtn.classList.add('bg-blue-500', 'text-white');
    }

    // Update container class
    this.container.classList.toggle('drag-mode', mode === 'drag');

    // Re-render
    this.renderFileList();
    
    // Set up drag and drop if needed
    if (mode === 'drag') {
      this.setupDragAndDrop();
    }

    // Log mode change
    auditLogger.info('FileOrganizer mode changed', { mode });
  }

  /**
   * Sort files by criteria
   * @param {string} criteria - Sort criteria ('filename', 'date', 'size', 'type')
   * @param {string} direction - Sort direction ('asc', 'desc')
   */
  sortBy(criteria, direction = 'asc') {
    if (!this.sortCriteria[criteria] || !this.sortCriteria[criteria][direction]) {
      Toast.error('Invalid sort criteria');
      return;
    }

    // Sort files
    this.files.sort(this.sortCriteria[criteria][direction]);
    
    // Update state
    this.state.sortBy = criteria;
    this.state.sortDirection = direction;
    
    // Re-render
    this.renderFileList();
    
    // Emit event
    eventBus.emit('sortApplied', {
      criteria,
      direction,
      newOrder: this.files.map(f => f.id)
    });
    
    // Show toast
    const directionText = direction === 'asc' ? 'Ascending' : 'Descending';
    Toast.success(`Files sorted by ${criteria} (${directionText})`);
    
    // Log sort
    auditLogger.info('Files sorted', { criteria, direction });
  }

  /**
   * Enable drag mode
   */
  enableDragMode() {
    this.setMode('drag');
  }

  /**
   * Disable drag mode
   */
  disableDragMode() {
    this.setMode('view');
  }

  /**
   * Move file from one index to another
   * @param {number} fromIndex - Source index
   * @param {number} toIndex - Destination index
   */
  moveFile(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.files.length || 
        toIndex < 0 || toIndex >= this.files.length) {
      return;
    }

    // Move file
    const [movedFile] = this.files.splice(fromIndex, 1);
    this.files.splice(toIndex, 0, movedFile);
    
    // Re-render
    this.renderFileList();
    
    // Emit event
    eventBus.emit('fileOrderChanged', {
      newOrder: this.files.map(f => f.id),
      movedFile: movedFile.id,
      fromIndex,
      toIndex
    });
    
    // Log move
    auditLogger.info('File moved', {
      fileId: movedFile.id,
      fromIndex,
      toIndex
    });
  }

  /**
   * Save current order to localStorage
   * @param {string} name - Name for the saved order
   */
  saveOrder(name) {
    if (!this.options.enableLocalStorage) {
      Toast.warning('Local storage is disabled');
      return;
    }

    const order = {
      name,
      files: this.files.map((file, index) => ({
        id: file.id,
        order: index
      })),
      savedAt: new Date().toISOString()
    };

    // Get existing orders
    const orders = this.getSavedOrders();
    
    // Update or add order
    const existingIndex = orders.findIndex(o => o.name === name);
    if (existingIndex >= 0) {
      orders[existingIndex] = order;
    } else {
      orders.push(order);
    }

    // Save to localStorage
    try {
      localStorage.setItem(this.options.storageKey, JSON.stringify(orders));
      
      // Update state
      this.state.savedOrders = orders;
      
      // Update UI
      const select = this.container.querySelector('#load-order-select');
      if (select) {
        select.innerHTML = `
          <option value="">Load Order</option>
          ${orders.map(o => `<option value="${o.name}">${o.name}</option>`).join('')}
        `;
      }
      
      Toast.success(`Order "${name}" saved successfully`);
      
      // Log save
      auditLogger.info('Order saved', { name, fileCount: this.files.length });
      
    } catch (error) {
      Toast.error('Failed to save order');
      auditLogger.error('Failed to save order', { error: error.message });
    }
  }

  /**
   * Load order from localStorage
   * @param {string} name - Name of the order to load
   */
  loadOrder(name) {
    if (!this.options.enableLocalStorage) {
      Toast.warning('Local storage is disabled');
      return;
    }

    const orders = this.getSavedOrders();
    const order = orders.find(o => o.name === name);
    
    if (!order) {
      Toast.error(`Order "${name}" not found`);
      return;
    }

    // Create a map of file positions
    const positionMap = new Map(order.files.map(f => [f.id, f.order]));
    
    // Sort files based on saved order
    this.files.sort((a, b) => {
      const aPos = positionMap.get(a.id) ?? Infinity;
      const bPos = positionMap.get(b.id) ?? Infinity;
      return aPos - bPos;
    });

    // Reset sort criteria
    this.state.sortBy = null;
    this.state.sortDirection = 'asc';
    
    // Update UI
    const sortCriteria = this.container.querySelector('#sort-criteria');
    const sortDirection = this.container.querySelector('#sort-direction');
    if (sortCriteria) sortCriteria.value = '';
    if (sortDirection) sortDirection.classList.add('hidden');
    
    this.renderFileList();
    
    // Emit event
    eventBus.emit('fileOrderChanged', {
      newOrder: this.files.map(f => f.id),
      loadedOrder: name
    });
    
    Toast.success(`Order "${name}" loaded successfully`);
    
    // Log load
    auditLogger.info('Order loaded', { name });
  }

  /**
   * Get all saved orders from localStorage
   * @returns {Array} Array of saved orders
   */
  getSavedOrders() {
    if (!this.options.enableLocalStorage) {
      return [];
    }

    try {
      const stored = localStorage.getItem(this.options.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load saved orders:', error);
      return [];
    }
  }

  /**
   * Load saved orders into state
   */
  loadSavedOrders() {
    this.state.savedOrders = this.getSavedOrders();
  }

  /**
   * Set up drag and drop functionality
   */
  setupDragAndDrop() {
    const draggables = this.container.querySelectorAll('.draggable');
    const dragArea = this.container.querySelector('.drag-area');
    const overlay = document.getElementById('drag-overlay');
    const feedback = overlay?.querySelector('.drag-feedback');

    draggables.forEach(draggable => {
      draggable.addEventListener('dragstart', (e) => {
        this.state.isDragging = true;
        this.state.draggedElement = draggable;
        draggable.classList.add('dragging');
        
        // Set drag data
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', draggable.innerHTML);
        
        // Show overlay
        if (overlay) {
          overlay.classList.remove('hidden');
        }
        
        // Show feedback
        if (feedback) {
          feedback.classList.remove('hidden');
          feedback.textContent = `Moving ${draggable.dataset.fileId}...`;
        }
      });

      draggable.addEventListener('dragend', () => {
        this.state.isDragging = false;
        this.state.draggedElement = null;
        draggable.classList.remove('dragging');
        
        // Hide overlay
        if (overlay) {
          overlay.classList.add('hidden');
        }
        
        // Hide feedback
        if (feedback) {
          feedback.classList.add('hidden');
        }
      });
    });

    if (dragArea) {
      dragArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const afterElement = this.getDragAfterElement(dragArea, e.clientY);
        const dragging = this.container.querySelector('.dragging');
        
        if (afterElement == null) {
          dragArea.appendChild(dragging);
        } else {
          dragArea.insertBefore(dragging, afterElement);
        }
      });

      dragArea.addEventListener('drop', (e) => {
        e.preventDefault();
        
        // Get new order
        const newOrder = Array.from(dragArea.children).map(el => el.dataset.fileId);
        
        // Reorder files array
        const reorderedFiles = [];
        newOrder.forEach(id => {
          const file = this.files.find(f => f.id === id);
          if (file) reorderedFiles.push(file);
        });
        this.files = reorderedFiles;
        
        // Re-render
        this.renderFileList();
        
        // Emit event
        eventBus.emit('fileOrderChanged', {
          newOrder: this.files.map(f => f.id),
          manualReorder: true
        });
        
        Toast.success('File order updated');
        
        // Log reorder
        auditLogger.info('Files reordered via drag and drop');
      });
    }

    // Update feedback position
    document.addEventListener('dragover', (e) => {
      if (feedback && this.state.isDragging) {
        feedback.style.left = `${e.clientX + 10}px`;
        feedback.style.top = `${e.clientY - 30}px`;
      }
    });
  }

  /**
   * Get the element to insert after during drag
   * @param {HTMLElement} container - Container element
   * @param {number} y - Y position
   * @returns {HTMLElement|null} Element to insert after
   */
  getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.draggable:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  /**
   * Handle window resize
   */
  handleResize() {
    // Re-render on resize to update responsive elements
    this.renderFileList();
  }

  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Generate unique ID
   * @returns {string} Unique ID
   */
  generateId() {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

  /**
   * Update files list
   * @param {Array} files - New files array
   */
  updateFiles(files) {
    this.files = files.map(file => ({
      ...file,
      id: file.id || this.generateId(),
      order: file.order || 0
    }));
    
    // Reset sort criteria
    this.state.sortBy = null;
    this.state.sortDirection = 'asc';
    
    // Re-render
    this.render();
    
    // Log update
    auditLogger.info('Files updated', { count: this.files.length });
  }

  /**
   * Get current file order
   * @returns {Array} Array of file IDs in current order
   */
  getFileOrder() {
    return this.files.map(f => f.id);
  }

  /**
   * Clean up resources
   */
  destroy() {
    // Remove event listeners
    window.removeEventListener('resize', this.handleResize);
    
    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
    }
    
    // Log destruction
    auditLogger.info('FileOrganizer destroyed');
  }
}

// Export default
export default FileOrganizer;