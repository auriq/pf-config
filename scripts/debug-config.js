/**
 * Debug Configuration Script
 * 
 * This script prints out the current configuration and environment variables
 * to help troubleshoot issues with the configuration in production mode.
 */

const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const { app } = require('electron');

console.log('=== PageFinder Configuration Debug ===');
console.log('\nSystem Information:');
console.log(`Platform: ${process.platform}`);
console.log(`Architecture: ${process.arch}`);
console.log(`Node.js Version: ${process.version}`);
console.log(`Electron Version: ${process.versions.electron}`);
console.log(`Home Directory: ${os.homedir()}`);
console.log(`Current Working Directory: ${process.cwd()}`);
console.log(`App Path: ${app ? app.getAppPath() : 'N/A'}`);
console.log(`Is Packaged: ${app ? app.isPackaged : 'N/A'}`);
console.log(`Resources Path: ${process.resourcesPath || 'N/A'}`);

console.log('\nEnvironment Variables:');
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'Not set'}`);
console.log(`WORKSPACE_DIR: ${process.env.WORKSPACE_DIR || 'Not set'}`);
console.log(`RCLONE_PATH: ${process.env.RCLONE_PATH || 'Not set'}`);
console.log(`SCRIPTS_PATH: ${process.env.SCRIPTS_PATH || 'Not set'}`);

// Check for .env file
console.log('\n.env File:');
const possibleEnvPaths = [
  path.join(process.cwd(), '.env'),
  app ? path.join(app.getAppPath(), '.env') : null,
  process.resourcesPath ? path.join(process.resourcesPath, '.env') : null
].filter(Boolean);

for (const envPath of possibleEnvPaths) {
  console.log(`Checking for .env at: ${envPath}`);
  if (fs.existsSync(envPath)) {
    console.log(`Found .env at: ${envPath}`);
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      console.log('Content:');
      console.log(envContent);
    } catch (error) {
      console.error(`Error reading .env file: ${error.message}`);
    }
  } else {
    console.log(`Not found at: ${envPath}`);
  }
}

// Check workspace directory
console.log('\nWorkspace Directory:');
const workspaceDir = process.env.WORKSPACE_DIR || 
  (process.platform === 'win32' 
    ? path.join(os.homedir(), 'AppData', 'Roaming', 'pf-config')
    : path.join(os.homedir(), '.config', 'pf-config'));

console.log(`Workspace Directory: ${workspaceDir}`);
console.log(`Exists: ${fs.existsSync(workspaceDir)}`);

if (fs.existsSync(workspaceDir)) {
  try {
    const files = fs.readdirSync(workspaceDir);
    console.log('Files in workspace directory:');
    files.forEach(file => console.log(`- ${file}`));
  } catch (error) {
    console.error(`Error reading workspace directory: ${error.message}`);
  }
}

// Try to load configuration
try {
  const { config } = require('../src/config');
  console.log('\nLoaded Configuration:');
  console.log(JSON.stringify(config, null, 2));
} catch (error) {
  console.error(`Error loading configuration: ${error.message}`);
}

console.log('\n=== End of Debug Information ===');