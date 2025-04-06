/**
 * Environment Configuration Module
 * 
 * This module defines platform-specific parameters and configurations.
 * It provides a centralized location for all environment-dependent settings
 * and ensures consistency between development and production environments.
 */

const os = require('os');
const fs = require('fs-extra');
const path = require('path');
const { app } = require('electron');

/**
 * Platform Detection
 * Explicitly identify the current operating system
 */
const PLATFORM = process.platform;
const IS_WINDOWS = PLATFORM === 'win32';
const IS_MAC = PLATFORM === 'darwin';
const IS_LINUX = PLATFORM === 'linux';
const HOME_DIR = os.homedir();

/**
 * Development Mode Detection
 * Determines if the application is running in development or production mode
 * 
 * @returns {boolean} True if running in development mode, false otherwise
 */
function isDevelopmentMode() {
  return process.env.NODE_ENV === 'development' || 
         process.defaultApp || 
         /[\\/]electron-prebuilt[\\/]/.test(process.execPath) || 
         /[\\/]electron[\\/]/.test(process.execPath);
}

const IS_DEV = isDevelopmentMode();
console.log(`Running in ${IS_DEV ? 'development' : 'production'} mode`);

/**
 * Determine Application Directory
 * Returns the base directory of the application, using:
 * - app.getAppPath() in production (installed app)
 * - path.resolve from __dirname in development (npm start)
 */
function determineAppBaseDir() {
  try {
    // For packaged app
    if (!IS_DEV && app && app.getAppPath) {
      const appPath = app.getAppPath();
      console.log(`Production app directory: ${appPath}`);
      return appPath;
    }
  } catch (error) {
    console.log('Electron app object not available, using __dirname');
  }
  
  // For development or non-Electron environment
  // Go up two levels from the current file to reach the application root
  const devPath = path.resolve(__dirname, '..', '..');
  console.log(`Development app directory: ${devPath}`);
  return devPath;
}

/**
 * USER DATA DIRECTORY
 * This is the critical path that must be consistent between development and production.
 * We use the Electron app.getPath('userData') when available, falling back to platform-specific
 * locations to ensure consistency.
 */
function determineUserDataDir() {
  try {
    // Use Electron's user data directory when available
    if (app && app.getPath) {
      const userDataPath = app.getPath('userData');
      console.log(`Using Electron userData directory: ${userDataPath}`);
      return userDataPath;
    }
  } catch (error) {
    console.log('Electron app.getPath not available, using platform-specific paths');
  }
  
  // Fall back to platform-specific locations
  if (IS_WINDOWS) {
    return path.join(HOME_DIR, 'AppData', 'Roaming', 'pf-config');
  } else {
    return path.join(HOME_DIR, '.config', 'pf-config');
  }
}

const USER_DATA_DIR = determineUserDataDir();
console.log(`User data directory: ${USER_DATA_DIR}`);

/**
 * Platform-Specific Path Configurations
 * 
 * Defines path configurations for each supported operating system,
 * ensuring the same config files are used in both development and production.
 */
const PATHS = {
  // Application base directory (determined at runtime)
  appBase: determineAppBaseDir(),
  
  // USER DATA PATHS - these must be consistent between dev and prod
  appConfig: USER_DATA_DIR,
  logs: path.join(USER_DATA_DIR, 'logs'),
  data: path.join(USER_DATA_DIR, 'data'),
  scripts: path.join(USER_DATA_DIR, 'scripts'),
  backup: path.join(USER_DATA_DIR, 'backup'),
  
  // Windows paths
  ...(IS_WINDOWS && {
    rcloneDefault: 'C:\\Program Files\\rclone\\rclone.exe',
    documents: path.join(HOME_DIR, 'Documents'),
    desktop: path.join(HOME_DIR, 'Desktop'),
    temp: process.env.TEMP || path.join(HOME_DIR, 'AppData', 'Local', 'Temp')
  }),
  
  // macOS paths
  ...(IS_MAC && {
    rcloneDefault: '/usr/local/bin/rclone',
    documents: path.join(HOME_DIR, 'Documents'),
    desktop: path.join(HOME_DIR, 'Desktop'),
    temp: '/tmp'
  }),
  
  // Linux paths
  ...(IS_LINUX && {
    rcloneDefault: '/usr/bin/rclone',
    documents: path.join(HOME_DIR, 'Documents'),
    desktop: path.join(HOME_DIR, 'Desktop'),
    temp: '/tmp'
  })
};

/**
 * Platform-Specific Configuration Parameters
 * 
 * Defines configuration parameters specific to each supported platform
 */
