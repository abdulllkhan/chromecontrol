/**
 * Intelligent Text Extraction Engine
 * 
 * This service provides intelligent text extraction that replaces simple HTML text copying
 * with semantic content parsing that preserves structure while removing noise.
 * It implements readability-style parsing for main content area detection.
 */

import {
  CleanTextContent,
  TextBlock,
  ListBlock,
  ContentMetadata,
  PageContent
} from '../types/index.js';

// ============================================================================
// CONTENT SCORING CONSTANTS
// ============================================================================

const CONTENT_SCORING = {
  // Positive indicators for main content
  POSITIVE_CLASSES: [
    'content', 'article', 'main', 'post', 'entry', 'text', 'body',
    'story', 'news', 'blog', 'description', 'summary'
  ],
  POSITIVE_IDS: [
    'content', 'article', 'main', 'post', 'entry', 'text', 'body',
    'story', 'news', 'blog', 'description', 'summary'
  ],
  POSITIVE_TAGS: ['article', 'main', 'section', 'p', 'div'],
  
  // Negative indicators for noise content
  NEGATIVE_CLASSES: [
    'nav', 'navigation', 'menu', 'sidebar', 'aside', 'footer', 'header',
    'ad', 'ads', 'advertisement', 'banner', 'popup', 'modal',
    'comment', 'comments', 'social', 'share', 'related', 'recommended',
    'widget', 'plugin', 'embed', 'iframe', 'script', 'style'
  ],
  NEGATIVE_IDS: [
    'nav', 'navigation', 'menu', 'sidebar', 'aside', 'footer', 'header',
    'ad', 'ads', 'advertisement', 'banner', 'popup', 'modal',
    'comment', 'comments', 'social', 'share', 'related', 'recommended'
  ],
  NEGATIVE_TAGS: ['nav', 'aside', 'footer', 'header', 'script', 'style', 'noscript'],
  
  // Scoring weights
  WEIGHTS: {
    POSITIVE_CLASS: 25,
    POSITIVE_ID: 25,
    POSITIVE_TAG: 5,
    NEGATIVE_CLASS: -25,
    NEGATIVE_ID: -25,
    NEGATIVE_TAG: -15,
    TEXT_LENGTH: 1,
    PARAGRAPH_COUNT: 8,
    LINK_DENSITY_PENALTY: -25,
    COMMA_COUNT: 2
  }
};

const NOISE_PATTERNS = [
  // Common noise patterns to remove
  /^\s*\d+\s*$/g, // Just numbers
  /^[\s\W]*$/g, // Just whitespace and punctuation
  /(click here|read more|continue reading|learn more|see more)/gi,
  /(advertisement|sponsored|promoted)/gi,
  /(share|like|tweet|pin|follow)/gi,
  /(cookie|privacy|terms|policy)/gi
];

// ============================================================================
// TEXT EXTRACTION ENGINE CLASS
// ============================================================================

export class TextExtractionEngine {
  /**
   * Extracts clean, structured content from a DOM document
   */
  public extractCleanContent(document: Document): CleanTextContent {
    try {
      // Extract all types of code content
      const allCodeContent = this.extractAllCodeContent(document);

      // If we have code content, return it as the main content
      if (allCodeContent && allCodeContent.mainText.length > 10) {
        return allCodeContent;
      }

      // Find main content areas
      const mainContentElements = this.identifyMainContent(document);

      // Extract structured content from main areas
      const extractedContent = this.extractStructuredContent(mainContentElements);

      // Clean and process the content
      const cleanContent = this.processExtractedContent(extractedContent);

      return cleanContent;
    } catch (error) {
      console.error('Error extracting clean content:', error);

      // Fallback to basic extraction
      return this.fallbackExtraction(document);
    }
  }

  /**
   * Extracts clean content from selected text
   */
  public extractSelectedContent(selection: Selection): CleanTextContent {
    try {
      if (!selection || selection.rangeCount === 0) {
        return this.createEmptyContent();
      }

      const range = selection.getRangeAt(0);

      // Create a temporary element to hold the selection
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(range.cloneContents());
      
      // Extract content from the temporary element
      const extractedContent = this.extractStructuredContent([tempDiv]);
      const cleanContent = this.processExtractedContent(extractedContent);
      
      return cleanContent;
    } catch (error) {
      console.error('Error extracting selected content:', error);
      return this.createEmptyContent();
    }
  }

