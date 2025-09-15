# Custom Task Creation Troubleshooting Guide

## Issues Fixed in Latest Version

### ✅ Fixed Issues:
1. **Duplicate imports causing build errors** - Removed duplicate `title` imports
2. **Domain undefined error** - Added fallback handling for URL parsing
3. **Storage encryption warnings** - Added proper handling for legacy encrypted data
4. **Task Manager integration** - Fixed to use proper TaskManager service instead of direct storage

## Issue: Unable to Add Custom Tasks

If you're having trouble adding custom tasks to the Chrome extension, follow these troubleshooting steps:

## Step 1: Check Browser Console

1. Open the extension popup
2. Right-click anywhere in the popup and select "Inspect"
3. Go to the "Console" tab
4. Try to create a task and watch for error messages

## Step 2: Verify Required Fields

Make sure you fill out all required fields with sufficient content:

- **Task Name**: At least 3 characters
- **Description**: At least 10 characters  
- **Prompt Template**: At least 10 characters
- **Website Patterns**: At least one valid pattern

## Step 3: Website Pattern Format

Website patterns can be:
- Simple domains: `example.com`, `github.com`
- Wildcards: `*.google.com` (will be converted to regex)
- Regex patterns: `.*\.reddit\.com`

**Common mistakes:**
- Empty patterns
- Invalid regex syntax
- Missing domain extensions

## Step 4: Check Extension Permissions

1. Go to `chrome://extensions/`
2. Find "Agentic Chrome Extension"
3. Make sure it's enabled
4. Check that it has storage permissions

## Step 5: Clear Extension Storage (if needed)

If you see "Found encrypted data but encryption is disabled" warnings:
1. Open the extension popup
2. Right-click and select "Inspect"
3. Go to Console tab
4. Copy and paste the contents of `clear-storage.js` (provided in project)
5. Press Enter to run the script
6. Reload the extension

Alternative method:
1. Go to `chrome://extensions/`
2. Click "Details" on the extension
3. Click "Extension options" or open the popup
4. In browser console, run: `chrome.storage.local.clear()`
5. Reload the extension

## Step 6: Test with Minimal Data

Try creating a task with this minimal data:
- **Name**: "Test Task"
- **Description**: "This is a test task for debugging purposes"
- **Prompt**: "Please help me with {{domain}}"
- **Website Pattern**: "example.com"

## Step 7: Check Debug Logs

The latest version includes detailed console logging. Look for:
- "Starting task save process..."
- "Creating new task with data:"
- "Task created successfully with ID:"

## Common Error Messages and Solutions

### "Task manager not initialized"
- Reload the extension
- Check if the popup loaded completely
- Try closing and reopening the popup

### "Storage service not initialized"  
- Extension permissions issue
- Try reloading the extension
- Check browser storage quota

### "Task name is required"
- Make sure the name field is not empty
- Name must be at least 3 characters

### "Invalid regex pattern"
- Use simple domain names instead of complex regex
- Escape special characters if using regex
- Example: use `github.com` instead of `*.github.com`

### "Validation failed"
- Check all required fields are filled
- Ensure minimum character requirements are met
- Verify website patterns are valid

## Advanced Debugging

Run this in the browser console when the popup is open:

```javascript
// Check extension state
console.log('Task Manager:', window.taskManager);
console.log('Storage Service:', window.storageService);

// Check storage contents
chrome.storage.local.get(null, (result) => {
  console.log('Storage contents:', result);
});

// Test task creation directly
async function testTaskCreation() {
  const testTask = {
    name: 'Debug Test Task',
    description: 'A test task for debugging purposes',
    promptTemplate: 'Help me with {{domain}}',
    websitePatterns: ['example.com'],
    outputFormat: 'plain_text',
    tags: ['debug'],
    isEnabled: true
  };
  
  try {
    console.log('Testing task creation...');
    // This will depend on how the task manager is exposed
    // Check the console for the actual method to call
  } catch (error) {
    console.error('Test failed:', error);
  }
}
```

## If Nothing Works

1. **Reload the extension**: Go to `chrome://extensions/` and click the reload button
2. **Restart the browser**: Close and reopen Chrome
3. **Check extension version**: Make sure you have the latest build
4. **Try incognito mode**: Test if it works in a private browsing window

## Getting Help

If you're still having issues:
1. Copy any error messages from the browser console
2. Note which step in the process fails
3. Include your browser version and operating system
4. Describe exactly what happens when you try to create a task

The extension now includes much more detailed logging to help identify exactly where the process is failing.