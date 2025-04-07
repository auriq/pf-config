/**
 * Cross-platform test script for PageFinder Configuration
 * This script tests platform-specific functionality to ensure compatibility
 */

const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const { app } = require('electron');

// Determine platform
const platform = process.platform;
const isWindows = platform === 'win32';
const isMac = platform === 'darwin';
const isLinux = platform === 'linux';

// Log platform information
console.log('=== PageFinder Configuration Platform Test ===');
console.log(`Platform: ${platform}`);
console.log(`Architecture: ${process.arch}`);
console.log(`Node.js: ${process.version}`);
console.log(`Electron: ${process.versions.electron || 'N/A'}`);
console.log('');

// Test results
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

/**
 * Run a test and record the result
 * @param {string} name - Test name
 * @param {Function} testFn - Test function that returns a promise
 * @param {boolean} platformSpecific - Whether this test is platform-specific
 */
async function runTest(name, testFn, platformSpecific = false) {
  try {
    console.log(`Running test: ${name}`);
    const result = await testFn();
    
    if (result === 'skip') {
      console.log(`  SKIPPED: ${name}`);
      results.skipped++;
      results.tests.push({ name, status: 'skipped' });
    } else if (result) {
      console.log(`  PASSED: ${name}`);
      results.passed++;
      results.tests.push({ name, status: 'passed' });
    } else {
      console.log(`  FAILED: ${name}`);
      results.failed++;
      results.tests.push({ name, status: 'failed' });
    }
  } catch (error) {
    console.error(`  ERROR: ${name} - ${error.message}`);
    results.failed++;
    results.tests.push({ name, status: 'error', message: error.message });
  }
}

/**
 * Test environment module
 */