  /**
   * Identifies main content areas using readability-style algorithms
   */
  public identifyMainContent(document: Document): Element[] {
    const candidates: Array<{ element: Element; score: number }> = [];
    
    // Get all potential content containers
    const elements = Array.from(document.querySelectorAll('div, article, section, main, p'));
    
    for (const element of elements) {
      const score = this.scoreElement(element);
      candidates.push({ element, score });
    }
    
    // Sort by score and return top candidates
    candidates.sort((a, b) => b.score - a.score);
    
    // If no high-scoring elements, use a lower threshold
    const topScore = candidates[0]?.score || 0;
    const threshold = topScore > 50 ? Math.max(topScore * 0.3, 25) : 0;
    
    const mainElements = candidates
      .filter(candidate => candidate.score >= threshold)
      .slice(0, 5) // Limit to top 5 elements
      .map(candidate => candidate.element);
    
    // If no elements found, fallback to body or any content-bearing elements
    if (mainElements.length === 0) {
      const fallbackElements = document.querySelectorAll('body, main, article, section, div');
      return Array.from(fallbackElements).slice(0, 3);
    }
    
    return mainElements;
  }

  /**
   * Removes noise elements and cleans text content
   */
  public removeNoiseElements(content: string): string {
    if (!content) return '';
    
    let cleaned = content;
    
    // Remove noise patterns
    for (const pattern of NOISE_PATTERNS) {
      cleaned = cleaned.replace(pattern, ' ');
    }
    
    // Clean up whitespace
    cleaned = cleaned
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/\n\s*\n/g, '\n') // Multiple newlines to single newline
      .trim();
    
    return cleaned;
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Scores an element based on content quality indicators
   */
  private scoreElement(element: Element): number {
    let score = 0;
    
    // Get element attributes
    const className = (element.className || '').toLowerCase();
    const id = (element.id || '').toLowerCase();
    const tagName = element.tagName.toLowerCase();
    
    // Positive scoring
    for (const positiveClass of CONTENT_SCORING.POSITIVE_CLASSES) {
      if (className.includes(positiveClass)) {
        score += CONTENT_SCORING.WEIGHTS.POSITIVE_CLASS;
      }
    }
    
    for (const positiveId of CONTENT_SCORING.POSITIVE_IDS) {
      if (id.includes(positiveId)) {
        score += CONTENT_SCORING.WEIGHTS.POSITIVE_ID;
      }
    }
    
    if (CONTENT_SCORING.POSITIVE_TAGS.includes(tagName)) {
      score += CONTENT_SCORING.WEIGHTS.POSITIVE_TAG;
    }
    
    // Negative scoring
    for (const negativeClass of CONTENT_SCORING.NEGATIVE_CLASSES) {
      if (className.includes(negativeClass)) {
        score += CONTENT_SCORING.WEIGHTS.NEGATIVE_CLASS;
      }
    }
    
    for (const negativeId of CONTENT_SCORING.NEGATIVE_IDS) {
      if (id.includes(negativeId)) {
        score += CONTENT_SCORING.WEIGHTS.NEGATIVE_ID;
      }
    }
    
    if (CONTENT_SCORING.NEGATIVE_TAGS.includes(tagName)) {
      score += CONTENT_SCORING.WEIGHTS.NEGATIVE_TAG;
    }
    
    // Content quality scoring
    const textContent = element.textContent || '';
    const textLength = textContent.trim().length;
    
    if (textLength > 0) {
      score += Math.min(textLength / 25, 50); // Cap text length bonus
      
      // Count paragraphs
      const paragraphs = element.querySelectorAll('p').length;
      score += paragraphs * CONTENT_SCORING.WEIGHTS.PARAGRAPH_COUNT;
      
      // Penalize high link density
      const links = element.querySelectorAll('a').length;
      const linkDensity = links / Math.max(textLength / 100, 1);
      if (linkDensity > 0.5) {
        score += CONTENT_SCORING.WEIGHTS.LINK_DENSITY_PENALTY;
      }
      
      // Bonus for comma count (indicates structured content)
      const commas = (textContent.match(/,/g) || []).length;
      score += commas * CONTENT_SCORING.WEIGHTS.COMMA_COUNT;
    }
    
    return score;
  }

