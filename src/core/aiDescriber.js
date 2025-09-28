/**
 * AI Description Module
 * 
 * Generates AI-powered descriptions and summaries for PDF content.
 * This module analyzes text content and provides intelligent descriptions.
 * 
 * Note: This is a client-side implementation. For actual AI capabilities,
 * you would need to integrate with an AI service API.
 * 
 * @version 1.0.0
 * @author Client-Side PDF Processor Team
 */

/**
 * AIDescriber Class
 * 
 * Provides methods for generating AI-powered content descriptions.
 */
export class AIDescriber {
  constructor() {
    // Configuration for description generation
    this.config = {
      maxSummaryLength: 500,
      minSummaryLength: 50,
      keywordCount: 10,
      sentimentEnabled: true,
    };
  }

  /**
   * Generate a description for PDF text content
   * @param {string} textContent - Text content from PDF
   * @returns {Promise<Object>} Generated description and analysis
   */
  async generateDescription(textContent) {
    try {
      if (!textContent || textContent.trim().length === 0) {
        throw new Error('No text content provided');
      }

      // Basic text analysis (client-side implementation)
      const analysis = this.analyzeText(textContent);
      
      // Generate description based on analysis
      const description = {
        summary: this.generateSummary(textContent, analysis),
        keywords: analysis.keywords,
        sentiment: analysis.sentiment,
        category: this.categorizeContent(textContent, analysis),
        readingTime: this.estimateReadingTime(textContent),
        complexity: this.assessComplexity(textContent, analysis),
        language: this.detectLanguage(textContent),
        topics: this.extractTopics(textContent, analysis),
      };

      return description;
    } catch (error) {
      console.error('Error generating AI description:', error);
      throw new Error('Failed to generate description');
    }
  }

  /**
   * Analyze text content for key metrics
   * @param {string} text - Text to analyze
   * @returns {Object} Analysis results
   */
  analyzeText(text) {
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const wordFreq = {};
    
    // Calculate word frequency
    words.forEach(word => {
      if (word.length > 2) { // Ignore very short words
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });
    
    // Extract keywords (most frequent words)
    const keywords = Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, this.config.keywordCount)
      .map(([word]) => word);
    
    // Basic sentiment analysis
    const sentiment = this.analyzeSentiment(text);
    
    return {
      wordCount: words.length,
      sentenceCount: sentences.length,
      averageWordsPerSentence: words.length / sentences.length,
      uniqueWords: Object.keys(wordFreq).length,
      keywords,
      sentiment,
    };
  }

  /**
   * Generate a summary of the text content
   * @param {string} text - Original text
   * @param {Object} analysis - Text analysis
   * @returns {string} Generated summary
   */
  generateSummary(text, analysis) {
    // Simple extractive summarization
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length <= 3) {
      return text.substring(0, this.config.maxSummaryLength);
    }
    
    // Score sentences based on keyword presence and position
    const scoredSentences = sentences.map((sentence, index) => {
      const sentenceWords = sentence.toLowerCase().match(/\b\w+\b/g) || [];
      let score = 0;
      
      // Score based on keywords
      sentenceWords.forEach(word => {
        if (analysis.keywords.includes(word)) {
          score += analysis.keywords.indexOf(word) + 1;
        }
      });
      
      // Bonus for position (first and last sentences often important)
      if (index === 0 || index === sentences.length - 1) {
        score += 5;
      }
      
      // Normalize by sentence length
      score = score / Math.max(sentenceWords.length, 1);
      
      return { sentence, score, index };
    });
    
