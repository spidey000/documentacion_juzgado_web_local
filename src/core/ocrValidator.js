/**
 * OCR Validation Module
 * 
 * Validates PDF text content and checks for extractable text.
 * This module ensures that PDFs have searchable text content
 * rather than being image-only documents.
 * 
 * @version 1.0.0
 * @author Client-Side PDF Processor Team
 */

/**
 * OCRValidator Class
 * 
 * Provides methods to validate PDF text content and extractability.
 */
export class OCRValidator {
  constructor() {
    // Initialize PDF.js worker
    this.pdfjsLib = window.pdfjsLib;
    if (this.pdfjsLib) {
      this.pdfjsLib.GlobalWorkerOptions.workerSrc = 
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  }

  /**
   * Validate if a PDF has searchable text content
   * @param {File} file - PDF file to validate
   * @returns {Promise<boolean>} True if PDF has searchable text
   */
  async validate(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await this.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let hasText = false;
      let totalTextLength = 0;
      
      // Check each page for text content
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        if (textContent.items.length > 0) {
          hasText = true;
          totalTextLength += textContent.items
            .map(item => item.str.length)
            .reduce((sum, length) => sum + length, 0);
        }
      }
      
      // Consider it valid if we found some text
      // Minimum threshold: at least 10 characters total
      return hasText && totalTextLength >= 10;
    } catch (error) {
      console.error('Error validating PDF text content:', error);
      return false;
    }
  }

  /**
   * Get detailed text analysis for a PDF
   * @param {File} file - PDF file to analyze
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeTextContent(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await this.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      const analysis = {
        hasText: false,
        totalPages: pdf.numPages,
        pagesWithText: 0,
        totalCharacters: 0,
        totalWords: 0,
        averageCharsPerPage: 0,
        pages: []
      };
      
      // Analyze each page
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ');
        
        const charCount = pageText.length;
        const wordCount = charCount > 0 ? pageText.trim().split(/\s+/).length : 0;
        
        const pageAnalysis = {
          pageNumber: i,
          hasText: textContent.items.length > 0,
          characterCount: charCount,
          wordCount: wordCount,
          textSample: pageText.substring(0, 200) + (pageText.length > 200 ? '...' : '')
        };
        
        analysis.pages.push(pageAnalysis);
        
        if (pageAnalysis.hasText) {
          analysis.hasText = true;
          analysis.pagesWithText++;
          analysis.totalCharacters += charCount;
          analysis.totalWords += wordCount;
        }
      }
      
      // Calculate average characters per page
      analysis.averageCharsPerPage = analysis.pagesWithText > 0 
        ? Math.round(analysis.totalCharacters / analysis.pagesWithText)
        : 0;
      
      return analysis;
    } catch (error) {
      console.error('Error analyzing PDF text content:', error);
      throw new Error('Failed to analyze PDF text content');
    }
  }

  /**
   * Check if a PDF is likely scanned (image-only)
   * @param {File} file - PDF file to check
   * @returns {Promise<boolean>} True if PDF appears to be scanned
   */
  async isScannedPDF(file) {
    try {
      const analysis = await this.analyzeTextContent(file);
      
      // Consider it scanned if:
      // 1. No text found, or
      // 2. Very low text density (< 5 chars per page on average)
      return !analysis.hasText || analysis.averageCharsPerPage < 5;
    } catch (error) {
      console.error('Error checking if PDF is scanned:', error);
      // Default to true if we can't analyze
      return true;
    }
  }

  /**
   * Get text quality score for a PDF
   * @param {File} file - PDF file to score
   * @returns {Promise<number>} Quality score (0-100)
   */
  async getTextQualityScore(file) {
    try {
      const analysis = await this.analyzeTextContent(file);
      
      if (!analysis.hasText) {
        return 0;
      }
      
      // Calculate score based on:
      // 1. Percentage of pages with text
      const pageCoverage = analysis.pagesWithText / analysis.totalPages;
      
      // 2. Average characters per page (max 1000 chars for full score)
      const densityScore = Math.min(analysis.averageCharsPerPage / 1000, 1);
      
      // 3. Total word count (more words generally indicate better quality)
      const volumeScore = Math.min(Math.log10(analysis.totalWords + 1) / 4, 1);
      
      // Weighted average
      const score = Math.round(
        (pageCoverage * 0.4 + densityScore * 0.4 + volumeScore * 0.2) * 100
      );
      
      return score;
    } catch (error) {
      console.error('Error calculating text quality score:', error);
      return 0;
    }
  }
}