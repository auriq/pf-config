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