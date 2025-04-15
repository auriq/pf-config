/**
 * Prepare for Build Script
 * 
 * This script prepares the application for building by ensuring the .env file
 * is properly included in the build and that all necessary directories exist.
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

console.log('=== Preparing for Build ===');

// Ensure .env file exists
const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  console.log('.env file not found, creating default .env file...');
  
  // Create default .env file
  const defaultEnv = `# PageFinder Configuration Environment Variables
RCLONE_PATH=/usr/local/bin/rclone
WORKSPACE_DIR=${process.platform === 'win32' 
  ? path.join(os.homedir(), 'AppData', 'Roaming', 'pf-config').replace(/\\/g, '\\\\')
  : path.join(os.homedir(), '.config', 'pf-config')}
# Path to scripts directory - used for finding shell scripts (absolute path)
SCRIPTS_PATH=${path.join(process.cwd(), 'scripts').replace(/\\/g, '\\\\')}
`;
  
  fs.writeFileSync(envPath, defaultEnv);
  console.log('Created default .env file.');
} else {
  console.log('.env file found, checking contents...');
  
  // Read .env file
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // Check if WORKSPACE_DIR is defined
  if (!envContent.includes('WORKSPACE_DIR=')) {
    console.log('WORKSPACE_DIR not found in .env file, adding default...');
    
    // Add WORKSPACE_DIR to .env file
    const defaultWorkspaceDir = process.platform === 'win32' 
      ? path.join(os.homedir(), 'AppData', 'Roaming', 'pf-config').replace(/\\/g, '\\\\')
      : path.join(os.homedir(), '.config', 'pf-config');
    
    const updatedEnv = envContent + `\nWORKSPACE_DIR=${defaultWorkspaceDir}\n`;
    fs.writeFileSync(envPath, updatedEnv);
    console.log('Added WORKSPACE_DIR to .env file.');
  }
}

// Ensure workspace directory exists
try {
  // Get workspace directory from .env file
  const envContent = fs.readFileSync(envPath, 'utf8');
  const workspaceDirMatch = envContent.match(/WORKSPACE_DIR=(.+)/);
  
  if (workspaceDirMatch && workspaceDirMatch[1]) {
    const workspaceDir = workspaceDirMatch[1].trim();
    console.log(`Ensuring workspace directory exists: ${workspaceDir}`);
    
    fs.ensureDirSync(workspaceDir);
    console.log('Workspace directory exists or was created.');
  } else {
    console.log('Could not determine workspace directory from .env file.');
  }
} catch (error) {
  console.error(`Error ensuring workspace directory exists: ${error.message}`);
}

console.log('=== Build Preparation Complete ===');