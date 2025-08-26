// Detailed Task Creation Debug Script
// Run this in the browser console when the extension popup is open

console.log('=== Detailed Task Creation Debug ===');

// Step 1: Check if services are available
console.log('1. Checking service availability...');
const popup = document.querySelector('.popup-container');
console.log('Popup container found:', !!popup);

// Step 2: Try to access React component state (if possible)
console.log('2. Checking for task form...');
const taskForm = document.querySelector('.task-form');
console.log('Task form found:', !!taskForm);

const addTaskButton = document.querySelector('button[onclick*="add-task"], button:contains("Add Task")');
console.log('Add task button found:', !!addTaskButton);

// Step 3: Check Chrome storage directly
console.log('3. Checking Chrome storage...');
chrome.storage.local.get(['customTasks'], (result) => {
  console.log('Current custom tasks in storage:', result.customTasks);
});

// Step 4: Test basic storage write
console.log('4. Testing basic storage write...');
const testTask = {
  id: 'test-' + Date.now(),
  name: 'Debug Test Task',
  description: 'Test task created for debugging',
  promptTemplate: 'Test prompt for {{domain}}',
  websitePatterns: ['example.com'],
  outputFormat: 'plain_text',
  tags: ['debug'],
  isEnabled: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  usageCount: 0
};

chrome.storage.local.get(['customTasks'], (result) => {
  const customTasks = result.customTasks || {};
  customTasks[testTask.id] = testTask;
  
  chrome.storage.local.set({ customTasks }, () => {
    console.log('Test task saved directly to storage');
    
    // Verify it was saved
    chrome.storage.local.get(['customTasks'], (verifyResult) => {
      console.log('Verification - tasks in storage:', Object.keys(verifyResult.customTasks || {}));
    });
  });
});

// Step 5: Check for form validation issues
console.log('5. Checking form elements...');
const nameInput = document.querySelector('input[id="task-name"], input[placeholder*="name"]');
const descInput = document.querySelector('textarea[id="task-description"], textarea[placeholder*="description"]');
const promptInput = document.querySelector('textarea[id="task-prompt"], textarea[placeholder*="prompt"]');
const patternsInput = document.querySelector('input[id="task-patterns"], input[placeholder*="pattern"]');

console.log('Form inputs found:', {
  name: !!nameInput,
  description: !!descInput,
  prompt: !!promptInput,
  patterns: !!patternsInput
});

if (nameInput) console.log('Name input value:', nameInput.value);
if (descInput) console.log('Description input value:', descInput.value);
if (promptInput) console.log('Prompt input value:', promptInput.value);
if (patternsInput) console.log('Patterns input value:', patternsInput.value);

// Step 6: Check for error messages
console.log('6. Checking for error messages...');
const errorMessages = document.querySelectorAll('.error-message, .error-text, [class*="error"]');
console.log('Error messages found:', errorMessages.length);
errorMessages.forEach((error, index) => {
  console.log(`Error ${index + 1}:`, error.textContent);
});

// Step 7: Try to trigger form submission programmatically
console.log('7. Looking for submit button...');
const submitButton = document.querySelector('button[type="submit"], button:contains("Create Task"), button:contains("Save")');
console.log('Submit button found:', !!submitButton);

if (submitButton) {
  console.log('Submit button text:', submitButton.textContent);
  console.log('Submit button disabled:', submitButton.disabled);
}

console.log('=== Debug complete ===');
console.log('Next steps:');
console.log('1. Try filling out the form manually');
console.log('2. Check browser console for errors when submitting');
console.log('3. Verify the task manager is initialized');
console.log('4. Check if validation is preventing submission');