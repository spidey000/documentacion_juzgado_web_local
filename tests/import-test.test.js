// Simple test to verify imports work
import { describe, it, expect } from 'vitest';

describe('Import Test', () => {
  it('should import all components successfully', async () => {
    // Test each import individually
    const { FileUpload } = await import('@components/FileUpload');
    expect(FileUpload).toBeDefined();
    
    const { PDFViewer } = await import('@components/PDFViewer');
    expect(PDFViewer).toBeDefined();
    
    const { ProcessingQueue } = await import('@components/ProcessingQueue');
    expect(ProcessingQueue).toBeDefined();
    
    const { ResultsPanel } = await import('@components/ResultsPanel');
    expect(ResultsPanel).toBeDefined();
    
    // Test utilities
    const { eventBus } = await import('@utils/eventBus');
    expect(eventBus).toBeDefined();
    
    const { mockPDFFile, createMockFile } = await import('@utils/mockData');
    expect(mockPDFFile).toBeDefined();
    expect(createMockFile).toBeDefined();
    
    const { renderWithProviders } = await import('@utils/testHelpers');
    expect(renderWithProviders).toBeDefined();
  });
});