  /**
   * Extracts structured content from main content elements
   */
  private extractStructuredContent(elements: Element[]): {
    headings: TextBlock[];
    paragraphs: TextBlock[];
    lists: ListBlock[];
    mainText: string;
  } {
    const headings: TextBlock[] = [];
    const paragraphs: TextBlock[] = [];
    const lists: ListBlock[] = [];
    const textParts: string[] = [];
    
    for (const element of elements) {
      // Skip elements that are likely noise based on their attributes
      if (this.isNoiseElement(element)) {
        continue;
      }
      
      // Extract headings
      const headingElements = Array.from(element.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      for (const heading of headingElements) {
        if (!this.isNoiseElement(heading)) {
          const content = this.cleanText(heading.textContent || '');
          if (content) {
            const level = parseInt(heading.tagName.charAt(1));
            headings.push({
              content,
              level,
              context: this.getElementContext(heading)
            });
          }
        }
      }
      
      // Extract paragraphs
      const paragraphElements = Array.from(element.querySelectorAll('p'));
      for (const paragraph of paragraphElements) {
        if (!this.isNoiseElement(paragraph)) {
          const content = this.cleanText(paragraph.textContent || '');
          if (content && content.length > 20) { // Filter out very short paragraphs
            paragraphs.push({
              content,
              context: this.getElementContext(paragraph)
            });
          }
        }
      }
      
      // Extract lists
      const listElements = Array.from(element.querySelectorAll('ul, ol'));
      for (const list of listElements) {
        if (!this.isNoiseElement(list)) {
          const items = Array.from(list.querySelectorAll('li'))
            .map(li => this.cleanText((li as HTMLElement).textContent || ''))
            .filter(item => item.length > 0);
          
          if (items.length > 0) {
            lists.push({
              type: list.tagName.toLowerCase() === 'ol' ? 'ordered' : 'unordered',
              items,
              context: this.getElementContext(list)
            });
          }
        }
      }
      
      // Collect main text (filter out noise elements)
      const cleanedElement = this.removeNoiseFromElement(element);
      const elementText = this.cleanText(cleanedElement.textContent || '');
      if (elementText) {
        textParts.push(elementText);
      }
    }
    
    return {
      headings,
      paragraphs,
      lists,
      mainText: textParts.join('\n\n')
    };
  }

  /**
   * Processes and cleans extracted content
   */
  private processExtractedContent(extracted: {
    headings: TextBlock[];
    paragraphs: TextBlock[];
    lists: ListBlock[];
    mainText: string;
  }): CleanTextContent {
    // Remove duplicates and clean content
    const uniqueHeadings = this.removeDuplicateTextBlocks(extracted.headings);
    const uniqueParagraphs = this.removeDuplicateTextBlocks(extracted.paragraphs);
    const uniqueLists = this.removeDuplicateLists(extracted.lists);
    
    // Clean main text
    const cleanMainText = this.removeNoiseElements(extracted.mainText);
    
    // Generate metadata
    const metadata = this.generateContentMetadata(cleanMainText, uniqueParagraphs);
    
    return {
      mainText: cleanMainText,
      headings: uniqueHeadings,
      paragraphs: uniqueParagraphs,
      lists: uniqueLists,
      metadata
    };
  }

  /**
   * Cleans text content by removing extra whitespace and noise
   */
  private cleanText(text: string, preserveFormatting: boolean = false): string {
    if (!text) return '';

    if (preserveFormatting) {
      // For code content, preserve formatting
      return text.trim();
    }

    return text
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/[\r\n]+/g, ' ') // Newlines to spaces
      .trim();
  }

  /**
   * Gets context information for an element
   */
  private getElementContext(element: Element): string {
    const parent = element.parentElement;
    if (!parent) return 'root';
    
    const parentTag = parent.tagName.toLowerCase();
    const parentClass = parent.className ? `.${parent.className.split(' ')[0]}` : '';
    const parentId = parent.id ? `#${parent.id}` : '';
    
    return `${parentTag}${parentId}${parentClass}`;
  }

  /**
   * Removes duplicate text blocks based on content similarity
   */
  private removeDuplicateTextBlocks(blocks: TextBlock[]): TextBlock[] {
    const unique: TextBlock[] = [];
    const seen = new Set<string>();
    
    for (const block of blocks) {
      const normalized = block.content.toLowerCase().replace(/\s+/g, ' ').trim();
      if (!seen.has(normalized) && normalized.length > 10) {
        seen.add(normalized);
        unique.push(block);
      }
    }
    
    return unique;
  }

  /**
   * Removes duplicate lists based on content similarity
   */
  private removeDuplicateLists(lists: ListBlock[]): ListBlock[] {
    const unique: ListBlock[] = [];
    const seen = new Set<string>();
    
    for (const list of lists) {
      const signature = `${list.type}:${list.items.join('|')}`;
      if (!seen.has(signature)) {
        seen.add(signature);
        unique.push(list);
      }
    }
    
    return unique;
  }

