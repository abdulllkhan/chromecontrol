/**
 * Tests for Code Extraction functionality in TextExtractionEngine
 * 
 * Verifies that the engine can properly extract code from various code editors
 * and programming platforms like LeetCode, CodePen, etc.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TextExtractionEngine } from '../textExtractionEngine.js';

describe('Code Extraction Engine', () => {
  let textExtractionEngine: TextExtractionEngine;
  let mockDocument: Document;

  beforeEach(() => {
    textExtractionEngine = new TextExtractionEngine();
    
    // Create a mock document
    mockDocument = new DOMParser().parseFromString(`
      <!DOCTYPE html>
      <html>
        <head><title>LeetCode Problem</title></head>
        <body></body>
      </html>
    `, 'text/html');
  });

  describe('Monaco Editor Extraction (LeetCode)', () => {
    it('should extract code from Monaco Editor view-lines', () => {
      // Simulate LeetCode's Monaco Editor structure
      mockDocument.body.innerHTML = `
        <div class="monaco-editor">
          <div class="view-lines">
            <div class="view-line">function twoSum(nums, target) {</div>
            <div class="view-line">    for (let i = 0; i < nums.length; i++) {</div>
            <div class="view-line">        for (let j = i + 1; j < nums.length; j++) {</div>
            <div class="view-line">            if (nums[i] + nums[j] === target) {</div>
            <div class="view-line">                return [i, j];</div>
            <div class="view-line">            }</div>
            <div class="view-line">        }</div>
            <div class="view-line">    }</div>
            <div class="view-line">}</div>
          </div>
        </div>
      `;

      const result = textExtractionEngine.extractCleanContent(mockDocument);

      expect(result.mainText).toContain('function twoSum(nums, target)');
      expect(result.mainText).toContain('for (let i = 0; i < nums.length; i++)');
      expect(result.mainText).toContain('return [i, j];');
      // The new implementation includes editor content in mainText
      expect(result.mainText).toContain('Editor Content');
    });

    it('should extract code from Monaco Editor textarea', () => {
      mockDocument.body.innerHTML = `
        <div class="monaco-editor">
          <textarea class="inputarea">
def two_sum(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []
          </textarea>
        </div>
      `;

      const result = textExtractionEngine.extractCleanContent(mockDocument);

      expect(result.mainText).toContain('def two_sum(nums, target):');
      expect(result.mainText).toContain('for i in range(len(nums)):');
      expect(result.mainText).toContain('return [i, j]');
      // The new implementation should extract this content
      expect(result.mainText.length).toBeGreaterThan(0);
    });
  });

  describe('CodeMirror Extraction', () => {
    it('should extract code from CodeMirror editor', () => {
      mockDocument.body.innerHTML = `
        <div class="CodeMirror">
          <div class="CodeMirror-code">
            <pre class="CodeMirror-line">class Solution:</pre>
            <pre class="CodeMirror-line">    def lengthOfLongestSubstring(self, s: str) -> int:</pre>
            <pre class="CodeMirror-line">        char_map = {}</pre>
            <pre class="CodeMirror-line">        left = 0</pre>
            <pre class="CodeMirror-line">        max_length = 0</pre>
          </div>
        </div>
      `;

      const result = textExtractionEngine.extractCleanContent(mockDocument);

      expect(result.mainText).toContain('class Solution:');
      expect(result.mainText).toContain('def lengthOfLongestSubstring');
      expect(result.mainText).toContain('char_map = {}');
      // The new implementation includes editor content
      expect(result.mainText).toContain('Editor Content');
    });
  });

  describe('Generic Code Block Extraction', () => {
    it('should extract code from pre/code elements', () => {
      mockDocument.body.innerHTML = `
        <div class="problem-statement">
          <h2>Two Sum Problem</h2>
          <p>Given an array of integers nums and an integer target...</p>
        </div>
        <pre><code>
function twoSum(nums, target) {
    const map = new Map();
    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];
        if (map.has(complement)) {
            return [map.get(complement), i];
        }
        map.set(nums[i], i);
    }
    return [];
}
        </code></pre>
      `;

      const result = textExtractionEngine.extractCleanContent(mockDocument);

      expect(result.mainText).toContain('function twoSum(nums, target)');
      expect(result.mainText).toContain('const map = new Map()');
      expect(result.mainText).toContain('map.set(nums[i], i)');
      expect(result.paragraphs.some(p => 
        p.content.includes('Given an array of integers')
      )).toBe(true);
    });
  });

  describe('Contenteditable Code Areas', () => {
    it('should extract code from contenteditable divs', () => {
      mockDocument.body.innerHTML = `
        <div class="editor-container">
          <div contenteditable="true" class="code-editor">
public class ListNode {
    int val;
    ListNode next;
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}
          </div>
        </div>
      `;

      const result = textExtractionEngine.extractCleanContent(mockDocument);

      expect(result.mainText).toContain('public class ListNode');
      expect(result.mainText).toContain('int val;');
      expect(result.mainText).toContain('ListNode next;');
      // The new implementation includes editor content
      expect(result.mainText).toContain('Editor Content');
    });
  });

  describe('Problem Statement Extraction', () => {
    it('should extract both code and problem description', () => {
      mockDocument.body.innerHTML = `
        <div class="question-content">
          <h3>1. Two Sum</h3>
          <div class="problem-statement">
            <p>Given an array of integers <code>nums</code> and an integer <code>target</code>, 
            return indices of the two numbers such that they add up to <code>target</code>.</p>
            <p><strong>Example 1:</strong></p>
            <pre>
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].
            </pre>
          </div>
        </div>
        <div class="monaco-editor">
          <div class="view-lines">
            <div class="view-line">var twoSum = function(nums, target) {</div>
            <div class="view-line">    // Your code here</div>
            <div class="view-line">};</div>
          </div>
        </div>
      `;

      const result = textExtractionEngine.extractCleanContent(mockDocument);

      // Should extract both the code and problem description
      expect(result.mainText).toContain('var twoSum = function(nums, target)');
      expect(result.paragraphs.some(p => 
        p.content.includes('Given an array of integers')
      )).toBe(true);
      expect(result.headings.some(h => h.content.includes('Two Sum'))).toBe(true);
    });
  });

  describe('Code Formatting Preservation', () => {
    it('should preserve indentation and line breaks in code', () => {
      mockDocument.body.innerHTML = `
        <pre><code>
def binary_search(arr, target):
    left = 0
    right = len(arr) - 1
    
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    
    return -1
        </code></pre>
      `;

      const result = textExtractionEngine.extractCleanContent(mockDocument);

      // Should preserve the structure and indentation
      expect(result.mainText).toContain('def binary_search(arr, target):');
      expect(result.mainText).toContain('    left = 0');
      expect(result.mainText).toContain('    while left <= right:');
      expect(result.mainText).toContain('        mid = (left + right) // 2');
      
      // Should preserve line breaks
      const lines = result.mainText.split('\n');
      expect(lines.length).toBeGreaterThan(10);
    });
  });

  describe('Multiple Code Blocks', () => {
    it('should handle multiple code blocks and prioritize editor content', () => {
      mockDocument.body.innerHTML = `
        <div class="problem-statement">
          <pre><code>// Example solution
function example() {
    return "example";
}
          </code></pre>
        </div>
        <div class="monaco-editor">
          <div class="view-lines">
            <div class="view-line">function actualSolution() {</div>
            <div class="view-line">    return "actual solution";</div>
            <div class="view-line">}</div>
          </div>
        </div>
      `;

      const result = textExtractionEngine.extractCleanContent(mockDocument);

      // Both code blocks should be extracted
      expect(result.mainText).toContain('actualSolution');
      expect(result.mainText).toContain('example');
      // The editor content should be present
      expect(result.mainText).toContain('Editor Content');
    });
  });

  describe('Incomplete Code Extraction', () => {
    it('should extract incomplete code from Monaco Editor', () => {
      // Simulate incomplete code in LeetCode editor
      mockDocument.body.innerHTML = `
        <div class="monaco-editor">
          <div class="view-lines">
            <div class="view-line">function twoSum(nums, target) {</div>
            <div class="view-line">    // Incomplete implementation</div>
            <div class="view-line">    for (let i = 0; i < nums.</div>
          </div>
          <textarea class="inputarea">function twoSum(nums, target) {
    // Incomplete implementation
    for (let i = 0; i < nums.</textarea>
        </div>
      `;

      const result = textExtractionEngine.extractCleanContent(mockDocument);

      // Should extract the incomplete code
      expect(result.mainText).toContain('function twoSum(nums, target)');
      expect(result.mainText).toContain('// Incomplete implementation');
      expect(result.mainText).toContain('for (let i = 0; i < nums.');
    });

    it('should extract partial code from textarea even if view-lines are empty', () => {
      mockDocument.body.innerHTML = `
        <div class="monaco-editor">
          <div class="view-lines"></div>
          <textarea class="monaco-mouse-cursor-text">class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        # User is still typing here...</textarea>
        </div>
      `;

      const result = textExtractionEngine.extractCleanContent(mockDocument);

      expect(result.mainText).toContain('class Solution:');
      expect(result.mainText).toContain('def twoSum');
      expect(result.mainText).toContain('# User is still typing here...');
    });

    it('should extract code from contenteditable with partial content', () => {
      mockDocument.body.innerHTML = `
        <div contenteditable="true" class="code-editor">
function processData(data) {
    if (!data) return null;
    // TODO: implement processing logic
    const result = data.
}
        </div>
      `;

      const result = textExtractionEngine.extractCleanContent(mockDocument);

      expect(result.mainText).toContain('function processData(data)');
      expect(result.mainText).toContain('TODO: implement processing logic');
      expect(result.mainText).toContain('const result = data.');
    });
  });

  describe('Fallback Behavior', () => {
    it('should fallback to regular extraction when no code is found', () => {
      mockDocument.body.innerHTML = `
        <article>
          <h1>Regular Article</h1>
          <p>This is just a regular article with no code content.</p>
          <p>It should be extracted using the normal algorithm.</p>
        </article>
      `;

      const result = textExtractionEngine.extractCleanContent(mockDocument);

      expect(result.mainText).toContain('regular article');
      // Extraction type is optional in the new implementation
      expect(result.metadata.codeBlocks).toBeUndefined();
    });

    it('should require minimum code length to trigger code extraction', () => {
      mockDocument.body.innerHTML = `
        <div class="monaco-editor">
          <div class="view-lines">
            <div class="view-line">x</div>
          </div>
        </div>
        <article>
          <h1>Main Article Content</h1>
          <p>This article has much more content than the tiny code snippet.</p>
          <p>The extraction should prefer this content over the minimal code.</p>
        </article>
      `;

      const result = textExtractionEngine.extractCleanContent(mockDocument);

      // Should fallback to article content since code is too short
      expect(result.mainText).toContain('Main Article Content');
      // Very short code should not be extracted as main content
      expect(result.mainText).not.toContain('=== Editor Content ===');
    });
  });
});