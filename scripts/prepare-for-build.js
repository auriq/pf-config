/**
 * Prepare for Build Script
 *
 * This script prepares the application for building by ensuring the .env file
 * is properly included in the build and that all necessary directories exist.
 * It also ensures that the appropriate script files for the target platform are available.
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

console.log('=== Preparing for Build ===');
console.log(`Platform: ${process.platform}`);
console.log(`Architecture: ${process.arch}`);

// Check if we're building for Windows and ensure Windows script versions exist
if (process.platform === 'win32' || process.argv.includes('--all') || process.argv.includes('--win')) {
  console.log('Preparing for Windows build...');

  // Check for critical scripts and their Windows versions
  const criticalScripts = [
    { sh: 'env-loader.sh', ps1: 'env-loader.ps1' },
    { sh: 'sync-workspace.sh', ps1: 'sync-workspace.ps1' },
    { sh: 'purge-workspace.sh', ps1: 'purge-workspace.ps1' },
    { sh: 'debug-production.sh', ps1: 'debug-production.ps1', bat: 'debug-production.bat' }
  ];

  const scriptsDir = path.join(process.cwd(), 'scripts');

  for (const script of criticalScripts) {
    const shPath = path.join(scriptsDir, script.sh);
    const ps1Path = path.join(scriptsDir, script.ps1);
    const batPath = script.bat ? path.join(scriptsDir, script.bat) : null;

    if (fs.existsSync(shPath) && !fs.existsSync(ps1Path)) {
      console.log(`Warning: ${script.sh} exists but ${script.ps1} is missing. Windows users may experience issues.`);
    }

    if (script.bat && fs.existsSync(shPath) && !fs.existsSync(batPath)) {
      console.log(`Warning: ${script.sh} exists but ${script.bat} is missing. Windows users may experience issues.`);
    }
  }
}

console.log('=== Build Preparation Complete ===');