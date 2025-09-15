// Debug script for task creation issues
// Run this in the browser console when the extension popup is open

console.log('=== Task Creation Debug Script ===');

// Check if task manager is available
if (window.taskManager) {
  console.log('✅ Task manager is available');
} else {
  console.log('❌ Task manager is not available');
}

// Check if storage service is available
if (window.storageService) {
  console.log('✅ Storage service is available');
} else {
  console.log('❌ Storage service is not available');
}

// Test basic task creation
async function testTaskCreation() {
  try {
    console.log('Testing task creation...');
    
    const testTask = {
      name: 'Debug Test Task',
      description: 'A test task for debugging',
      promptTemplate: 'Test prompt for {{domain}}',
      websitePatterns: ['example.com'],
      outputFormat: 'plain_text',
      tags: ['debug', 'test'],
      isEnabled: true
    };
    
    console.log('Test task data:', testTask);
    
    // Check if we can access the task manager from the popup
    const popup = document.querySelector('.popup-container');
    if (popup) {
      console.log('✅ Popup container found');
    } else {
      console.log('❌ Popup container not found');
    }
    
    // Try to find form elements
    const taskForm = document.querySelector('.task-form');
    if (taskForm) {
      console.log('✅ Task form found');
    } else {
      console.log('❌ Task form not found');
    }
    
    // Check for error messages
    const errorMessages = document.querySelectorAll('.error-message, .error-text');
    if (errorMessages.length > 0) {
      console.log('⚠️ Error messages found:', Array.from(errorMessages).map(el => el.textContent));
    } else {
      console.log('✅ No error messages visible');
    }
    
  } catch (error) {
    console.error('❌ Task creation test failed:', error);
  }
}

// Run the test
testTaskCreation();

// Check Chrome storage
chrome.storage.local.get(null, (result) => {
  console.log('Chrome storage contents:', result);
});

console.log('=== Debug script complete ===');