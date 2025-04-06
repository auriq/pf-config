#!/usr/bin/env node

/**
 * Terminal Output Test Script
 * 
 * This script tests the terminal output logging functionality by generating
 * different types of log messages and verifying they are written to the log file.
 * 
 * Usage:
 *   node scripts/test-terminal-log.js [--verbose]
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// Process arguments
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');

// First, clear terminal.log to have a clean slate
const logFilePath = path.join(process.cwd(), 'logs', 'terminal.log');

try {
  // Ensure logs directory exists
  fs.ensureDirSync(path.join(process.cwd(), 'logs'));
  
  // Create or clear the log file
  fs.writeFileSync(logFilePath, `Test started at ${new Date().toISOString()}\n\n`);
  console.log(`Initialized test log file at: ${logFilePath}`);
} catch (error) {
  console.error(`Error setting up log file: ${error.message}`);
  process.exit(1);
}

// Try to import terminal-output module
let terminal;
try {
  terminal = require('../src/modules/terminal-output');
  terminal.configure({
    useColors: true,
    showTimestamp: true,
    logToFile: true
  });
  
  console.log('Successfully loaded terminal-output module');
} catch (error) {
  console.error(`Failed to load terminal-output module: ${error.message}`);
  process.exit(1);
}

// Console vs Terminal output test
console.log('\n==== Console Logging Test ====');
console.log('Standard console.log output');
console.info('Info-level message');
console.warn('Warning-level message');
console.error('Error-level message');
console.debug('Debug-level message');

console.log('\n==== Terminal Module Test ====');
terminal.log('Standard terminal.log output');
terminal.info('Info-level terminal message');
terminal.warning('Warning-level terminal message');
terminal.error('Error-level terminal message');
terminal.debug('Debug-level terminal message');
terminal.success('Success message from terminal');

// Formatted output test
console.log('\n==== Formatted Output Test ====');
terminal.header('Terminal Output Test');
terminal.box('This is a boxed message');
terminal.hr('-');

// Test with multiple lines
terminal.info(`Multiple line test:
Line 1
Line 2
Line 3`);

// Environment info
console.log('\n==== Environment Information ====');
const envInfo = {
  platform: process.platform,
  nodeVersion: process.version,
  hostname: os.hostname(),
  username: os.userInfo().username,
  cwd: process.cwd(),
  timestamp: new Date().toISOString()
};

terminal.info('Environment information:');
console.log(envInfo);

// Check the log file
setTimeout(() => {
  console.log('\n==== Terminal Log File Check ====');
  
  try {
    if (fs.existsSync(logFilePath)) {
      const stats = fs.statSync(logFilePath);
      const fileSizeKB = (stats.size / 1024).toFixed(2);
      console.log(`Log file exists at: ${logFilePath}`);
      console.log(`Log file size: ${fileSizeKB} KB`);
      
      const content = fs.readFileSync(logFilePath, 'utf8');
      const lineCount = content.split('\n').length;
      console.log(`Log file contains ${lineCount} lines`);
      
      if (verbose) {
        console.log('\n==== Log File Contents ====');
        console.log(content);
      } else {
        console.log('Use --verbose to see log file contents');
      }
    } else {
      console.error('Log file does not exist!');
    }
  } catch (error) {
    console.error(`Error checking log file: ${error.message}`);
  }
  
  console.log('\nTest completed successfully!');
}, 500); // Slight delay to ensure all file writes are complete