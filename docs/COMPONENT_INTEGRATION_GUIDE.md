# Component Integration Guide

## Overview

This guide details how the new PDF management system components integrate with the existing infrastructure, particularly the eventBus and auditLogger patterns. Following these patterns ensures consistency with the current codebase.

## EventBus Integration

### New Event Types

The PDF management system introduces several new event types that components can emit and subscribe to:

```javascript
// IndexGenerator Events
'index-generation-requested'  // Trigger index generation
'index-generation-started'    // Index generation has begun
'index-generation-progress'   // Progress update (0-100)
'index-generation-completed'  // Index successfully generated
'index-generation-error'      // Index generation failed
'index-preview-generated'     // Preview is ready
'index-export-requested'      // Export index in specific format

// PDFMerger Events
'pdf-merge-requested'         // Start PDF merge operation
'pdf-merge-progress'          // Merge progress update
'pdf-merge-completed'         // PDFs successfully merged
'pdf-merge-error'             // Merge operation failed
'merge-order-changed'         // Files reordered for merge
'toc-generation-completed'    // Table of contents created

// FileOrganizer Events
'files-sorted'               // Files have been sorted
'files-reordered'            // Manual order changed
'order-saved'                // Order configuration saved
'order-loaded'               // Order configuration loaded
'drag-start'                 // Drag operation started
'drag-end'                   // Drag operation completed

// PreviewManager Events
'preview-requested'           // Generate preview
'preview-updated'            // Preview content updated
'preview-navigation'         // User navigated in preview
'preview-zoomed'             // Preview zoom level changed
```

### Event Data Structure

Each event includes structured data for consistent handling:

```javascript
// Example: index-generation-progress
eventBus.emit('index-generation-progress', {
  fileId: 'unique-file-id',
  fileName: 'document.pdf',
  progress: 45, // percentage
  currentTask: 'Extracting text content',
  estimatedTimeRemaining: 120000, // ms
  processedPages: 23,
  totalPages: 50
});

// Example: pdf-merge-completed
eventBus.emit('pdf-merge-completed', {
  mergedFile: blob, // PDF Blob
  pageCount: 150,
  originalFiles: ['doc1.pdf', 'doc2.pdf'],
  mergeOptions: {
    maintainPageNumbering: true,
    generateTOC: true
  },
  downloadUrl: 'blob://...',
  processingTime: 8500
});
```

### Integration Example

```javascript
// In IndexGenerator component
class IndexGenerator {
  async generateIndex(files) {
    // Emit start event
    eventBus.emit('index-generation-started', {
      fileCount: files.length,
      options: this.options
    });

    try {
      // Process files...
      for (const file of files) {
        // Progress updates
        eventBus.emit('index-generation-progress', {
          fileId: file.id,
          fileName: file.name,
          progress: (current / total) * 100
        });
      }

      // Success
      eventBus.emit('index-generation-completed', {
        indexData: result,
        exportFormats: ['pdf', 'json', 'txt']
      });

    } catch (error) {
      // Error handling
      eventBus.emit('index-generation-error', {
        error: error.message,
        failedFile: currentFile
      });
    }
  }
}

// In ProcessingQueue component
eventBus.on('index-generation-progress', (data) => {
  this.updateProgressBar(data.fileId, data.progress);
  this.updateStatusText(data.currentTask);
});
```

## AuditLogger Integration

### New Audit Actions

The PDF management system extends the audit logging with specific actions:

```javascript
// IndexGenerator Actions
'index_generation_started'
'index_generation_completed'
'index_generation_failed'
'index_exported'
'description_type_changed'
'index_formatting_updated'

// PDFMerger Actions
'pdf_merge_started'
'pdf_merge_completed'
'pdf_merge_failed'
'merge_order_modified'
'toc_generated'

// FileOrganizer Actions
'files_sorted'
'files_reordered_manually'
'order_configuration_saved'
'order_configuration_loaded'

// PreviewManager Actions
'preview_generated'
'preview_navigated'
'preview_exported'
```

### Audit Log Data Structure

Each audit log entry includes contextual information:

```javascript
// Example: Index generation
auditLogger.log('index_generation_started', {
  fileCount: 5,
  totalSize: 15400000, // bytes
  descriptionType: 'ai',
  formattingOptions: {
    includePageNumbers: true,
    hierarchy: true
  },
  estimatedDuration: 30000 // ms
});

// Example: PDF merge
auditLogger.log('pdf_merge_completed', {
  filesMerged: ['contract.pdf', 'appendix.pdf'],
  outputFileSize: 24500000,
  pageCount: 45,
  processingTime: 8500,
  mergeOptions: {
    maintainPageNumbering: true,
    generateTOC: true
  }
});

// Example: File reordering
auditLogger.log('files_reordered_manually', {
  reorderMethod: 'drag_drop',
  filesAffected: 3,
  previousOrder: ['a.pdf', 'b.pdf', 'c.pdf'],
  newOrder: ['b.pdf', 'a.pdf', 'c.pdf'],
  timeSpent: 5000 // ms user spent reordering
});
```

### Integration Patterns

```javascript
// Component initialization with audit logging
class PDFMerger {
  constructor(containerId, options) {
    auditLogger.log('pdf_merger_initialized', {
      containerId,
      options
    });
  }

  async mergePDFs(files) {
    const startTime = Date.now();
    
    auditLogger.log('pdf_merge_started', {
      fileCount: files.length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      options: this.mergeOptions
    });

    try {
      const result = await this.performMerge(files);
      
      auditLogger.log('pdf_merge_completed', {
        processingTime: Date.now() - startTime,
        outputFileSize: result.size,
        pageCount: result.pageCount,
        success: true
      });

      return result;
    } catch (error) {
      auditLogger.log('pdf_merge_failed', {
        processingTime: Date.now() - startTime,
        error: error.message,
        failedFiles: files.map(f => f.name)
      });
      throw error;
    }
  }
}
```

