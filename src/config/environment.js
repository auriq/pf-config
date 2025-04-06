/**
 * Environment configuration module
 * Handles cross-platform path resolution and environment detection
 */

const os = require('os');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

const PLATFORM = process.platform;
const IS_WINDOWS = PLATFORM === 'win32';
const IS_MAC = PLATFORM === 'darwin';
const IS_LINUX = PLATFORM === 'linux';
const HOME_DIR = os.homedir();

// Common paths by platform
const paths = {
  appConfig: IS_WINDOWS 
    ? path.join(HOME_DIR, 'AppData', 'Roaming', 'pf-config')
    : path.join(HOME_DIR, '.config', 'pf-config'),
    
  logs: path.join(process.cwd(), 'logs'),
  
  rcloneDefault: IS_WINDOWS
    ? 'C:\\Program Files\\rclone\\rclone.exe'
    : IS_MAC 
      ? '/usr/local/bin/rclone' 
      : '/usr/bin/rclone'
};

/**
 * Ensure critical directories exist
 */
function ensureDirectories() {
  try {
    // Ensure config directory exists
    fs.ensureDirSync(paths.appConfig);
    
    // Ensure logs directory exists
    fs.ensureDirSync(paths.logs);
    
    return true;
  } catch (error) {
    console.error('Failed to create required directories:', error.message);
    return false;
  }
}

/**
 * Find rclone in the PATH
 * @returns {string|null} Path to rclone or null if not found
 */
function findRclone() {
  try {
    // Try which/where command based on platform
    const command = IS_WINDOWS ? 'where rclone' : 'which rclone';
    const output = execSync(command, { encoding: 'utf8' }).trim();
    
    // Output can have multiple lines, take the first one
    const rclonePath = output.split('\n')[0].trim();
    
    if (fs.existsSync(rclonePath)) {
      return rclonePath;
    }
  } catch (error) {
    // Command failed, rclone not in PATH
  }
  
  // Check default locations
  if (fs.existsSync(paths.rcloneDefault)) {
    return paths.rcloneDefault;
  }
  
  // Check common installation directories based on platform
  const commonPaths = IS_WINDOWS
    ? [
        'C:\\rclone\\rclone.exe',
        'C:\\Program Files (x86)\\rclone\\rclone.exe',
        path.join(HOME_DIR, 'rclone', 'rclone.exe')
      ]
    : IS_MAC
      ? [
          '/usr/bin/rclone',
          '/opt/local/bin/rclone',
          '/opt/homebrew/bin/rclone',
          path.join(HOME_DIR, 'bin', 'rclone')
        ]
      : [
          '/usr/bin/rclone',
          '/usr/local/bin/rclone',
          '/opt/bin/rclone',
          path.join(HOME_DIR, 'bin', 'rclone')
        ];
        
  for (const testPath of commonPaths) {
    if (fs.existsSync(testPath)) {
      return testPath;
    }
  }
  
  // Not found in any common location
  return null;
}

/**
 * Get platform-specific settings
 * @returns {Object} Platform settings
 */
function getPlatformSettings() {
  if (IS_WINDOWS) {
    return {
      pathSeparator: '\\',
      platform: 'windows',
      shell: process.env.COMSPEC || 'cmd.exe',
      commonLocations: {
        documents: path.join(HOME_DIR, 'Documents'),
        desktop: path.join(HOME_DIR, 'Desktop')
      }
    };
  } else if (IS_MAC) {
    return {
      pathSeparator: '/',
      platform: 'macos',
      shell: process.env.SHELL || '/bin/bash',
      commonLocations: {
        documents: path.join(HOME_DIR, 'Documents'),
        desktop: path.join(HOME_DIR, 'Desktop')
      }
    };
  } else {
    return {
      pathSeparator: '/',
      platform: 'linux',
      shell: process.env.SHELL || '/bin/bash',
      commonLocations: {
        documents: path.join(HOME_DIR, 'Documents'),
        desktop: path.join(HOME_DIR, 'Desktop')
      }
    };
  }
}

// Export the environment module
module.exports = {
  IS_WINDOWS,
  IS_MAC,
  IS_LINUX,
  HOME_DIR,
  paths,
  findRclone,
  ensureDirectories,
  getPlatformSettings,
  
  // Helper for checking if path exists
  pathExists: fs.existsSync,
  
  // Helper for making paths absolute
  resolveHome: (filepath) => {
    if (!filepath) return '';
    if (filepath.startsWith('~/') || filepath === '~') {
      return path.join(HOME_DIR, filepath.slice(2));
    }
    return filepath;
  }
};