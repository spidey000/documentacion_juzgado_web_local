/**
 * Index Generator Module
 * 
 * Creates searchable indexes for PDF content.
 * This module generates various types of indexes to make
 * PDF content more searchable and navigable.
 * 
 * @version 1.0.0
 * @author Client-Side PDF Processor Team
 */

/**
 * IndexGenerator Class
 *
 * Provides methods for creating searchable indexes and document indexes.
 */
export class IndexGenerator {
  constructor() {
    this.config = {
      minWordLength: 3,
      maxWordLength: 50,
      stopWords: [
        'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have',
        'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you',
        'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they',
        'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my',
        'one', 'all', 'would', 'there', 'their', 'what', 'so',
        'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
        'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him',
        'know', 'take', 'people', 'into', 'year', 'your', 'good',
        'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now',
        'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back',
        'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well',
        'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give',
        'day', 'most', 'us'
      ]
    };
  }

  /**
   * Generate a comprehensive index for processed PDFs
   * @param {Array<Object>} processedFiles - Array of processed file data
   * @returns {Promise<Object>} Generated index data
   */
  async generate(processedFiles) {
    try {
      if (!processedFiles || processedFiles.length === 0) {
        throw new Error('No processed files to index');
      }

      const index = {
        wordIndex: {},
        fileIndex: {},
        phraseIndex: {},
        metadata: {
          totalFiles: processedFiles.length,
          totalWords: 0,
          uniqueWords: 0,
          generatedAt: new Date().toISOString(),
        }
      };

      // Process each file
      for (const fileData of processedFiles) {
        const fileIndex = await this.generateFileIndex(fileData);
        
        // Add to master indexes
        this.mergeIntoMasterIndex(index, fileIndex, fileData.file.name);
        
        // Store file metadata
        index.fileIndex[fileData.file.name] = {
          name: fileData.file.name,
          size: fileData.file.size,
          pageCount: fileData.pageCount,
          description: fileData.description,
          wordCount: fileIndex.wordCount,
          processedAt: new Date().toISOString(),
        };
      }

      // Calculate statistics
      index.metadata.uniqueWords = Object.keys(index.wordIndex).length;
      index.metadata.totalWords = Object.values(index.fileIndex)
        .reduce((sum, file) => sum + file.wordCount, 0);

      return index;
    } catch (error) {
      console.error('Error generating index:', error);
      throw new Error('Failed to generate index');
    }
  }

  /**
   * Generate index for a single file
   * @param {Object} fileData - Processed file data
   * @returns {Promise<Object>} File-specific index
   */
  async generateFileIndex(fileData) {
    if (!fileData.textContent) {
      return {
        wordIndex: {},
        phraseIndex: {},
        wordCount: 0,
        phrases: [],
      };
    }

    const text = fileData.textContent.toLowerCase();
    const words = this.extractWords(text);
    const phrases = this.extractPhrases(text);
    
    const wordIndex = {};
    const phraseIndex = {};

    // Build word index with positions
    words.forEach((word, position) => {
      if (!wordIndex[word]) {
        wordIndex[word] = {
          count: 0,
          positions: [],
          pages: this.estimatePageFromPosition(position, words.length, fileData.pageCount),
        };
      }
      wordIndex[word].count++;
      wordIndex[word].positions.push(position);
    });

    // Build phrase index
    phrases.forEach(phrase => {
      if (!phraseIndex[phrase]) {
        phraseIndex[phrase] = {
          count: 0,
          positions: [],
        };
      }
      phraseIndex[phrase].count++;
      phraseIndex[phrase].positions.push(
        text.indexOf(phrase.toLowerCase())
      );
    });

    return {
      wordIndex,
      phraseIndex,
      wordCount: words.length,
      phrases: Object.keys(phraseIndex),
    };
  }

  /**
   * Extract and filter words from text
   * @param {string} text - Text to process
   * @returns {Array<string>} Filtered words
   */
  extractWords(text) {
    // Match words and normalize
    const words = text
      .match(/\b[a-z]+\b/g) || []
      .filter(word => {
        const length = word.length;
        return length >= this.config.minWordLength && 
               length <= this.config.maxWordLength &&
               !this.config.stopWords.includes(word);
      });

    return words;
  }