## State Management Integration

### Global State Updates

Components update global state through the StateManager, which automatically logs changes:

```javascript
// StateManager with audit integration
class StateManager {
  updateState(path, value, context = {}) {
    const oldValue = this.get(path);
    const newValue = value;
    
    // Log state change
    auditLogger.log('state_changed', {
      path,
      oldValue: oldValue ? JSON.stringify(oldValue) : null,
      newValue: JSON.stringify(newValue),
      context,
      component: context.component || 'unknown'
    });

    // Update state and notify listeners
    this.set(path, newValue);
    this.notifyListeners(path, newValue);
  }
}

// Usage in components
stateManager.updateState('indexGeneration.descriptionType', 'ai', {
  component: 'IndexGenerator',
  action: 'user_selection'
});
```

## Error Handling Integration

### Standardized Error Handling

All components follow the same error handling pattern:

```javascript
// Error handling wrapper
async function withErrorHandling(operation, context) {
  try {
    return await operation();
  } catch (error) {
    // Log error
    auditLogger.error(`${context}_failed`, {
      error: error.message,
      stack: error.stack,
      context
    });

    // Emit error event
    eventBus.emit('error', {
      type: error.name,
      message: getUserFriendlyMessage(error),
      context,
      recoverable: isRecoverable(error)
    });

    // Show user notification
    showToast(getUserFriendlyMessage(error), 'error');

    // Re-throw for component handling
    throw error;
  }
}

// Usage
async generateIndex() {
  return withErrorHandling(async () => {
    // Actual implementation
  }, 'index_generation');
}
```

## Component Lifecycle Integration

### Initialization Pattern

```javascript
class BaseComponent {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.options = {
      eventBus,
      auditLogger,
      stateManager,
      ...options
    };

    // Audit initialization
    this.auditLogger.log(`${this.constructor.name}_initialized`, {
      containerId,
      options: this.options
    });

    this.init();
  }

  init() {
    this.render();
    this.attachEventListeners();
    this.subscribeToEvents();
    this.loadState();
  }

  destroy() {
    this.cleanup();
    this.unsubscribeFromEvents();
    
    this.auditLogger.log(`${this.constructor.name}_destroyed`, {
      containerId: this.containerId
    });
  }
}
```

## Performance Monitoring Integration

### Performance Metrics

```javascript
// Performance monitoring wrapper
function monitorPerformance(operation, context) {
  const startTime = performance.now();
  const memoryBefore = performance.memory ? performance.memory.usedJSHeapSize : null;

  return {
    async: async (...args) => {
      const result = await operation(...args);
      const endTime = performance.now();
      const memoryAfter = performance.memory ? performance.memory.usedJSHeapSize : null;

      // Log performance metrics
      auditLogger.log('performance_metric', {
        context,
        duration: endTime - startTime,
        memoryDelta: memoryAfter && memoryBefore ? memoryAfter - memoryBefore : null,
        success: true
      });

      return result;
    },

    sync: (...args) => {
      const result = operation(...args);
      const endTime = performance.now();

      auditLogger.log('performance_metric', {
        context,
        duration: endTime - startTime,
        success: true
      });

      return result;
    }
  };
}

// Usage
const monitoredMerge = monitorPerformance(mergePDFs, 'pdf_merge');
await monitoredMerge.async(files);
```

## Integration Checklist

For each new component, ensure:

1. **Event Integration**
   - [ ] Emit appropriate events for all actions
   - [ ] Subscribe to necessary events
   - [ ] Include consistent data structures
   - [ ] Handle event cleanup in destroy()

2. **Audit Integration**
   - [ ] Log all significant actions
   - [ ] Include contextual information
   - [ ] Log both success and failure cases
   - [ ] Follow naming conventions

3. **State Integration**
   - [ ] Use StateManager for shared state
   - [ ] Load initial state from storage
   - [ ] Persist state changes
   - [ ] Subscribe to state updates

4. **Error Handling**
   - [ ] Implement try-catch blocks
   - [ ] Use withErrorHandling wrapper
   - [ ] Provide user-friendly messages
   - [ ] Log errors appropriately

5. **Performance**
   - [ ] Monitor critical operations
   - [ ] Log performance metrics
   - [ ] Implement optimizations as needed
   - [ ] Test with large datasets

## Best Practices

1. **Event Naming**
   - Use past tense for completed actions
   - Use present tense for progress updates
   - Be consistent with naming patterns

2. **Audit Data**
   - Include all relevant context
   - Avoid logging sensitive information
   - Use structured data for better querying

3. **State Updates**
   - Update state atomically
   - Batch multiple updates when possible
   - Validate state before updates

4. **Component Communication**
   - Prefer events over direct method calls
   - Keep components loosely coupled
   - Use event namespacing if needed

## Troubleshooting

### Common Integration Issues

1. **Events Not Firing**
   - Check eventBus instance is shared
   - Verify event names match exactly
   - Ensure listeners are properly attached

2. **Audit Logs Missing**
   - Check auditLogger import
   - Verify logging level settings
   - Check localStorage permissions

3. **State Not Persisting**
   - Verify StateManager initialization
   - Check storage quotas
   - Look for serialization errors

### Debug Tools

```javascript
// Event debugging
eventBus.debug = true; // Enable event logging

// Audit log filtering
auditLogger.search('index_generation');
auditLogger.getLogsByLevel('error');

// State inspection
stateManager.getState();
stateManager.subscribe((state) => console.log('State updated:', state));