const PLATFORM_CONFIG = {
  // Windows-specific configuration
  windows: {
    name: 'Windows',
    pathSeparator: '\\',
    shell: process.env.COMSPEC || 'cmd.exe',
    shellArgs: ['/c'],
    rcloneConfigExtension: '.conf',
    commonRclonePaths: [
      'C:\\Program Files\\rclone\\rclone.exe',
      'C:\\Program Files (x86)\\rclone\\rclone.exe',
      'C:\\rclone\\rclone.exe',
      path.join(HOME_DIR, 'rclone', 'rclone.exe'),
      path.join(HOME_DIR, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages', 'Rclone.Rclone_*', 'rclone.exe')
    ],
    rcloneWhichCommand: 'where rclone',
    syncScript: 'sync.bat',
    fileBrowser: 'explorer',
    fileDialogFilters: [
      { name: 'Configuration Files', extensions: ['conf'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  },
  
  // macOS-specific configuration
  macos: {
    name: 'macOS',
    pathSeparator: '/',
    shell: process.env.SHELL || '/bin/bash',
    shellArgs: ['-c'],
    rcloneConfigExtension: '.conf',
    commonRclonePaths: [
      '/usr/local/bin/rclone',
      '/usr/bin/rclone',
      '/opt/homebrew/bin/rclone',
      '/opt/local/bin/rclone',
      path.join(HOME_DIR, 'bin', 'rclone')
    ],
    rcloneWhichCommand: 'which rclone',
    syncScript: 'sync.sh',
    fileBrowser: 'open',
    fileDialogFilters: [
      { name: 'Configuration Files', extensions: ['conf'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  },
  
  // Linux-specific configuration
  linux: {
    name: 'Linux',
    pathSeparator: '/',
    shell: process.env.SHELL || '/bin/bash',
    shellArgs: ['-c'],
    rcloneConfigExtension: '.conf',
    commonRclonePaths: [
      '/usr/bin/rclone',
      '/usr/local/bin/rclone',
      '/opt/bin/rclone',
      path.join(HOME_DIR, 'bin', 'rclone')
    ],
    rcloneWhichCommand: 'which rclone',
    syncScript: 'sync.sh',
    fileBrowser: 'xdg-open',
    fileDialogFilters: [
      { name: 'Configuration Files', extensions: ['conf'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  }
};

/**
 * Ensure critical directories exist
 * Creates required directories if they don't exist
 * 
 * @returns {boolean} True if all directories were created successfully, false otherwise
 */
function ensureDirectories() {
  try {
    // Ensure config directory exists
    fs.ensureDirSync(PATHS.appConfig);
    
    // Ensure logs directory exists
    fs.ensureDirSync(PATHS.logs);
    
    // Ensure backup directory exists
    fs.ensureDirSync(PATHS.backup);
    
    // Ensure data directory exists
    fs.ensureDirSync(PATHS.data);
    
    // Ensure scripts directory exists
    fs.ensureDirSync(PATHS.scripts);
    
    // Ensure temp directory exists (if not a system directory)
    if (PATHS.temp.includes(HOME_DIR)) {
      fs.ensureDirSync(PATHS.temp);
    }
    
    console.log('All required directories created successfully');
    
    // Log all paths for debugging
    console.log('Application paths:');
    Object.entries(PATHS).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    
    return true;
  } catch (error) {
    console.error('Failed to create required directories:', error.message);
    return false;
  }
}

/**
 * Get the path to a file in the application directory
 * Useful for accessing files that are part of the application bundle
 * 
 * @param {string} relativePath - Path relative to the application root
 * @returns {string} Absolute path to the file
 */
function getAppFilePath(relativePath) {
  return path.join(PATHS.appBase, relativePath);
}

/**
 * Get the correct path for storing application data files
 * This ensures files are stored in a predictable location regardless of
 * how the application is launched
 * 
 * @param {string} fileName - Name of the file to store
 * @param {string} subDirectory - Optional subdirectory within the data directory
 * @returns {string} Full path to the file
 */
function getDataFilePath(fileName, subDirectory = '') {
  const dataPath = subDirectory 
    ? path.join(PATHS.data, subDirectory)
    : PATHS.data;
    
  // Ensure the directory exists
  fs.ensureDirSync(dataPath);
  
  return path.join(dataPath, fileName);
}

/**
 * Get the path for a log file
 * Ensures logs are stored in a consistent location
 * 
 * @param {string} logName - Name of the log file
 * @returns {string} Full path to the log file
 */
function getLogFilePath(logName) {
  return path.join(PATHS.logs, logName);
}

/**
 * Get the path for a configuration file
 * Ensures configuration files are stored in a consistent location
 * 
 * @param {string} configName - Name of the configuration file
 * @returns {string} Full path to the configuration file
 */
function getConfigFilePath(configName) {
  return path.join(PATHS.appConfig, configName);
}

/**
 * Get platform-specific configuration
 * Returns the configuration specific to the current platform
 * 
 * @returns {Object} Platform-specific configuration
 */
function getPlatformConfig() {
  if (IS_WINDOWS) {
    return PLATFORM_CONFIG.windows;
  } else if (IS_MAC) {
    return PLATFORM_CONFIG.macos;
  } else {
    return PLATFORM_CONFIG.linux;
  }
}

// Export the environment module with all constants and core functions
module.exports = {
  // Platform detection
  IS_WINDOWS,
  IS_MAC,
  IS_LINUX,
  PLATFORM,
  HOME_DIR,
  IS_DEV,
  USER_DATA_DIR,
  
  // Path configurations
  PATHS,
  
  // Platform-specific configurations
  PLATFORM_CONFIG,
  
  // Core functions - only those that define parameters or provide essential helpers
  ensureDirectories,
  getPlatformConfig,
  isDevelopmentMode,
  getAppFilePath,
  getDataFilePath,
  getLogFilePath,
  getConfigFilePath,
  
  // Path helpers
  pathExists: fs.existsSync,
  
  // Helper for making paths absolute
  resolveHome: (filepath) => {
    if (!filepath) return '';
    if (filepath.startsWith('~/') || filepath === '~') {
      return path.join(HOME_DIR, filepath.slice(2));
    }
    return filepath;
  },
  
  // Path separator for current platform
  pathSeparator: IS_WINDOWS ? '\\' : '/',
  
  // Helper for getting system temporary directory
  getTempDir: () => PATHS.temp,
  
  // Helper for getting script extension for current platform
  getScriptExtension: () => IS_WINDOWS ? '.bat' : '.sh'
};