  /**
   * Extract meaningful phrases from text
   * @param {string} text - Text to process
   * @returns {Array<string>} Extracted phrases
   */
  extractPhrases(text) {
    const phrases = [];
    const sentences = text.split(/[.!?]+/);
    
    sentences.forEach(sentence => {
      const words = sentence.trim().toLowerCase().match(/\b[a-z]+\b/g) || [];
      
      // Extract 2-3 word phrases
      for (let i = 0; i < words.length - 1; i++) {
        const bigram = `${words[i]} ${words[i + 1]}`;
        if (!this.config.stopWords.includes(words[i]) && 
            !this.config.stopWords.includes(words[i + 1])) {
          phrases.push(bigram);
        }
        
        if (i < words.length - 2) {
          const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
          if (!this.config.stopWords.includes(words[i]) && 
              !this.config.stopWords.includes(words[i + 2])) {
            phrases.push(trigram);
          }
        }
      }
    });

    // Count and filter frequent phrases
    const phraseCount = {};
    phrases.forEach(phrase => {
      phraseCount[phrase] = (phraseCount[phrase] || 0) + 1;
    });

    return Object.keys(phraseCount)
      .filter(phrase => phraseCount[phrase] > 1)
      .sort((a, b) => phraseCount[b] - phraseCount[a])
      .slice(0, 100); // Top 100 phrases
  }

  /**
   * Merge file index into master index
   * @param {Object} masterIndex - Master index object
   * @param {Object} fileIndex - File-specific index
   * @param {string} fileName - Name of the file
   */
  mergeIntoMasterIndex(masterIndex, fileIndex, fileName) {
    // Merge word index
    Object.entries(fileIndex.wordIndex).forEach(([word, data]) => {
      if (!masterIndex.wordIndex[word]) {
        masterIndex.wordIndex[word] = {
          files: {},
          totalFrequency: 0,
        };
      }
      
      masterIndex.wordIndex[word].files[fileName] = {
        count: data.count,
        positions: data.positions,
        pages: data.pages,
      };
      
      masterIndex.wordIndex[word].totalFrequency += data.count;
    });

    // Merge phrase index
    Object.entries(fileIndex.phraseIndex).forEach(([phrase, data]) => {
      if (!masterIndex.phraseIndex[phrase]) {
        masterIndex.phraseIndex[phrase] = {
          files: {},
          totalFrequency: 0,
        };
      }
      
      masterIndex.phraseIndex[phrase].files[fileName] = {
        count: data.count,
        positions: data.positions,
      };
      
      masterIndex.phraseIndex[phrase].totalFrequency += data.count;
    });
  }

  /**
   * Estimate page number from word position
   * @param {number} position - Word position in document
   * @param {number} totalWords - Total words in document
   * @param {number} pageCount - Number of pages in document
   * @returns {number} Estimated page number (1-based)
   */
  estimatePageFromPosition(position, totalWords, pageCount) {
    if (!pageCount || pageCount === 0) return 1;
    
    const ratio = position / totalWords;
    return Math.min(Math.floor(ratio * pageCount) + 1, pageCount);
  }

