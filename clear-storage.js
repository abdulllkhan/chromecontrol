// Clear Extension Storage Script
// Run this in the browser console when the extension popup is open
// This will clear any old encrypted data that might be causing issues

console.log('=== Clearing Extension Storage ===');

// Clear all local storage
chrome.storage.local.clear(() => {
  console.log('✅ Local storage cleared');
});

// Clear sync storage (if used)
chrome.storage.sync.clear(() => {
  console.log('✅ Sync storage cleared');
});

// Verify storage is empty
setTimeout(() => {
  chrome.storage.local.get(null, (result) => {
    console.log('Local storage contents after clear:', result);
  });
  
  chrome.storage.sync.get(null, (result) => {
    console.log('Sync storage contents after clear:', result);
  });
}, 1000);

console.log('=== Storage clearing complete ===');
console.log('Please reload the extension and try again.');