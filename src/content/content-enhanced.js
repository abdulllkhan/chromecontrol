// Enhanced content script with advanced text extraction
(function() {
  'use strict';

  console.log('chromeControl enhanced content script loaded on:', window.location.href);

  // Enhanced page content extraction with code editor support
  function extractPageContent() {
    // Extract code from various editors
    function extractCodeContent() {
      const codeContents = [];

      // Monaco Editor (LeetCode, VS Code online)
      // Method 1: Try view-lines (visible rendered code)
      const monacoViewLines = document.querySelectorAll('.monaco-editor .view-lines .view-line, .view-lines .view-line');
      if (monacoViewLines.length > 0) {
        const lines = [];
        monacoViewLines.forEach(line => {
          // Get all text including spans
          const spans = line.querySelectorAll('span');
          if (spans.length > 0) {
            let lineText = '';
            spans.forEach(span => {
              lineText += span.textContent || '';
            });
            lines.push(lineText);
          } else {
            const text = line.innerText || line.textContent || '';
            if (text) lines.push(text);
          }
        });
        if (lines.length > 0) {
          codeContents.push({
            type: 'monaco-editor-viewlines',
            content: lines.join('\n')
          });
        }
      }

      // Method 2: Try to get from Monaco model directly
      const monacoEditors = document.querySelectorAll('.monaco-editor');
      monacoEditors.forEach(editor => {
        // Look for data attributes that might contain code
        const dataContent = editor.getAttribute('data-content') ||
                           editor.getAttribute('data-value') ||
                           editor.getAttribute('data-code');
        if (dataContent) {
          codeContents.push({
            type: 'monaco-editor-data',
            content: dataContent
          });
        }
      });

      // Monaco textareas (for incomplete code)
      const monacoTextareas = document.querySelectorAll('.monaco-editor textarea');
      monacoTextareas.forEach(textarea => {
        const value = textarea.value;
        if (value && value.trim()) {
          codeContents.push({
            type: 'monaco-textarea',
            content: value
          });
        }
      });

      // CodeMirror
      const codeMirrorLines = document.querySelectorAll('.CodeMirror-line');
      if (codeMirrorLines.length > 0) {
        const lines = [];
        codeMirrorLines.forEach(line => {
          const text = line.innerText || line.textContent || '';
          if (text.trim()) lines.push(text);
        });
        if (lines.length > 0) {
          codeContents.push({
            type: 'codemirror',
            content: lines.join('\n')
          });
        }
      }

      // Ace Editor
      const aceLines = document.querySelectorAll('.ace_line');
      if (aceLines.length > 0) {
        const lines = [];
        aceLines.forEach(line => {
          const text = line.innerText || line.textContent || '';
          if (text.trim()) lines.push(text);
        });
        if (lines.length > 0) {
          codeContents.push({
            type: 'ace-editor',
            content: lines.join('\n')
          });
        }
      }

      // Contenteditable code areas
      const contentEditables = document.querySelectorAll('[contenteditable="true"].code-editor, [contenteditable="true"].editor');
      contentEditables.forEach(elem => {
        const text = elem.innerText || elem.textContent || '';
        if (text.trim() && text.length > 10) {
          codeContents.push({
            type: 'contenteditable',
            content: text
          });
        }
      });

      // Generic textareas with substantial content
      const textareas = document.querySelectorAll('textarea');
      textareas.forEach(textarea => {
        // Skip if already captured as Monaco
        if (textarea.closest('.monaco-editor')) return;

        const value = textarea.value;
        if (value && value.trim() && value.length > 50) {
          codeContents.push({
            type: 'textarea',
            content: value
          });
        }
      });

      // Pre/code blocks
      const codeBlocks = document.querySelectorAll('pre code, pre.code, .hljs, .highlight, .code-block, pre');
      codeBlocks.forEach(block => {
        const text = block.innerText || block.textContent || '';
        if (text.trim() && text.length > 10) {
          codeContents.push({
            type: 'code-block',
            content: text
          });
        }
      });

      // LeetCode specific: Check for editor wrapper
      const leetcodeEditor = document.querySelector('[data-cy="code-editor"], .editor-wrapper, #editor');
      if (leetcodeEditor) {
        // Try to get all text content from the editor area
        const allText = leetcodeEditor.innerText || leetcodeEditor.textContent || '';
        if (allText.trim() && allText.length > 10) {
          codeContents.push({
            type: 'leetcode-editor',
            content: allText
          });
        }
      }

      // Look for any element that might contain code (last resort)
      if (codeContents.length === 0) {
        // Check for elements with code-related classes
        const codeElements = document.querySelectorAll('[class*="editor"], [class*="code"], [class*="monaco"]');
        codeElements.forEach(elem => {
          const text = elem.innerText || elem.textContent || '';
          // Check if it looks like code (has brackets, semicolons, etc.)
          if (text.length > 20 && (text.includes('{') || text.includes(';') || text.includes('function') || text.includes('def') || text.includes('class'))) {
            codeContents.push({
              type: 'potential-code',
              content: text
            });
          }
        });
      }

      return codeContents;
    }

    // Extract main text content
    function extractMainContent() {
      // Try to find main content areas
      const contentSelectors = [
        'main',
        'article',
        '[role="main"]',
        '.content',
        '.main-content',
        '#content',
        '#main',
        '.question-content',
        '.problem-statement'
      ];

      for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          return element.textContent?.trim() || '';
        }
      }

      // Fallback to body content
      return document.body?.textContent?.trim() || '';
    }

    // Extract all code content
    const codeContent = extractCodeContent();

    // Build combined text content
    let textContent = '';

    // Add code content first if found
    if (codeContent.length > 0) {
      textContent += '=== Extracted Code ===\n';
      codeContent.forEach(code => {
        textContent += `[${code.type}]\n${code.content}\n\n`;
      });
    }

    // Add main content
    const mainContent = extractMainContent();
    if (mainContent) {
      if (textContent) textContent += '\n=== Page Content ===\n';
      textContent += mainContent.substring(0, 5000); // Limit to 5000 chars
    }

    return {
      url: window.location.href,
      title: document.title,
      headings: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => h.textContent?.trim()).filter(Boolean),
      textContent: textContent || document.body?.textContent?.substring(0, 5000) || '',
      forms: Array.from(document.querySelectorAll('input, textarea, select')).slice(0, 20).map(input => ({
        type: input.type || input.tagName.toLowerCase(),
        name: input.name,
        id: input.id,
        placeholder: input.placeholder
      })),
      links: Array.from(document.querySelectorAll('a[href]')).slice(0, 50).map(link => ({
        href: link.href,
        text: link.textContent?.trim()
      })),
      metadata: {
        codeBlocksFound: codeContent.length,
        hasMonacoEditor: document.querySelector('.monaco-editor') !== null,
        hasCodeMirror: document.querySelector('.CodeMirror') !== null,
        isLeetCode: window.location.hostname.includes('leetcode.com')
      },
      extractedAt: new Date(),
      domain: window.location.hostname,
      timestamp: new Date().toISOString()
    };
  }

  // Send page content to background script
  function sendPageContent() {
    try {
      // Check if extension context is still valid
      if (!chrome?.runtime?.id) {
        console.log('Extension context invalidated, skipping extraction');
        return;
      }

      const content = extractPageContent();

      console.log('Extracted content:', {
        url: content.url,
        textLength: content.textContent.length,
        codeBlocks: content.metadata.codeBlocksFound,
        hasMonaco: content.metadata.hasMonacoEditor,
        firstChars: content.textContent.substring(0, 100)
      });

      // Send to background script
      if (chrome?.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'PAGE_CONTENT_EXTRACTED',
          content: content
        }).catch(error => {
          if (error.message?.includes('Extension context invalidated')) {
            console.log('Extension was reloaded, please refresh the page');
          } else {
            console.log('Failed to send page content:', error);
          }
        });
      }
    } catch (error) {
      if (error.message?.includes('Extension context invalidated')) {
        console.log('Extension was reloaded, please refresh the page');
      } else {
        console.error('Error in sendPageContent:', error);
      }
    }
  }

  // Initialize when page is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sendPageContent);
  } else {
    // Wait a bit for dynamic content to load
    setTimeout(sendPageContent, 500);
  }

  // Listen for messages from popup/background
  if (chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'PING') {
        sendResponse({ success: true, status: 'ready' });
      } else if (message.type === 'EXTRACT_CONTENT') {
        const content = extractPageContent();
        console.log('Manual extraction requested, found:', {
          textLength: content.textContent.length,
          codeBlocks: content.metadata.codeBlocksFound
        });
        sendResponse({ success: true, content });
      }
      return true;
    });
  }

  // Re-extract content when DOM changes (useful for SPAs)
  let extractionTimeout;
  try {
    const observer = new MutationObserver(() => {
      // Check if extension context is still valid before processing
      if (!chrome?.runtime?.id) {
        observer.disconnect();
        return;
      }

      clearTimeout(extractionTimeout);
      extractionTimeout = setTimeout(() => {
        sendPageContent();
      }, 1000);
    });

    // Observe changes to the body
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
  } catch (error) {
    console.log('Could not set up mutation observer:', error);
  }

})();