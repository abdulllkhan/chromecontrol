/**
 * Test setup file for Vitest
 */

import { vi } from 'vitest';

// Mock Chrome APIs globally
const mockChromeStorage = {
  local: {
    get: vi.fn().mockResolvedValue({}),
    set: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    getBytesInUse: vi.fn().mockResolvedValue(0)
  },
  sync: {
    get: vi.fn().mockResolvedValue({}),
    set: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    getBytesInUse: vi.fn().mockResolvedValue(0)
  }
};

const mockChromeRuntime = {
  sendMessage: vi.fn(),
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn()
  },
  getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
  id: 'test-extension-id'
};

const mockChromeTabs = {
  query: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue({}),
  sendMessage: vi.fn()
};

const mockChromeScripting = {
  executeScript: vi.fn().mockResolvedValue([]),
  insertCSS: vi.fn().mockResolvedValue(undefined)
};

// Mock crypto API
const mockCrypto = {
  randomUUID: vi.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9)),
  subtle: {
    generateKey: vi.fn().mockResolvedValue({ type: 'secret' }),
    exportKey: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    importKey: vi.fn().mockResolvedValue({ type: 'secret' }),
    encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
    decrypt: vi.fn().mockImplementation((algorithm, key, data) => {
      // Simple mock that returns the original data
      return Promise.resolve(new TextEncoder().encode('decrypted-data'));
    })
  },
  getRandomValues: vi.fn((array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  })
};

// Set up global mocks
global.chrome = {
  storage: mockChromeStorage,
  runtime: mockChromeRuntime,
  tabs: mockChromeTabs,
  scripting: mockChromeScripting
} as any;

// Mock crypto more carefully
Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true,
  configurable: true
});

// Mock TextEncoder/TextDecoder if not available
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = class TextEncoder {
    encode(input: string): Uint8Array {
      const bytes = new Uint8Array(input.length);
      for (let i = 0; i < input.length; i++) {
        bytes[i] = input.charCodeAt(i);
      }
      return bytes;
    }
  };
}

if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = class TextDecoder {
    decode(input: Uint8Array): string {
      let result = '';
      for (let i = 0; i < input.length; i++) {
        result += String.fromCharCode(input[i]);
      }
      return result;
    }
  };
}

// Mock btoa/atob for base64 encoding
if (typeof global.btoa === 'undefined') {
  global.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
}

if (typeof global.atob === 'undefined') {
  global.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');
}

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});