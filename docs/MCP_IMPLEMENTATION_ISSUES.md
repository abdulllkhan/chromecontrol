# MCP Implementation Issues & Fixes Required

## Overview
This document outlines the 7 critical issues found in the Model Context Protocol (MCP) implementation from Task 25. These issues must be resolved for the MCP system to function correctly.

---

## ❌ Critical Errors (High Priority)

### 1. Import Path Error
**File:** `src/services/mcpService.ts:16`
**Issue:** Using `.js` extension in TypeScript imports
```typescript
// BROKEN:
import { ... } from '../types/index.js';

// FIX:
import { ... } from '../types/index';
```

### 2. Export/Import Mismatch
**File:** `src/background/background.ts:2`
**Issue:** Importing non-existent instance instead of class
```typescript
// BROKEN:
import { mcpService } from '../services/mcpService.js';

// FIX:
import { MCPService } from '../services/mcpService';
const mcpService = MCPService.getInstance();
```

---

## ⚠️ Medium Priority Issues

### 3. Missing Async Handler Implementation
**Files:** `src/services/mcpService.ts:185-188, 216-219, 246-249`
**Issue:** All MCP tool handlers return fake responses instead of real implementations
```typescript
// CURRENT (fake):
handler: async (args: unknown) => {
  return { success: true, extracted: true, args };
}

// NEEDS: Real implementation connecting to content scripts and services
```

### 4. Validation Logic Inefficiency
**File:** `src/types/index.ts:854-856`
**Issue:** Using `indexOf` instead of `includes`
```typescript
// CURRENT:
if (validTypes.indexOf(s.type as string) === -1) {

// FIX:
if (!validTypes.includes(s.type as string)) {
```

### 5. Memory Leak Risk
**File:** `src/services/mcpService.ts`
**Issue:** No cleanup mechanism for MCP contexts and server configs
- `serverConfigs` array grows indefinitely
- No cache management for MCP contexts
- Missing resource cleanup methods

**Needs:**
- Add `cleanup()` method to MCPService
- Implement context expiration
- Add max cache size limits

### 6. Security Gap in Data Sanitization
**File:** `src/services/mcpService.ts:131-139`
**Issue:** Incomplete sanitization of user preferences
```typescript
// CURRENT: Only excludes some fields
const sanitizedPreferences = {
  enabledCategories: userPreferences.enabledCategories,
  // ... partial exclusion
};

// NEEDS: Comprehensive sanitization to prevent API key leaks
```

---

## 🔍 Low Priority Issues

### 7. Type Safety Issues
**Files:** Multiple files in MCP implementation
**Issues:**
- Excessive use of `unknown` types in handlers reduces type safety
- Missing null checks for optional parameters
- Inconsistent error handling patterns across MCP methods

**Needs:**
- Define specific types for tool handler arguments
- Add proper null/undefined checks
- Standardize error handling approach

---

## Implementation Priority

### Phase 1 (Critical - Fix Immediately)
1. Fix import path errors (#1, #2)
2. Test MCP service can be instantiated without errors

### Phase 2 (Core Functionality)
3. Implement real tool handlers (#3)
4. Add proper data sanitization (#6)
5. Fix validation inefficiency (#4)

### Phase 3 (Stability & Performance)
6. Add memory management (#5)
7. Improve type safety (#7)

---

## Testing Requirements

After fixes:
- [ ] MCP service instantiates without import errors
- [ ] `buildMCPContext()` returns valid MCP context
- [ ] Tool handlers execute real operations
- [ ] No sensitive data leaks in sanitized preferences
- [ ] Memory usage remains stable over time
- [ ] All validation functions work correctly

---

## Files to Modify

1. `src/services/mcpService.ts` - Core service implementation
2. `src/background/background.ts` - Service import and usage
3. `src/types/index.ts` - Validation logic
4. Content scripts - Tool handler implementations
5. Task manager - MCP integration

---

*Generated from Task 25/26 code review - MCP Implementation Analysis*