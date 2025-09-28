/**
 * PDF Processing Module
 *
 * Handles PDF merging, splitting, and text extraction operations.
 * This module uses PDF.js for text extraction and pdf-lib for PDF manipulation.
 *
 * @version 1.0.0
 * @author Client-Side PDF Processor Team
 */

import { PDFDocument } from 'pdf-lib';

/**
 * PDFProcessor Class
 *
 * Provides methods for manipulating PDF files client-side.
 */
export class PDFProcessor {
  constructor() {
    // Initialize PDF.js worker
    this.pdfjsLib = window.pdfjsLib;
    if (this.pdfjsLib) {
      this.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  }

  /**
   * Extract text content from a PDF file
   * @param {File} file - PDF file to extract text from
   * @returns {Promise<string>} Extracted text content
   */
  async extractText(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await this.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      
      // Extract text from each page
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }
      
      return fullText.trim();
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      throw new Error('Failed to extract text from PDF');
    }
  }

  /**
   * Get page count of a PDF file
   * @param {File} file - PDF file to count pages
   * @returns {Promise<number>} Number of pages
   */
  async getPageCount(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await this.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      return pdf.numPages;
    } catch (error) {
      console.error('Error getting page count:', error);
      throw new Error('Failed to get page count');
    }
  }

  /**
   * Merge multiple PDF files into one
   * @param {File[]} files - Array of PDF files to merge
   * @returns {Promise<Blob>} Merged PDF as Blob
   */
  async mergePDFs(files) {
    try {
      if (files.length === 0) {
        throw new Error('No files to merge');
      }
      
      if (files.length === 1) {
        return files[0];
      }
      
      // Create a new PDF document
      const mergedPdf = await PDFDocument.create();
      
      // Process each PDF file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        
        // Copy all pages from the current PDF to the merged document
        const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
      }
      
      // Save the merged PDF
      const mergedPdfBytes = await mergedPdf.save();
      return new Blob([mergedPdfBytes], { type: 'application/pdf' });
    } catch (error) {
      console.error('Error merging PDFs:', error);
      throw new Error('Failed to merge PDFs');
    }
  }

  /**
   * Split a PDF file into individual pages
   * @param {File} file - PDF file to split
   * @param {number[]} pages - Array of page numbers to extract (1-based)
   * @returns {Promise<Blob[]>} Array of PDF Blobs for each page
   */
  async splitPDF(file, pages) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      
      const pageBlobs = [];
      
      // If no specific pages provided, extract all pages
      const pagesToExtract = pages && pages.length > 0
        ? pages.map(p => p - 1) // Convert to 0-based
        : pdfDoc.getPageIndices();
      
      // Create a separate PDF for each page
      for (const pageIndex of pagesToExtract) {
        if (pageIndex >= 0 && pageIndex < pdfDoc.getPageCount()) {
          const singlePagePdf = await PDFDocument.create();
          const [page] = await singlePagePdf.copyPages(pdfDoc, [pageIndex]);
          singlePagePdf.addPage(page);
          
          const pdfBytes = await singlePagePdf.save();
          pageBlobs.push(new Blob([pdfBytes], { type: 'application/pdf' }));
        }
      }
      
      return pageBlobs;
    } catch (error) {
      console.error('Error splitting PDF:', error);
      throw new Error('Failed to split PDF');
    }
  }

  /**
   * Extract specific pages from a PDF
   * @param {File} file - PDF file to extract from
   * @param {number[]} pages - Array of page numbers to extract (1-based)
   * @returns {Promise<Blob>} PDF Blob with extracted pages
   */
  async extractPages(file, pages) {
    try {
      if (!pages || pages.length === 0) {
        throw new Error('No pages specified for extraction');
      }
      
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      
      const extractedPdf = await PDFDocument.create();
      
      // Convert page numbers to 0-based and copy pages
      const pageIndices = pages.map(p => p - 1);
      const validPages = pageIndices.filter(i => i >= 0 && i < pdfDoc.getPageCount());
      
      if (validPages.length === 0) {
        throw new Error('No valid pages to extract');
      }
      
      const pagesToCopy = await extractedPdf.copyPages(pdfDoc, validPages);
      pagesToCopy.forEach(page => extractedPdf.addPage(page));
      
      const pdfBytes = await extractedPdf.save();
      return new Blob([pdfBytes], { type: 'application/pdf' });
    } catch (error) {
      console.error('Error extracting pages:', error);
      throw new Error('Failed to extract pages');
    }
  }
}