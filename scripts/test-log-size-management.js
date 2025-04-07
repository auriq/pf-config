#!/usr/bin/env node

/**
 * Test Log Size Management
 * 
 * This script tests the log file size management functionality by generating
 * a large amount of log data to trigger the size management feature.
 */

const terminal = require('../src/modules/terminal-output');
const fs = require('fs-extra');
const path = require('path');

// Configure terminal
terminal.configure({
  useColors: true,
  showTimestamp: true,
  logToFile: true
});

// Path to the log file
const LOG_FILE_PATH = path.join(process.cwd(), 'logs', 'terminal.log');

// Reset log file to start clean
terminal.resetLogFile();
console.log(`Log file reset at: ${LOG_FILE_PATH}`);

// Function to check log file size
function checkLogSize() {
  if (fs.existsSync(LOG_FILE_PATH)) {
    const stats = fs.statSync(LOG_FILE_PATH);
    const fileSizeKB = (stats.size / 1024).toFixed(2);
    console.log(`Current log file size: ${fileSizeKB} KB`);
    return stats.size;
  }
  return 0;
}

// Function to directly write to the log file (bypass terminal module for testing)
function writeDirectlyToLogFile(sizeInKB) {
  // Ensure logs directory exists
  fs.ensureDirSync(path.join(process.cwd(), 'logs'));
  
  // Generate data
  const data = generateData(sizeInKB);
  
  // Write directly to log file
  fs.appendFileSync(LOG_FILE_PATH, data);
  console.log(`Directly wrote ${sizeInKB}KB to log file`);
}

// Generate a string of specified size
function generateData(sizeInKB) {
  const baseString = 'This is a test log entry to verify log file size management functionality. ';
  const repeatCount = Math.ceil((sizeInKB * 1024) / baseString.length);
  return baseString.repeat(repeatCount);
}

// Main test function
async function runTest() {
  console.log('Starting log size management test...');
  
  // Initial size
  const initialSize = checkLogSize();
  console.log(`Initial log file size: ${(initialSize / 1024).toFixed(2)} KB`);
  
  // Generate log entries to reach ~1.2MB (to trigger size management)
  console.log('Generating log entries to exceed 1MB...');
  
  // Log header
  terminal.header('Log Size Management Test');
  
  // Generate data in chunks to avoid memory issues
  const CHUNK_SIZE_KB = 50; // 50KB chunks for terminal logging
  const DIRECT_WRITE_SIZE_KB = 150; // 150KB for direct writes
  const TARGET_SIZE_KB = 250; // Target 250KB to ensure we trigger the size management (set to 200KB)
  
  let currentSize = initialSize;
  let iteration = 0;
  
  // Force log file to be large enough to trigger size management
  console.log('Creating large log entries to trigger size management...');
  
  // First, write some data through the terminal module
  for (let i = 0; i < 2; i++) {
    iteration++;
    console.log(`Iteration ${iteration}: Generating ${CHUNK_SIZE_KB}KB of log data via terminal...`);
    
    // Generate and log a chunk of data
    const data = generateData(CHUNK_SIZE_KB);
    terminal.log(`Test data chunk ${iteration}: ${data.substring(0, 50)}... (${CHUNK_SIZE_KB}KB)`);
    
    // Check current size
    currentSize = checkLogSize();
  }
  
  // Now write directly to the log file to ensure we exceed the threshold
  console.log('Writing directly to log file to exceed size threshold...');
  writeDirectlyToLogFile(DIRECT_WRITE_SIZE_KB);
  
  // Check size after direct write
  currentSize = checkLogSize();
  
  // Write again to ensure we trigger the size management
  console.log('Writing more data to trigger size management...');
  writeDirectlyToLogFile(DIRECT_WRITE_SIZE_KB);
  
  // Check size again
  currentSize = checkLogSize();
  
  // Small delay to allow file system operations to complete
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Final size check
  const finalSize = checkLogSize();
  console.log(`Final log file size after trimming: ${(finalSize / 1024).toFixed(2)} KB`);
  
  // Check if trimming occurred
  if (finalSize < currentSize) {
    console.log('SUCCESS: Log file was successfully trimmed!');
  } else {
    console.log('WARNING: Log file may not have been trimmed as expected.');
  }
  
  // Read the beginning of the log file to check for trim header
  const logContent = fs.readFileSync(LOG_FILE_PATH, 'utf8').substring(0, 500);
  console.log('\nBeginning of log file:');
  console.log('-------------------');
  console.log(logContent);
  console.log('-------------------');
  
  if (logContent.includes('LOG TRIMMED AT')) {
    console.log('SUCCESS: Found trim header in log file!');
  } else {
    console.log('WARNING: Trim header not found in log file.');
  }
  
  console.log('\nTest completed!');
}

// Run the test
runTest().catch(error => {
  console.error('Test failed:', error);
});