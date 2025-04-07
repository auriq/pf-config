#!/usr/bin/env node

/**
 * Test script for sync-handler.js logging
 * 
 * This script tests the logging functionality in the sync-handler.js module
 * to ensure that terminal logs are displayed correctly.
 */

const syncHandler = require('../src/modules/sync-handler');
const terminal = require('../src/modules/terminal-output');
const path = require('path');
const fs = require('fs-extra');

// Configure terminal output
terminal.configure({
  useColors: true,
  showTimestamp: true,
  logToFile: true
});

// Create a test directory if it doesn't exist
const testDir = path.join(process.cwd(), 'test-temp');
fs.ensureDirSync(testDir);

// Create test files
terminal.header('Setting up test environment');
terminal.log('Creating test files...');

// Create a mock config file
const mockConfigPath = path.join(testDir, 'mock-rclone.conf');
fs.writeFileSync(mockConfigPath, `
[test-remote]
type = local
nounc = true
`);

// Test options
const testOptions = {
  rclonePath: process.platform === 'win32' ? 'where' : 'which', // Use a simple command that exists
  combinedConfigPath: mockConfigPath,
  cloudRemotes: ['test-remote'],
  pfRemoteName: 'pf-test',
  bucketName: 'test-bucket'
};

// Run the test
async function runTest() {
  terminal.header('Testing sync-handler.js logging');
  
  try {
    // Test the testSync function
    terminal.log('Testing testSync function...');
    const testResult = await syncHandler.testSync(testOptions);
    
    terminal.log('Test result:');
    terminal.log(JSON.stringify(testResult, null, 2));
    
    // Test the executeSync function
    terminal.log('Testing executeSync function...');
    const execResult = await syncHandler.executeSync(testOptions);
    
    terminal.log('Execute result:');
    terminal.log(JSON.stringify(execResult, null, 2));
    
    terminal.success('Test completed successfully!');
  } catch (error) {
    terminal.error('Test failed:', error.message);
  } finally {
    // Clean up
    terminal.log('Cleaning up test files...');
    try {
      fs.removeSync(testDir);
      terminal.success('Test cleanup completed');
    } catch (cleanupError) {
      terminal.error('Error during cleanup:', cleanupError.message);
    }
  }
}

// Run the test
runTest();