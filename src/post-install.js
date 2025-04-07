/**
 * Post-installation script for macOS
 * 
 * This script runs automatically when the app is first launched
 * to fix common permission issues and ensure proper configuration.
 */

const { app } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

console.log('Running post-installation script...');

/**
 * Fix rclone permissions
 */
function fixRclonePermissions() {
  try {
    console.log('Checking for rclone installation...');
    
    // Common rclone paths on macOS
    const rclonePaths = [
      '/usr/local/bin/rclone',
      '/usr/bin/rclone',
      '/opt/homebrew/bin/rclone',
      '/opt/local/bin/rclone',
      path.join(os.homedir(), 'bin', 'rclone')
    ];
    
    // Check each path and fix permissions if found
    for (const rclonePath of rclonePaths) {
      if (fs.existsSync(rclonePath)) {
        console.log(`Found rclone at ${rclonePath}, fixing permissions...`);
        try {
          execSync(`chmod +x "${rclonePath}"`, { stdio: 'inherit' });
          console.log('Fixed rclone permissions');
          return true;
        } catch (error) {
          console.error(`Error setting permissions for ${rclonePath}:`, error.message);
          // Continue to next path
        }
      }
    }
    
    console.log('Rclone not found in common paths');
    return false;
  } catch (error) {
    console.error('Error fixing rclone permissions:', error.message);
    return false;
  }
}

/**
 * Create necessary directories
 */
function createDirectories() {
  try {
    // Create app config directory
    const appConfigDir = path.join(os.homedir(), '.config', 'pf-config');
    fs.ensureDirSync(appConfigDir);
    console.log(`Created app config directory: ${appConfigDir}`);
    
    // Create logs directory
    const logsDir = path.join(appConfigDir, 'logs');
    fs.ensureDirSync(logsDir);
    console.log(`Created logs directory: ${logsDir}`);
    
    // Create data directory
    const dataDir = path.join(appConfigDir, 'data');
    fs.ensureDirSync(dataDir);
    console.log(`Created data directory: ${dataDir}`);
    
    // Create backup directory
    const backupDir = path.join(appConfigDir, 'backup');
    fs.ensureDirSync(backupDir);
    console.log(`Created backup directory: ${backupDir}`);
    
    // Create scripts directory
    const scriptsDir = path.join(appConfigDir, 'scripts');
    fs.ensureDirSync(scriptsDir);
    console.log(`Created scripts directory: ${scriptsDir}`);
    
    // Set permissions on the app config directory
    try {
      execSync(`chmod -R 755 "${appConfigDir}"`, { stdio: 'inherit' });
      console.log(`Set permissions on ${appConfigDir}`);
    } catch (error) {
      console.error(`Error setting permissions for ${appConfigDir}:`, error.message);
    }
    
    return true;
  } catch (error) {
    console.error('Error creating directories:', error.message);
    return false;
  }
}

/**
 * Create empty config files if they don't exist
 */
function createConfigFiles() {
  try {
    const appConfigDir = path.join(os.homedir(), '.config', 'pf-config');
    
    // Create cloud.conf if it doesn't exist
    const cloudConfPath = path.join(appConfigDir, 'cloud.conf');
    if (!fs.existsSync(cloudConfPath)) {
      fs.writeFileSync(cloudConfPath, '# PageFinder Cloud Configuration\n');
      console.log(`Created empty cloud.conf at ${cloudConfPath}`);
    }
    
    // Create settings.json if it doesn't exist
    const settingsPath = path.join(appConfigDir, 'settings.json');
    if (!fs.existsSync(settingsPath)) {
      const defaultSettings = {
        rclonePath: '/usr/local/bin/rclone'
      };
      fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
      console.log(`Created settings.json at ${settingsPath}`);
    }
    
    // Create remotes-metadata.json if it doesn't exist
    const metadataPath = path.join(appConfigDir, 'remotes-metadata.json');
    if (!fs.existsSync(metadataPath)) {
      const defaultMetadata = { remotes: {} };
      fs.writeFileSync(metadataPath, JSON.stringify(defaultMetadata, null, 2));
      console.log(`Created remotes-metadata.json at ${metadataPath}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error creating config files:', error.message);
    return false;
  }
}

/**
 * Run all post-installation tasks
 */
function runPostInstall() {
  console.log('Starting post-installation tasks...');
  
  // Fix rclone permissions
  const rcloneFixed = fixRclonePermissions();
  console.log(`Rclone permissions fixed: ${rcloneFixed}`);
  
  // Create directories
  const directoriesCreated = createDirectories();
  console.log(`Directories created: ${directoriesCreated}`);
  
  // Create config files
  const configFilesCreated = createConfigFiles();
  console.log(`Config files created: ${configFilesCreated}`);
  
  console.log('Post-installation tasks completed.');
  
  // Create a marker file to indicate that post-install has run
  try {
    const markerPath = path.join(app.getPath('userData'), '.post-install-complete');
    fs.writeFileSync(markerPath, new Date().toISOString());
    console.log(`Created post-install marker at ${markerPath}`);
  } catch (error) {
    console.error('Error creating post-install marker:', error.message);
  }
}

// Export the function for use in main.js
module.exports = { runPostInstall };