async function testEnvironmentModule() {
  try {
    const env = require('../src/config/environment');
    
    // Check platform detection
    const correctPlatform = 
      (isWindows && env.IS_WINDOWS) || 
      (isMac && env.IS_MAC) || 
      (isLinux && env.IS_LINUX);
    
    if (!correctPlatform) {
      console.error('  Platform detection mismatch!');
      return false;
    }
    
    // Check path separators
    const correctSeparator = 
      (isWindows && env.pathSeparator === '\\') || 
      (!isWindows && env.pathSeparator === '/');
    
    if (!correctSeparator) {
      console.error('  Path separator mismatch!');
      return false;
    }
    
    // Check platform config
    const platformConfig = env.getPlatformConfig();
    if (!platformConfig) {
      console.error('  Failed to get platform config!');
      return false;
    }
    
    // Check platform-specific paths
    if (isWindows && !platformConfig.commonRclonePaths.some(p => p.includes('Program Files'))) {
      console.error('  Windows paths not correctly configured!');
      return false;
    }
    
    if (isMac && !platformConfig.commonRclonePaths.some(p => p.includes('/usr/local/bin'))) {
      console.error('  macOS paths not correctly configured!');
      return false;
    }
    
    if (isLinux && !platformConfig.commonRclonePaths.some(p => p.includes('/usr/bin'))) {
      console.error('  Linux paths not correctly configured!');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('  Error testing environment module:', error.message);
    return false;
  }
}

/**
 * Test config manager
 */
async function testConfigManager() {
  try {
    const ConfigManager = require('../src/modules/config-manager');
    const configManager = new ConfigManager();
    
    // Check if config paths are correctly set
    if (!configManager.configPath || !configManager.settingsPath) {
      console.error('  Config paths not correctly set!');
      return false;
    }
    
    // Check if directories are created
    configManager.ensureDirectories();
    
    const appConfigDir = configManager.getAppConfigDir();
    if (!fs.existsSync(appConfigDir)) {
      console.error(`  App config directory not created: ${appConfigDir}`);
      return false;
    }
    
    // Test settings
    const settings = configManager.getSettings();
    if (!settings) {
      console.error('  Failed to get settings!');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('  Error testing config manager:', error.message);
    return false;
  }
}

/**
 * Test terminal output module
 */
async function testTerminalOutput() {
  try {
    const terminal = require('../src/modules/terminal-output');
    
    // Test configuration
    terminal.configure({
      useColors: true,
      showTimestamp: true,
      logToFile: true
    });
    
    // Test logging
    terminal.log('Test log message');
    terminal.info('Test info message');
    terminal.warning('Test warning message');
    terminal.error('Test error message');
    terminal.success('Test success message');
    
    // Check if log file exists
    const logFilePath = path.join(process.cwd(), 'logs', 'terminal.log');
    if (!fs.existsSync(logFilePath)) {
      console.error(`  Log file not created: ${logFilePath}`);
      return false;
    }
    
    // Check log file content
    const logContent = fs.readFileSync(logFilePath, 'utf8');
    if (!logContent.includes('Test log message')) {
      console.error('  Log file does not contain test messages!');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('  Error testing terminal output:', error.message);
    return false;
  }
}

/**
 * Test Windows-specific functionality
 */
async function testWindowsSpecific() {
  if (!isWindows) {
    return 'skip';
  }
  
  try {
    // Test Windows batch script
    const scriptPath = path.join(process.cwd(), 'scripts', 'sync.bat');
    if (!fs.existsSync(scriptPath)) {
      console.error(`  Windows sync script not found: ${scriptPath}`);
      return false;
    }
    
    // Check for PowerShell availability
    const hasPowerShell = await new Promise((resolve) => {
      exec('where powershell', (error) => {
        resolve(!error);
      });
    });
    
    console.log(`  PowerShell available: ${hasPowerShell}`);
    
    return true;
  } catch (error) {
    console.error('  Error testing Windows-specific functionality:', error.message);
    return false;
  }
}

/**
 * Test macOS-specific functionality
 */
async function testMacSpecific() {
  if (!isMac) {
    return 'skip';
  }
  
  try {
    // Test macOS shell script
    const scriptPath = path.join(process.cwd(), 'scripts', 'sync.sh');
    if (!fs.existsSync(scriptPath)) {
      console.error(`  macOS sync script not found: ${scriptPath}`);
      return false;
    }
    
    // Check script permissions
    const stats = fs.statSync(scriptPath);
    const isExecutable = !!(stats.mode & 0o111);
    if (!isExecutable) {
      console.error(`  macOS sync script is not executable: ${scriptPath}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('  Error testing macOS-specific functionality:', error.message);
    return false;
  }
}

/**
 * Test Linux-specific functionality
 */
async function testLinuxSpecific() {
  if (!isLinux) {
    return 'skip';
  }
  
  try {
    // Test Linux shell script
    const scriptPath = path.join(process.cwd(), 'scripts', 'sync.sh');
    if (!fs.existsSync(scriptPath)) {
      console.error(`  Linux sync script not found: ${scriptPath}`);
      return false;
    }
    
    // Check script permissions
    const stats = fs.statSync(scriptPath);
    const isExecutable = !!(stats.mode & 0o111);
    if (!isExecutable) {
      console.error(`  Linux sync script is not executable: ${scriptPath}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('  Error testing Linux-specific functionality:', error.message);
    return false;
  }
}

/**
 * Main function to run all tests
 */
async function main() {
  // Run common tests
  await runTest('Environment Module', testEnvironmentModule);
  await runTest('Config Manager', testConfigManager);
  await runTest('Terminal Output', testTerminalOutput);
  
  // Run platform-specific tests
  await runTest('Windows-specific', testWindowsSpecific, true);
  await runTest('macOS-specific', testMacSpecific, true);
  await runTest('Linux-specific', testLinuxSpecific, true);
  
  // Print summary
  console.log('\n=== Test Summary ===');
  console.log(`Total: ${results.passed + results.failed + results.skipped}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Skipped: ${results.skipped}`);
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run the main function
main().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});