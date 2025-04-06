#!/usr/bin/env node

/**
 * Environment Configuration Test Script
 * 
 * Tests the cross-platform environment configuration to ensure it works
 * consistently on Windows, macOS, and Linux.
 * 
 * Usage:
 *   node scripts/test-environment.js [--verbose]
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// Process arguments
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');

// Set up console logging
console.log('=== PageFinder Environment Configuration Test ===\n');

// Basic platform information
console.log('Platform Information:');
console.log(`  OS Platform:     ${process.platform}`);
console.log(`  OS Release:      ${os.release()}`);
console.log(`  Architecture:    ${process.arch}`);
console.log(`  Node Version:    ${process.version}`);
console.log(`  Home Directory:  ${os.homedir()}`);
console.log(`  Working Dir:     ${process.cwd()}`);
console.log(`  Electron:        ${process.versions.electron || 'Not running in Electron'}`);
console.log('');

// Try to load the environment module
console.log('Loading environment module...');
let env;
try {
  env = require('../src/config/environment');
  console.log('Environment module loaded successfully.\n');
} catch (error) {
  console.error(`Error loading environment module: ${error.message}`);
  process.exit(1);
}

// Display environment module information
console.log('Environment Module Information:');
console.log(`  Is Windows:      ${env.IS_WINDOWS}`);
console.log(`  Is macOS:        ${env.IS_MAC}`);
console.log(`  Is Linux:        ${env.IS_LINUX}`);
console.log('');

// Display important paths
console.log('Important Paths:');
console.log(`  App Config:      ${env.paths.appConfig}`);
console.log(`  Logs Directory:  ${env.paths.logs}`);
console.log(`  Default Rclone:  ${env.paths.rcloneDefault}`);
console.log('');

// Check if directories exist
const appConfigExists = fs.existsSync(env.paths.appConfig);
const logsExists = fs.existsSync(env.paths.logs);

console.log('Directory Existence Check:');
console.log(`  App Config:      ${appConfigExists ? 'Exists' : 'Missing'}`);
console.log(`  Logs Directory:  ${logsExists ? 'Exists' : 'Missing'}`);
console.log('');

// Try to create directories if they don't exist
if (!appConfigExists || !logsExists) {
  console.log('Creating missing directories...');
  
  if (env.ensureDirectories()) {
    console.log('Directories created successfully.');
  } else {
    console.error('Failed to create directories.');
  }
  console.log('');
}

// Find Rclone
console.log('Looking for Rclone...');
const rclonePath = env.findRclone();

if (rclonePath) {
  console.log(`Rclone found at: ${rclonePath}`);
  
  // Verify it's actually executable
  try {
    const stats = fs.statSync(rclonePath);
    const isExecutable = stats.mode & 0o111;
    console.log(`Rclone executable: ${isExecutable ? 'Yes' : 'No'}`);
  } catch (error) {
    console.error(`Error checking rclone: ${error.message}`);
  }
} else {
  console.log('Rclone not found in any common location.');
}
console.log('');

// Platform-specific settings
console.log('Platform-specific Settings:');
const platformSettings = env.getPlatformSettings();
console.log(`  Platform:        ${platformSettings.platform}`);
console.log(`  Path Separator:  ${platformSettings.pathSeparator}`);
console.log(`  Default Shell:   ${platformSettings.shell}`);
console.log(`  Documents Dir:   ${platformSettings.commonLocations.documents}`);
console.log(`  Desktop Dir:     ${platformSettings.commonLocations.desktop}`);
console.log('');

// Test path resolution
console.log('Path Resolution Tests:');
const testPaths = [
  '~',
  '~/Documents',
  '~/Desktop'
];

testPaths.forEach(testPath => {
  const resolved = env.resolveHome(testPath);
  console.log(`  ${testPath} → ${resolved}`);
});
console.log('');

// Show summary
console.log('Environment Test Summary:');
console.log(`  Platform Support:     ${env.IS_WINDOWS || env.IS_MAC || env.IS_LINUX ? 'OK' : 'UNSUPPORTED'}`);
console.log(`  Directory Structure:  ${appConfigExists && logsExists ? 'OK' : 'ISSUES'}`);
console.log(`  Rclone Available:     ${rclonePath ? 'YES' : 'NO'}`);
console.log('');

console.log('Test completed.');