  /**
   * Search the generated index
   * @param {Object} index - Generated index
   * @param {string} query - Search query
   * @returns {Array<Object>} Search results
   */
  search(index, query) {
    if (!index || !index.wordIndex) {
      return [];
    }

    const results = [];
    const terms = query.toLowerCase().split(/\s+/).filter(term => term.length >= 2);

    terms.forEach(term => {
      // Search for exact word matches
      if (index.wordIndex[term]) {
        Object.entries(index.wordIndex[term].files).forEach(([fileName, data]) => {
          results.push({
            type: 'word',
            term,
            fileName,
            count: data.count,
            positions: data.positions,
            pages: data.pages,
            score: data.count / index.fileIndex[fileName].wordCount,
          });
        });
      }

      // Search for phrase matches
      Object.keys(index.phraseIndex || {}).forEach(phrase => {
        if (phrase.includes(term)) {
          Object.entries(index.phraseIndex[phrase].files).forEach(([fileName, data]) => {
            results.push({
              type: 'phrase',
              term: phrase,
              fileName,
              count: data.count,
              positions: data.positions,
              score: data.count * 1.5, // Boost phrase matches
            });
          });
        }
      });
    });

    // Sort by relevance
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Export index to different formats
   * @param {Object} index - Generated index
   * @param {string} format - Export format ('json', 'csv', 'txt')
   * @returns {string} Formatted index data
   */
  exportIndex(index, format = 'json') {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(index, null, 2);
      
      case 'csv':
        return this.exportToCSV(index);
      
      case 'txt':
        return this.exportToText(index);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export index to CSV format
   * @param {Object} index - Generated index
   * @returns {string} CSV formatted data
   */
  exportToCSV(index) {
    const lines = ['Term,Type,File,Count,Positions'];
    
    // Word index entries
    Object.entries(index.wordIndex).forEach(([word, data]) => {
      Object.entries(data.files).forEach(([fileName, fileData]) => {
        lines.push([
          `"${word}"`,
          'word',
          `"${fileName}"`,
          fileData.count,
          `"${fileData.positions.slice(0, 10).join('; ')}${fileData.positions.length > 10 ? '...' : ''}"`
        ].join(','));
      });
    });
    
    return lines.join('\n');
  }

  /**
   * Export index to plain text format
   * @param {Object} index - Generated index
   * @returns {string} Text formatted data
   */
  exportToText(index) {
    let text = `PDF CONTENT INDEX\n`;
    text += `Generated: ${index.metadata.generatedAt}\n`;
    text += `Files: ${index.metadata.totalFiles}\n`;
    text += `Total Words: ${index.metadata.totalWords}\n`;
    text += `Unique Words: ${index.metadata.uniqueWords}\n\n`;
    
    text += 'WORD INDEX\n';
    text += '='.repeat(50) + '\n';
    
    Object.entries(index.wordIndex)
      .sort(([,a], [,b]) => b.totalFrequency - a.totalFrequency)
      .slice(0, 100) // Top 100 words
      .forEach(([word, data]) => {
        text += `${word} (${data.totalFrequency} occurrences):\n`;
        Object.entries(data.files).forEach(([fileName, fileData]) => {
          text += `  - ${fileName}: ${fileData.count} times\n`;
        });
        text += '\n';
      });
    
    return text;
  }

  /**
   * Generate a document index (table of contents style)
   * @param {Array<Object>} files - Array of file objects
   * @param {Object} descriptions - File descriptions mapping
   * @param {Object} options - Index generation options
   * @returns {Promise<Object>} Generated document index
   */
  async generateDocumentIndex(files, descriptions = {}, options = {}) {
    const {
      type = 'simple', // 'simple', 'detailed', 'hierarchical'
      numberingScheme = 'continuous', // 'continuous', 'document', 'custom'
      includeDescriptions = true,
      structure = null // For hierarchical index
    } = options;

    try {
      // Calculate page numbers based on numbering scheme
      const pageNumbers = this.calculatePageNumbers(files, numberingScheme);

      // Generate index based on type
      let index;
      switch (type) {
        case 'simple':
          index = this.formatSimpleList(files, descriptions, pageNumbers);
          break;
        case 'detailed':
          index = this.formatDetailedList(files, descriptions, pageNumbers);
          break;
        case 'hierarchical':
          index = this.formatHierarchicalIndex(files, descriptions, pageNumbers, structure);
          break;
        default:
          throw new Error(`Unsupported index type: ${type}`);
      }

      return {
        type,
        numberingScheme,
        index,
        metadata: {
          totalFiles: files.length,
          generatedAt: new Date().toISOString(),
          includeDescriptions,
          hasStructure: !!structure
        }
      };
    } catch (error) {
      console.error('Error generating document index:', error);
      throw new Error(`Failed to generate document index: ${error.message}`);
    }
  }

  /**
   * Calculate page numbers based on numbering scheme
   * @param {Array<Object>} files - Array of file objects
   * @param {string} scheme - Numbering scheme
   * @returns {Object} Page number mapping
   */
  calculatePageNumbers(files, scheme = 'continuous') {
    const pageNumbers = {};
    let currentPage = 1;

    files.forEach((file, index) => {
      const pageCount = file.pageCount || 1;

      switch (scheme) {
        case 'continuous':
          pageNumbers[file.name] = {
            start: currentPage,
            end: currentPage + pageCount - 1,
            prefix: '',
            total: pageCount
          };
          currentPage += pageCount;
          break;

        case 'document':
          pageNumbers[file.name] = {
            start: 1,
            end: pageCount,
            prefix: `${file.name}-`,
            total: pageCount
          };
          break;

        case 'custom':
          // Use custom numbering if provided in file metadata
          const customPrefix = file.customNumbering?.prefix || `${index + 1}-`;
          const customStart = file.customNumbering?.start || 1;
          pageNumbers[file.name] = {
            start: customStart,
            end: customStart + pageCount - 1,
            prefix: customPrefix,
            total: pageCount
          };
          break;
      }
    });

    return pageNumbers;
  }

  /**
   * Format simple list index
   * @param {Array<Object>} files - Array of file objects
   * @param {Object} descriptions - File descriptions
   * @param {Object} pageNumbers - Page number mapping
   * @returns {Array} Formatted index entries
   */
  formatSimpleList(files, descriptions, pageNumbers) {
    return files.map(file => {
      const pages = pageNumbers[file.name];
      return {
        title: file.name,
        pages: `${pages.prefix}${pages.start}-${pages.prefix}${pages.end}`,
        description: descriptions[file.name] || '',
        level: 0
      };
    });
  }

  /**
   * Format detailed list index
   * @param {Array<Object>} files - Array of file objects
   * @param {Object} descriptions - File descriptions
   * @param {Object} pageNumbers - Page number mapping
   * @returns {Array} Formatted index entries
   */
  formatDetailedList(files, descriptions, pageNumbers) {
    return files.map(file => {
      const pages = pageNumbers[file.name];
      return {
        title: file.name,
        pages: `${pages.prefix}${pages.start}-${pages.prefix}${pages.end}`,
        description: descriptions[file.name] || '',
        level: 0,
        metadata: {
          size: file.size,
          type: file.type,
          uploadedAt: file.uploadedAt,
          wordCount: file.wordCount || 0
        }
      };
    });
  }

  /**
   * Format hierarchical index
   * @param {Array<Object>} files - Array of file objects
   * @param {Object} descriptions - File descriptions
   * @param {Object} pageNumbers - Page number mapping
   * @param {Object} structure - Hierarchical structure
   * @returns {Array} Formatted index entries
   */
  formatHierarchicalIndex(files, descriptions, pageNumbers, structure) {
    if (!structure) {
      // Create basic structure from file organization
      structure = this.createBasicStructure(files);
    }

    const index = [];

    const processNode = (node, level = 0) => {
      if (node.files) {
        // Process section
        index.push({
          title: node.title,
          pages: '',
          description: node.description || '',
          level,
          isSection: true
        });

        // Process files in section
        node.files.forEach(fileName => {
          const file = files.find(f => f.name === fileName);
          if (file) {
            const pages = pageNumbers[fileName];
            index.push({
              title: file.name,
              pages: `${pages.prefix}${pages.start}-${pages.prefix}${pages.end}`,
              description: descriptions[fileName] || '',
              level: level + 1
            });
          }
        });
      }

      // Process subsections
      if (node.children) {
        node.children.forEach(child => processNode(child, level + 1));
      }
    };

    processNode(structure);
    return index;
  }

  /**
   * Create basic hierarchical structure from files
   * @param {Array<Object>} files - Array of file objects
   * @returns {Object} Basic structure
   */
  createBasicStructure(files) {
    const structure = {
      title: 'Documents',
      description: 'All documents',
      files: [],
      children: []
    };

    // Group files by type or category if possible
    const groups = {};
    files.forEach(file => {
      const category = this.getFileCategory(file);
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(file.name);
    });

    if (Object.keys(groups).length > 1) {
      // Create sections for each category
      Object.entries(groups).forEach(([category, fileNames]) => {
        structure.children.push({
          title: category,
          description: `${category} documents`,
          files: fileNames
        });
      });
    } else {
      // Single section with all files
      structure.files = files.map(f => f.name);
    }

    return structure;
  }

  /**
   * Get file category based on name or type
   * @param {Object} file - File object
   * @returns {string} Category name
   */
  getFileCategory(file) {
    // Simple categorization based on file name patterns
    const name = file.name.toLowerCase();
    
    if (name.includes('contract') || name.includes('agreement')) {
      return 'Contracts';
    } else if (name.includes('invoice') || name.includes('receipt')) {
      return 'Financial';
    } else if (name.includes('report')) {
      return 'Reports';
    } else if (name.includes('letter') || name.includes('memo')) {
      return 'Correspondence';
    } else if (name.includes('form')) {
      return 'Forms';
    } else {
      return 'General';
    }
  }

  /**
   * Export document index to various formats
   * @param {Object} indexData - Generated index data
   * @param {string} format - Export format
   * @returns {string|Blob} Exported content
   */
  exportDocumentIndex(indexData, format = 'text') {
    const { index, metadata, type } = indexData;

    switch (format.toLowerCase()) {
      case 'text':
        return this.exportIndexAsText(index, metadata);
      
      case 'json':
        return JSON.stringify(indexData, null, 2);
      
      case 'pdf':
        return this.exportIndexAsPDF(indexData);
      
      case 'html':
        return this.exportIndexAsHTML(index, metadata);
      
      case 'markdown':
        return this.exportIndexAsMarkdown(index, metadata);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export index as plain text
   * @param {Array} index - Index entries
   * @param {Object} metadata - Index metadata
   * @returns {string} Text format
   */
  exportIndexAsText(index, metadata) {
    let text = `DOCUMENT INDEX\n`;
    text += `Generated: ${metadata.generatedAt}\n`;
    text += `Total Files: ${metadata.totalFiles}\n\n`;

    index.forEach(entry => {
      const indent = '  '.repeat(entry.level);
      text += `${indent}${entry.title}`;
      if (entry.pages) {
        text += ` .............. ${entry.pages}`;
      }
      text += '\n';
      
      if (entry.description && metadata.includeDescriptions) {
        text += `${indent}  ${entry.description}\n`;
      }
      text += '\n';
    });

    return text;
  }

  /**
   * Export index as HTML
   * @param {Array} index - Index entries
   * @param {Object} metadata - Index metadata
   * @returns {string} HTML format
   */
  exportIndexAsHTML(index, metadata) {
    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Document Index</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    .index-header { margin-bottom: 30px; }
    .index-entry { margin: 5px 0; }
    .section { font-weight: bold; margin-top: 15px; }
    .pages { color: #666; margin-left: 20px; }
    .description { color: #555; font-size: 0.9em; margin-left: 40px; }
    .level-1 { margin-left: 20px; }
    .level-2 { margin-left: 40px; }
  </style>
</head>
<body>
  <div class="index-header">
    <h1>Document Index</h1>
    <p>Generated: ${new Date(metadata.generatedAt).toLocaleString()}</p>
    <p>Total Files: ${metadata.totalFiles}</p>
  </div>
  <div class="index-content">
`;

    index.forEach(entry => {
      const className = entry.level > 0 ? `level-${entry.level}` : '';
      const sectionClass = entry.isSection ? 'section' : '';
      
      html += `  <div class="index-entry ${className} ${sectionClass}">`;
      html += `${entry.title}`;
      
      if (entry.pages) {
        html += ` <span class="pages">${entry.pages}</span>`;
      }
      
      html += '</div>\n';
      
      if (entry.description && metadata.includeDescriptions) {
        html += `  <div class="description">${entry.description}</div>\n`;
      }
    });

    html += `
  </div>
</body>
</html>`;

    return html;
  }

  /**
   * Export index as Markdown
   * @param {Array} index - Index entries
   * @param {Object} metadata - Index metadata
   * @returns {string} Markdown format
   */
  exportIndexAsMarkdown(index, metadata) {
    let md = `# Document Index\n\n`;
    md += `*Generated: ${new Date(metadata.generatedAt).toLocaleString()}*\n`;
    md += `*Total Files: ${metadata.totalFiles}*\n\n`;

    index.forEach(entry => {
      const indent = '#'.repeat(Math.min(entry.level + 1, 6));
      md += `${indent} ${entry.title}`;
      
      if (entry.pages) {
        md += ` \\- ${entry.pages}`;
      }
      
      md += '\n';
      
      if (entry.description && metadata.includeDescriptions) {
        md += `*${entry.description}*\n`;
      }
      md += '\n';
    });

    return md;
  }

  /**
   * Export index as PDF (placeholder - would need PDF library)
   * @param {Object} indexData - Complete index data
   * @returns {Promise<Blob>} PDF blob
   */
  async exportIndexAsPDF(indexData) {
    // This would typically use a PDF generation library like jsPDF or PDFKit
    // For now, we'll return HTML that could be converted to PDF
    const html = this.exportIndexAsHTML(indexData.index, indexData.metadata);
    
    // In a real implementation, this would:
    // 1. Create a PDF document
    // 2. Add title and metadata
    // 3. Format and add index entries
    // 4. Return PDF blob
    
    // For now, return the HTML with instructions
    console.warn('PDF export requires a PDF generation library');
    return new Blob([html], { type: 'text/html' });
  }
}