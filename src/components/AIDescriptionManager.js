/**
 * AI Description Manager Component
 * 
 * Handles AI-powered document descriptions with multiple generation modes:
 * - Filename-based descriptions
 * - AI-powered summarization
 * - Custom descriptions with editing
 * - Batch processing
 * - Progress tracking
 * 
 * @version 1.0.0
 */

import { AIDescriber } from '../core/aiDescriber.js';
import { eventBus } from '../utils/eventBus.js';
import { auditLogger } from '../utils/auditLogger.js';

/**
 * AIDescriptionManager Class
 * Manages AI-powered document descriptions
 */
export class AIDescriptionManager {
  /**
   * Constructor
   * @param {Array} files - Initial file list
   * @param {Object} configuration - Component configuration
   */
  constructor(files = [], configuration = {}) {
    this.files = new Map();
    this.config = {
      batchSize: 5,
      progressInterval: 100,
      exportFormats: ['json', 'csv', 'txt'],
      ...configuration
    };
    
    this.aiDescriber = new AIDescriber();
    this.processingQueue = [];
    this.isProcessing = false;
    this.currentProgress = 0;
    
    // Initialize with provided files
    files.forEach(file => {
      this.files.set(file.id, {
        ...file,
        description: '',
        descriptionMode: 'pending',
        isEdited: false,
        generatedAt: null
      });
    });
    
    // Bind event handlers
    this.bindEvents();
    
    // Audit logging
    auditLogger.info('AIDescriptionManager initialized', { 
      fileCount: files.length,
      config: this.config 
    });
  }
  
  /**
   * Bind event handlers
   */
  bindEvents() {
    // Listen for file updates
    eventBus.on('filesUpdated', ({ files }) => {
      files.forEach(file => {
        if (!this.files.has(file.id)) {
          this.files.set(file.id, {
            ...file,
            description: '',
            descriptionMode: 'pending',
            isEdited: false,
            generatedAt: null
          });
        }
      });
    });
    
    // Listen for description requests
    eventBus.on('generateDescriptions', ({ files, mode }) => {
      this.generateDescriptions(files, mode);
    });
    
    // Listen for batch processing requests
    eventBus.on('batchGenerateDescriptions', ({ files }) => {
      this.batchGenerate(files);
    });
  }
  