  /**
   * Generates content metadata
   */
  private generateContentMetadata(mainText: string, paragraphs: TextBlock[], extractionType?: string, codeBlocks?: number): ContentMetadata {
    const wordCount = this.countWords(mainText);
    const readingTime = Math.ceil(wordCount / 200); // Assume 200 WPM reading speed

    // Detect language (basic heuristic)
    const language = extractionType === 'code-focused' ? 'code' : this.detectLanguage(mainText);

    const metadata: ContentMetadata = {
      wordCount,
      readingTime,
      language,
      extractedAt: new Date(),
      paragraphCount: paragraphs.length,
      hasStructuredContent: paragraphs.length > 0
    };

    if (extractionType) {
      (metadata as any).extractionType = extractionType;
    }

    if (codeBlocks !== undefined) {
      (metadata as any).codeBlocks = codeBlocks;
    }

    return metadata;
  }

  /**
   * Counts words in text
   */
  private countWords(text: string): number {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Basic language detection
   */
  private detectLanguage(text: string): string {
    if (!text || text.length < 50) return 'unknown';
    
    // Simple heuristic based on common words
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const words = text.toLowerCase().split(/\s+/);
    const englishMatches = words.filter(word => englishWords.includes(word)).length;
    
    if (englishMatches / words.length > 0.05) {
      return 'en';
    }
    
    return 'unknown';
  }

  /**
   * Creates empty content structure
   */
  private createEmptyContent(): CleanTextContent {
    return {
      mainText: '',
      headings: [],
      paragraphs: [],
      lists: [],
      metadata: {
        wordCount: 0,
        readingTime: 0,
        language: 'unknown',
        extractedAt: new Date(),
        paragraphCount: 0,
        hasStructuredContent: false
      }
    };
  }

  /**
   * Checks if an element is likely noise content
   */
  private isNoiseElement(element: Element): boolean {
    const className = (element.className || '').toLowerCase();
    const id = (element.id || '').toLowerCase();
    const tagName = element.tagName.toLowerCase();
    
    // Check for noise classes
    for (const noiseClass of CONTENT_SCORING.NEGATIVE_CLASSES) {
      if (className.includes(noiseClass)) {
        return true;
      }
    }
    
    // Check for noise IDs
    for (const noiseId of CONTENT_SCORING.NEGATIVE_IDS) {
      if (id.includes(noiseId)) {
        return true;
      }
    }
    
    // Check for noise tags
    if (CONTENT_SCORING.NEGATIVE_TAGS.includes(tagName)) {
      return true;
    }
    
    return false;
  }

  /**
   * Removes noise elements from a cloned element
   */
  private removeNoiseFromElement(element: Element): Element {
    const cloned = element.cloneNode(true) as Element;
    
    // Remove noise elements
    const noiseSelectors = [
      '.ad', '.ads', '.advertisement', '.banner',
      '.nav', '.navigation', '.menu', '.sidebar', '.aside',
      '.footer', '.header', '.comment', '.comments',
      '.social', '.share', '.related', '.recommended',
      'nav', 'aside', 'footer', 'header', 'script', 'style', 'noscript'
    ];
    
    for (const selector of noiseSelectors) {
      const noiseElements = Array.from(cloned.querySelectorAll(selector));
      for (const noiseElement of noiseElements) {
        noiseElement.remove();
      }
    }
    
    return cloned;
  }

  /**
   * Extracts all code content from the page, combining multiple sources
   */
  private extractAllCodeContent(document: Document): CleanTextContent | null {
    const allContent: string[] = [];
    const allHeadings: TextBlock[] = [];
    const allParagraphs: TextBlock[] = [];
    let totalCodeBlocks = 0;

    // Try each extraction method and combine results
    const extractors = [
      () => this.extractMonacoEditorContent(document),
      () => this.extractCodeMirrorContent(document),
      () => this.extractContentEditableCode(document),
      () => this.extractGenericCodeBlocks(document)
    ];

    for (const extractor of extractors) {
      const result = extractor();
      if (result && result.mainText.length > 10) {
        allContent.push(result.mainText);
        allHeadings.push(...result.headings);
        allParagraphs.push(...result.paragraphs);
        if ((result.metadata as any).codeBlocks) {
          totalCodeBlocks += (result.metadata as any).codeBlocks;
        }
      }
    }

    if (allContent.length === 0) return null;

    // Combine all content
    const combinedContent = allContent.join('\n\n');

    return {
      mainText: combinedContent,
      headings: allHeadings,
      paragraphs: allParagraphs,
      lists: [],
      metadata: this.generateContentMetadata(combinedContent, allParagraphs, 'code-focused', totalCodeBlocks)
    };
  }

  /**
   * Extracts code content from code editors (Monaco, CodeMirror, etc.)
   */
  private extractCodeContent(document: Document): CleanTextContent | null {
    const codeExtractors = [
      // Monaco Editor (used by LeetCode, VS Code online, etc.)
      () => this.extractMonacoEditorContent(document),
      // CodeMirror
      () => this.extractCodeMirrorContent(document),
      // Generic code blocks
      () => this.extractGenericCodeBlocks(document),
      // Contenteditable code areas
      () => this.extractContentEditableCode(document)
    ];

    for (const extractor of codeExtractors) {
      const result = extractor();
      if (result && result.mainText.length > 10) {
        return result;
      }
    }

    return null;
  }

  /**
   * Extracts code from Monaco Editor (LeetCode, VS Code online)
   */
  private extractMonacoEditorContent(document: Document): CleanTextContent | null {
    // Check for Monaco editor
    const monacoEditor = document.querySelector('.monaco-editor');
    if (!monacoEditor) return null;

    let codeContent = '';
    let codeBlocks = 0;

    // Method 1: Extract from view-lines (visible code)
    const viewLines = monacoEditor.querySelectorAll('.view-lines .view-line');
    if (viewLines.length > 0) {
      const lines: string[] = [];
      viewLines.forEach(line => {
        const text = (line as HTMLElement).textContent || '';
        lines.push(text);
      });
      codeContent = lines.join('\n');
      codeBlocks++;
    }

    // Method 2: Extract from textarea (input area) - useful for incomplete code
    const textarea = monacoEditor.querySelector('textarea.inputarea, textarea.monaco-mouse-cursor-text');
    if (textarea && (textarea as HTMLTextAreaElement).value) {
      const textareaContent = (textarea as HTMLTextAreaElement).value;
      if (textareaContent.length > codeContent.length) {
        codeContent = textareaContent;
      }
      if (textareaContent.length > 10) codeBlocks++;
    }

    // Method 3: Check for hidden input areas or data attributes
    const hiddenInputs = monacoEditor.querySelectorAll('input[type="hidden"], [data-value], [data-code]');
    hiddenInputs.forEach(input => {
      const value = (input as HTMLInputElement).value ||
                   input.getAttribute('data-value') ||
                   input.getAttribute('data-code');
      if (value && value.length > codeContent.length) {
        codeContent = value;
      }
    });

    if (codeContent.length < 10) return null;

    // Also extract problem description if available
    const problemContent = this.extractProblemDescription(document);
    const { headings, paragraphs } = problemContent;

    // Format the content with "Editor Content" header
    const formattedContent = `=== Editor Content ===\n${codeContent}`;

    return {
      mainText: formattedContent,
      headings,
      paragraphs,
      lists: [],
      metadata: this.generateContentMetadata(formattedContent, paragraphs, 'code-focused', codeBlocks)
    };
  }

  /**
   * Extracts code from CodeMirror editor
   */
  private extractCodeMirrorContent(document: Document): CleanTextContent | null {
    const codeMirror = document.querySelector('.CodeMirror');
    if (!codeMirror) return null;

    let codeContent = '';
    let codeBlocks = 0;

    // Extract from CodeMirror lines
    const codeLines = codeMirror.querySelectorAll('.CodeMirror-line');
    if (codeLines.length > 0) {
      const lines: string[] = [];
      codeLines.forEach(line => {
        const text = (line as HTMLElement).textContent || '';
        lines.push(text);
      });
      codeContent = lines.join('\n');
      codeBlocks++;
    }

    // Check for CodeMirror textarea
    const textarea = codeMirror.querySelector('textarea');
    if (textarea && (textarea as HTMLTextAreaElement).value) {
      const textareaContent = (textarea as HTMLTextAreaElement).value;
      if (textareaContent.length > codeContent.length) {
        codeContent = textareaContent;
      }
      if (textareaContent.length > 10) codeBlocks++;
    }

    if (codeContent.length < 10) return null;

    const problemContent = this.extractProblemDescription(document);
    const { headings, paragraphs } = problemContent;

    // Format the content with "Editor Content" header
    const formattedContent = `=== Editor Content ===\n${codeContent}`;

    return {
      mainText: formattedContent,
      headings,
      paragraphs,
      lists: [],
      metadata: this.generateContentMetadata(formattedContent, paragraphs, 'code-focused', codeBlocks)
    };
  }

  /**
   * Extracts code from generic pre/code blocks
   */
  private extractGenericCodeBlocks(document: Document): CleanTextContent | null {
    const codeBlocks = document.querySelectorAll('pre code, pre.code, .code-block, .highlight, pre');
    if (codeBlocks.length === 0) return null;

    const codeContents: string[] = [];
    codeBlocks.forEach(block => {
      // Preserve the original formatting including indentation
      const text = (block as HTMLElement).innerText || (block as HTMLElement).textContent || '';
      if (text.trim().length > 10) {
        // Don't trim individual lines to preserve indentation
        codeContents.push(text);
      }
    });

    if (codeContents.length === 0) return null;

    const codeContent = codeContents.join('\n\n');
    const problemContent = this.extractProblemDescription(document);
    const { headings, paragraphs } = problemContent;

    // Format the content with "Code Blocks" header
    const formattedContent = `=== Code Blocks ===\n${codeContent}`;

    return {
      mainText: formattedContent,
      headings,
      paragraphs,
      lists: [],
      metadata: this.generateContentMetadata(formattedContent, paragraphs, 'code-focused', codeContents.length)
    };
  }

  /**
   * Extracts code from contenteditable elements
   */
  private extractContentEditableCode(document: Document): CleanTextContent | null {
    const editableCode = document.querySelectorAll('[contenteditable="true"].code-editor, [contenteditable="true"].editor, .ace_editor');
    if (editableCode.length === 0) return null;

    const codeContents: string[] = [];
    editableCode.forEach(editor => {
      const text = (editor as HTMLElement).textContent || '';
      if (text.trim().length > 10) {
        codeContents.push(text.trim());
      }
    });

    if (codeContents.length === 0) return null;

    const codeContent = codeContents.join('\n\n');
    const problemContent = this.extractProblemDescription(document);
    const { headings, paragraphs } = problemContent;

    // Format the content with "Editor Content" header
    const formattedContent = `=== Editor Content ===\n${codeContent}`;

    return {
      mainText: formattedContent,
      headings,
      paragraphs,
      lists: [],
      metadata: this.generateContentMetadata(formattedContent, paragraphs, 'code-focused', codeContents.length)
    };
  }

  /**
   * Extracts problem description from coding challenge pages
   */
  private extractProblemDescription(document: Document): { headings: TextBlock[], paragraphs: TextBlock[] } {
    const headings: TextBlock[] = [];
    const paragraphs: TextBlock[] = [];

    // Common selectors for problem descriptions
    const problemSelectors = [
      '.question-content',
      '.problem-statement',
      '.challenge-description',
      '.description',
      '[data-cy="question-title"]',
      '.content__u3I1'
    ];

    for (const selector of problemSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        // Extract headings
        const headingElements = element.querySelectorAll('h1, h2, h3, h4');
        headingElements.forEach(heading => {
          const content = this.cleanText(heading.textContent || '');
          if (content) {
            const level = parseInt(heading.tagName.charAt(1));
            headings.push({ content, level, context: this.getElementContext(heading) });
          }
        });

        // Extract paragraphs
        const paragraphElements = element.querySelectorAll('p, .example');
        paragraphElements.forEach(para => {
          const content = this.cleanText(para.textContent || '');
          if (content && content.length > 20) {
            paragraphs.push({ content, context: this.getElementContext(para) });
          }
        });

        break;
      }
    }

    return { headings, paragraphs };
  }

  /**
   * Fallback extraction for when main algorithm fails
   */
  private fallbackExtraction(document: Document): CleanTextContent {
    try {
      const body = document.body;
      if (!body) return this.createEmptyContent();
      
      const textContent = body.textContent || '';
      const cleanText = this.removeNoiseElements(textContent);
      
      // Basic paragraph extraction
      const paragraphs: TextBlock[] = cleanText
        .split(/\n\s*\n/)
        .filter(p => p.trim().length > 20)
        .map(content => ({
          content: content.trim(),
          context: 'body'
        }));
      
      return {
        mainText: cleanText,
        headings: [],
        paragraphs,
        lists: [],
        metadata: this.generateContentMetadata(cleanText, paragraphs)
      };
    } catch (error) {
      console.error('Fallback extraction failed:', error);
      return this.createEmptyContent();
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const textExtractionEngine = new TextExtractionEngine();