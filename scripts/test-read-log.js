#!/usr/bin/env node

/**
 * Test script to read the log file
 */

const fs = require('fs-extra');
const path = require('path');

// Path to the log file
const logPath = path.join('/tmp/pf-config-temp/logs', 'terminal.log');

console.log(`Checking if log file exists at: ${logPath}`);

// Check if the log file exists
if (fs.existsSync(logPath)) {
  console.log('Log file exists!');
  
  // Get file stats
  const stats = fs.statSync(logPath);
  console.log(`Log file size: ${stats.size} bytes`);
  
  // Read the log file
  try {
    const logContent = fs.readFileSync(logPath, 'utf8');
    console.log('Successfully read log file!');
    console.log(`Log file content (first 500 characters):\n${logContent.substring(0, 500)}...`);
  } catch (error) {
    console.error(`Error reading log file: ${error.message}`);
  }
} else {
  console.error('Log file does not exist!');
}