    // Select top sentences
    const topSentences = scoredSentences
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.ceil(sentences.length * 0.3))
      .sort((a, b) => a.index - b.index);
    
    let summary = topSentences.map(s => s.sentence.trim()).join('. ') + '.';
    
    // Truncate if too long
    if (summary.length > this.config.maxSummaryLength) {
      summary = summary.substring(0, this.config.maxSummaryLength - 3) + '...';
    }
    
    return summary;
  }

  /**
   * Basic sentiment analysis
   * @param {string} text - Text to analyze
   * @returns {Object} Sentiment analysis results
   */
  analyzeSentiment(text) {
    // Simple positive/negative word lists
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'like', 'best', 'awesome', 'perfect', 'success', 'positive', 'benefit', 'advantage'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'disaster', 'failure', 'negative', 'problem', 'issue', 'difficult', 'challenge', 'concern'];
    
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) positiveCount++;
      if (negativeWords.includes(word)) negativeCount++;
    });
    
    const total = positiveCount + negativeCount;
    
    if (total === 0) {
      return { score: 0, label: 'neutral' };
    }
    
    const score = (positiveCount - negativeCount) / total;
    
    let label = 'neutral';
    if (score > 0.2) label = 'positive';
    else if (score < -0.2) label = 'negative';
    
    return { score, label };
  }

  /**
   * Categorize content based on text analysis
   * @param {string} text - Text content
   * @param {Object} analysis - Text analysis
   * @returns {string} Content category
   */
  categorizeContent(text, analysis) {
    const lowerText = text.toLowerCase();
    
    // Simple category detection based on keywords
    const categories = {
      legal: ['law', 'legal', 'court', 'judge', 'attorney', 'contract', 'agreement', 'litigation'],
      financial: ['money', 'financial', 'budget', 'revenue', 'cost', 'profit', 'investment', 'finance'],
      technical: ['technical', 'technology', 'software', 'system', 'data', 'code', 'programming', 'development'],
      medical: ['medical', 'health', 'patient', 'doctor', 'treatment', 'medicine', 'clinical', 'diagnosis'],
      academic: ['research', 'study', 'university', 'education', 'analysis', 'theory', 'hypothesis'],
      business: ['business', 'company', 'market', 'customer', 'product', 'service', 'management'],
    };
    
    let maxScore = 0;
    let category = 'general';
    
    Object.entries(categories).forEach(([cat, keywords]) => {
      const score = keywords.reduce((sum, keyword) => {
        const regex = new RegExp(keyword, 'gi');
        const matches = lowerText.match(regex);
        return sum + (matches ? matches.length : 0);
      }, 0);
      
      if (score > maxScore) {
        maxScore = score;
        category = cat;
      }
    });
    
    return category;
  }

  /**
   * Estimate reading time in minutes
   * @param {string} text - Text content
   * @returns {number} Estimated reading time in minutes
   */
  estimateReadingTime(text) {
    const wordsPerMinute = 200; // Average reading speed
    const words = text.match(/\b\w+\b/g) || [];
    return Math.ceil(words.length / wordsPerMinute);
  }

  /**
   * Assess text complexity
   * @param {string} text - Text content
   * @param {Object} analysis - Text analysis
   * @returns {string} Complexity level
   */
  assessComplexity(text, analysis) {
    const avgWordsPerSentence = analysis.averageWordsPerSentence;
    const uniqueWordRatio = analysis.uniqueWords / analysis.wordCount;
    
    if (avgWordsPerSentence < 10 && uniqueWordRatio < 0.1) {
      return 'simple';
    } else if (avgWordsPerSentence < 15 && uniqueWordRatio < 0.15) {
      return 'moderate';
    } else {
      return 'complex';
    }
  }

  /**
   * Detect document language
   * @param {string} text - Text content
   * @returns {string} Detected language code
   */
  detectLanguage(text) {
    // Simple language detection based on common words
    const samples = text.substring(0, 1000).toLowerCase();
    
    const languagePatterns = {
      en: ['the', 'and', 'is', 'in', 'to', 'of', 'a', 'that', 'it', 'with'],
      es: ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se'],
      fr: ['le', 'de', 'et', 'à', 'un', 'il', 'être', 'et', 'en', 'avoir'],
      de: ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich'],
      it: ['il', 'di', 'e', 'il', 'che', 'la', 'in', 'a', 'da', 'un'],
    };
    
    let maxMatches = 0;
    let detectedLang = 'en'; // Default to English
    
    Object.entries(languagePatterns).forEach(([lang, patterns]) => {
      const matches = patterns.reduce((sum, pattern) => {
        const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
        const found = samples.match(regex);
        return sum + (found ? found.length : 0);
      }, 0);
      
      if (matches > maxMatches) {
        maxMatches = matches;
        detectedLang = lang;
      }
    });
    
    return detectedLang;
  }

  /**
   * Extract main topics from text
   * @param {string} text - Text content
   * @param {Object} analysis - Text analysis
   * @returns {Array<string>} Array of topics
   */
  extractTopics(text, analysis) {
    // Extract noun phrases (simplified approach)
    const sentences = text.split(/[.!?]+/);
    const topics = new Set();
    
    sentences.forEach(sentence => {
      const words = sentence.trim().toLowerCase().match(/\b\w+\b/g) || [];
      
      // Look for potential topic indicators (capitalized words, repeated terms)
      for (let i = 0; i < words.length - 1; i++) {
        if (analysis.keywords.includes(words[i])) {
          // Create simple 2-gram topics
          if (i < words.length - 1 && analysis.keywords.includes(words[i + 1])) {
            topics.add(`${words[i]} ${words[i + 1]}`);
          } else {
            topics.add(words[i]);
          }
        }
      }
    });
    
    return Array.from(topics).slice(0, 5);
  }
}