  /**
   * Generate descriptions for files
   * @param {Array} files - Files to generate descriptions for
   * @param {string} mode - Generation mode: 'filename', 'ai', or 'custom'
   * @returns {Promise<Object>} Generation results
   */
  async generateDescriptions(files, mode = 'ai') {
    if (!files || files.length === 0) {
      throw new Error('No files provided for description generation');
    }
    
    const startTime = Date.now();
    auditLogger.info(`Starting ${mode} description generation`, { 
      fileCount: files.length,
      mode 
    });
    
    try {
      const results = new Map();
      let processedCount = 0;
      
      // Process files based on mode
      for (const file of files) {
        let description = '';
        
        switch (mode) {
          case 'filename':
            description = this.generateFilenameDescription(file);
            break;
          case 'ai':
            description = await this.generateAIDescription(file);
            break;
          case 'custom':
            description = await this.generateCustomDescription(file);
            break;
          default:
            throw new Error(`Unknown description mode: ${mode}`);
        }
        
        // Update file with description
        const fileData = this.files.get(file.id);
        if (fileData) {
          fileData.description = description;
          fileData.descriptionMode = mode;
          fileData.generatedAt = new Date().toISOString();
          this.files.set(file.id, fileData);
        }
        
        results.set(file.id, description);
        processedCount++;
        
        // Update progress
        this.currentProgress = (processedCount / files.length) * 100;
        eventBus.emit('descriptionProgress', {
          progress: this.currentProgress,
          processed: processedCount,
          total: files.length,
          currentFile: file.name
        });
        
        // Small delay to prevent blocking
        if (processedCount % this.config.batchSize === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      // Emit completion event
      const resultData = {
        mode,
        fileCount: files.length,
        descriptions: Object.fromEntries(results),
        duration: Date.now() - startTime
      };
      
      eventBus.emit('descriptionsGenerated', resultData);
      
      auditLogger.success(`${mode} descriptions generated successfully`, resultData);
      
      return resultData;
    } catch (error) {
      auditLogger.error('Error generating descriptions', { 
        error: error.message,
        mode,
        fileCount: files.length 
      });
      
      eventBus.emit('descriptionError', {
        error: error.message,
        mode,
        fileCount: files.length
      });
      
      throw error;
    } finally {
      this.currentProgress = 0;
    }
  }
  
  /**
   * Generate description from filename
   * @param {Object} file - File object
   * @returns {string} Generated description
   */
  generateFilenameDescription(file) {
    const { name } = file;
    
    // Remove file extension
    const nameWithoutExt = name.replace(/\.[^/.]+$/, '');
    
    // Replace separators with spaces
    const cleanName = nameWithoutExt.replace(/[_-]/g, ' ');
    
    // Convert camelCase to spaces
    const spacedName = cleanName.replace(/([a-z])([A-Z])/g, '$1 $2');
    
    // Capitalize words
    const description = spacedName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    return description;
  }
  
  /**
   * Generate AI-powered description
   * @param {Object} file - File object
   * @returns {Promise<string>} Generated description
   */
  async generateAIDescription(file) {
    try {
      // Get text content from file
      let textContent = '';
      
      if (file.textContent) {
        textContent = file.textContent;
      } else if (file.content) {
        textContent = file.content;
      } else {
        // Try to extract text from file
        textContent = await this.extractTextFromFile(file);
      }
      
      if (!textContent || textContent.trim().length === 0) {
        // Fallback to filename description
        return this.generateFilenameDescription(file);
      }
      
      // Generate AI description
      const aiResult = await this.aiDescriber.generateDescription(textContent);
      
      // Format description
      let description = aiResult.summary || '';
      
      // Add category if available
      if (aiResult.category && aiResult.category !== 'general') {
        description = `[${aiResult.category.toUpperCase()}] ${description}`;
      }
      
      // Add reading time if significant
      if (aiResult.readingTime && aiResult.readingTime > 5) {
        description = `${description} (${aiResult.readingTime} min read)`;
      }
      
      return description;
    } catch (error) {
      auditLogger.error('AI description generation failed', {
        fileId: file.id,
        fileName: file.name,
        error: error.message
      });
      
      // Fallback to filename description
      return this.generateFilenameDescription(file);
    }
  }
  
  /**
   * Generate custom description placeholder
   * @param {Object} file - File object
   * @returns {Promise<string>} Custom description template
   */
  async generateCustomDescription(file) {
    // Generate a basic template for custom editing
    const template = `Document: ${file.name}
Type: ${file.type || 'Unknown'}
Size: ${(file.size / 1024).toFixed(2)} KB

[Please edit this description to provide custom details about the document...]`;
    
    return template;
  }
  
  /**
   * Extract text from file
   * @param {Object} file - File object
   * @returns {Promise<string>} Extracted text
   */
  async extractTextFromFile(file) {
    try {
      if (file.textContent) {
        return file.textContent;
      }
      
      if (file instanceof File) {
        // Basic text extraction for text files
        if (file.type.startsWith('text/')) {
          return await file.text();
        }
      }
      
      return '';
    } catch (error) {
      auditLogger.error('Text extraction failed', {
        fileId: file.id,
        error: error.message
      });
      return '';
    }
  }
  
  /**
   * Edit description for a specific file
   * @param {string} fileId - File ID
   * @param {string} description - New description
   * @returns {boolean} Success status
   */
  editDescription(fileId, description) {
    const fileData = this.files.get(fileId);
    if (!fileData) {
      auditLogger.warning('Attempted to edit description for non-existent file', { fileId });
      return false;
    }
    
    const oldDescription = fileData.description;
    fileData.description = description;
    fileData.isEdited = true;
    fileData.descriptionMode = 'custom';
    fileData.lastEdited = new Date().toISOString();
    
    this.files.set(fileId, fileData);
    
    // Emit update event
    eventBus.emit('descriptionUpdated', {
      fileId,
      fileName: fileData.name,
      oldDescription,
      newDescription: description,
      mode: 'custom'
    });
    
    auditLogger.info('Description updated', {
      fileId,
      fileName: fileData.name,
      descriptionLength: description.length
    });
    
    return true;
  }
  
  /**
   * Generate descriptions in batches
   * @param {Array} files - Files to process
   * @param {string} mode - Generation mode
   * @returns {Promise<Object>} Batch processing results
   */
  async batchGenerate(files, mode = 'ai') {
    if (this.isProcessing) {
      throw new Error('Already processing files');
    }
    
    this.isProcessing = true;
    const batchSize = this.config.batchSize;
    const batches = [];
    
    // Create batches
    for (let i = 0; i < files.length; i += batchSize) {
      batches.push(files.slice(i, i + batchSize));
    }
    
    const results = {
      totalFiles: files.length,
      processedFiles: 0,
      successful: 0,
      failed: 0,
      errors: [],
      startTime: Date.now()
    };
    
    auditLogger.info('Starting batch description generation', {
      totalFiles: files.length,
      batchSize,
      batchCount: batches.length
    });
    
    // Process batches
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      try {
        const batchResult = await this.generateDescriptions(batch, mode);
        results.successful += batch.length;
        results.processedFiles += batch.length;
        
        // Emit batch progress
        eventBus.emit('batchProgress', {
          batch: i + 1,
          totalBatches: batches.length,
          filesInBatch: batch.length,
          ...results
        });
        
      } catch (error) {
        results.failed += batch.length;
        results.processedFiles += batch.length;
        results.errors.push({
          batch: i + 1,
          error: error.message,
          fileCount: batch.length
        });
        
        auditLogger.error('Batch processing failed', {
          batch: i + 1,
          error: error.message,
          fileCount: batch.length
        });
      }
    }
    
    results.duration = Date.now() - results.startTime;
    this.isProcessing = false;
    
    // Emit completion
    eventBus.emit('batchComplete', results);
    
    auditLogger.success('Batch processing completed', results);
    
    return results;
  }
  
  /**
   * Get description preview for a file
   * @param {string} fileId - File ID
   * @param {number} maxLength - Maximum preview length
   * @returns {Object} Preview data
   */
  getDescriptionPreview(fileId, maxLength = 100) {
    const fileData = this.files.get(fileId);
    if (!fileData) {
      return null;
    }
    
    const { description, descriptionMode, isEdited, generatedAt } = fileData;
    
    let preview = description;
    let isTruncated = false;
    
    if (description.length > maxLength) {
      preview = description.substring(0, maxLength - 3) + '...';
      isTruncated = true;
    }
    
    return {
      fileId,
      fileName: fileData.name,
      preview,
      isTruncated,
      fullLength: description.length,
      mode: descriptionMode,
      isEdited,
      generatedAt
    };
  }
  
  /**
   * Export descriptions in specified format
   * @param {string} format - Export format: 'json', 'csv', or 'txt'
   * @returns {string} Exported data
   */
  exportDescriptions(format = 'json') {
    if (!this.config.exportFormats.includes(format)) {
      throw new Error(`Unsupported export format: ${format}`);
    }
    
    const descriptions = [];
    this.files.forEach((file, fileId) => {
      if (file.description && file.description.trim().length > 0) {
        descriptions.push({
          id: fileId,
          name: file.name,
          description: file.description,
          mode: file.descriptionMode,
          isEdited: file.isEdited,
          generatedAt: file.generatedAt,
          size: file.size,
          type: file.type
        });
      }
    });
    
    switch (format) {
      case 'json':
        return JSON.stringify(descriptions, null, 2);
        
      case 'csv':
        const headers = ['ID', 'Name', 'Description', 'Mode', 'Edited', 'Generated At', 'Size', 'Type'];
        const rows = descriptions.map(d => [
          d.id,
          `"${d.name.replace(/"/g, '""')}"`,
          `"${d.description.replace(/"/g, '""')}"`,
          d.mode,
          d.isEdited,
          d.generatedAt || '',
          d.size || '',
          d.type || ''
        ]);
        
        return [headers, ...rows]
          .map(row => row.join(','))
          .join('\n');
        
      case 'txt':
        return descriptions
          .map(d => `File: ${d.name}\nDescription: ${d.description}\nMode: ${d.mode}\n\n`)
          .join('');
        
      default:
        throw new Error(`Unknown export format: ${format}`);
    }
  }
  
  /**
   * Get current processing progress
   * @returns {Object} Progress information
   */
  getProgress() {
    return {
      progress: this.currentProgress,
      isProcessing: this.isProcessing,
      queueLength: this.processingQueue.length
    };
  }
  
  /**
   * Get all files with descriptions
   * @returns {Array} Files with description data
   */
  getFilesWithDescriptions() {
    const files = [];
    this.files.forEach((file, fileId) => {
      files.push({ id: fileId, ...file });
    });
    return files;
  }
  
  /**
   * Get statistics about descriptions
   * @returns {Object} Description statistics
   */
  getStatistics() {
    const stats = {
      totalFiles: this.files.size,
      withDescriptions: 0,
      modeCounts: {
        filename: 0,
        ai: 0,
        custom: 0,
        pending: 0
      },
      editedCount: 0,
      averageLength: 0
    };
    
    let totalLength = 0;
    
    this.files.forEach(file => {
      if (file.description && file.description.trim().length > 0) {
        stats.withDescriptions++;
        totalLength += file.description.length;
        
        if (stats.modeCounts.hasOwnProperty(file.descriptionMode)) {
          stats.modeCounts[file.descriptionMode]++;
        }
        
        if (file.isEdited) {
          stats.editedCount++;
        }
      }
    });
    
    stats.averageLength = stats.withDescriptions > 0 
      ? Math.round(totalLength / stats.withDescriptions) 
      : 0;
    
    return stats;
  }
  
  /**
   * Clear all descriptions
   */
  clearAllDescriptions() {
    const clearedCount = this.files.size;
    
    this.files.forEach((file, fileId) => {
      file.description = '';
      file.descriptionMode = 'pending';
      file.isEdited = false;
      file.generatedAt = null;
      file.lastEdited = null;
      this.files.set(fileId, file);
    });
    
    auditLogger.info('All descriptions cleared', { clearedCount });
    
    eventBus.emit('descriptionsCleared', { clearedCount });
  }
  
  /**
   * Add new files to manager
   * @param {Array} files - Files to add
   */
  addFiles(files) {
    files.forEach(file => {
      if (!this.files.has(file.id)) {
        this.files.set(file.id, {
          ...file,
          description: '',
          descriptionMode: 'pending',
          isEdited: false,
          generatedAt: null
        });
      }
    });
    
    auditLogger.info('Files added to description manager', { 
      addedCount: files.length,
      totalFiles: this.files.size 
    });
  }
  
  /**
   * Remove file from manager
   * @param {string} fileId - File ID to remove
   * @returns {boolean} Success status
   */
  removeFile(fileId) {
    const removed = this.files.delete(fileId);
    
    if (removed) {
      auditLogger.info('File removed from description manager', { fileId });
      eventBus.emit('fileRemovedFromManager', { fileId });
    }
    
    return removed;
  }
}

// Export singleton instance
export const aiDescriptionManager = new AIDescriptionManager();

// Export class as default
export default AIDescriptionManager;