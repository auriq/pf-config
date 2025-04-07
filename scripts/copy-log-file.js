#!/usr/bin/env node

/**
 * Copy Log File Script
 * 
 * This script copies the terminal.log file to sync_detail.log
 * to ensure that the application can find the log file.
 */

const fs = require('fs-extra');
const path = require('path');

// Path to the log files
const logsDir = path.join('/tmp/pf-config-temp/logs');
const terminalLogPath = path.join(logsDir, 'terminal.log');
const syncDetailLogPath = path.join(logsDir, 'sync_detail.log');

console.log(`Checking if terminal.log exists at: ${terminalLogPath}`);

// Check if the terminal.log file exists
if (fs.existsSync(terminalLogPath)) {
  console.log('terminal.log file exists!');
  
  // Get file stats
  const stats = fs.statSync(terminalLogPath);
  console.log(`terminal.log file size: ${stats.size} bytes`);
  
  // Copy the terminal.log file to sync_detail.log
  try {
    fs.copySync(terminalLogPath, syncDetailLogPath);
    console.log(`Successfully copied terminal.log to sync_detail.log`);
    
    // Verify the copy
    if (fs.existsSync(syncDetailLogPath)) {
      const syncStats = fs.statSync(syncDetailLogPath);
      console.log(`sync_detail.log file size: ${syncStats.size} bytes`);
      console.log('Copy operation successful!');
    } else {
      console.error('Failed to copy file: sync_detail.log does not exist after copy operation');
    }
  } catch (error) {
    console.error(`Error copying log file: ${error.message}`);
  }
} else {
  console.error('terminal.log file does not exist!');
}