/**
 * Configuration module for PageFinder Configuration Utility
 * Loads environment variables from .env file and provides a centralized configuration object
 */

const path = require('path');
const os = require('os');
const fs = require('fs-extra');
const { app } = require('electron');

// Determine if we're in production or development mode
const isProduction = app && app.isPackaged;

// Load environment variables from .env file
// In production, we need to look for the .env file in the app's root directory
let envPath = path.join(process.cwd(), '.env');
if (isProduction) {
  // In production, try to find .env in the app's root directory
  const appPath = app.getAppPath();
  const possibleEnvPaths = [
    path.join(appPath, '.env'),
    path.join(process.resourcesPath, '.env'),
    path.join(process.cwd(), '.env')
  ];
  
  for (const possiblePath of possibleEnvPaths) {
    if (fs.existsSync(possiblePath)) {
      envPath = possiblePath;
      break;
    }
  }
}

require('dotenv').config({ path: envPath });

// Default configuration values
const defaultConfig = {
  path_rclone: '/usr/local/bin/rclone',
  workspace_dir: '/tmp/pf-workspace',
  scripts_path: path.join(process.cwd(), 'scripts')
};

// Load configuration from environment variables
const envConfig = {
  path_rclone: process.env.RCLONE_PATH,
  workspace_dir: process.env.WORKSPACE_DIR,
  scripts_path: process.env.SCRIPTS_PATH
};

// Merge default and environment configurations
let config = {
  ...defaultConfig,
  ...Object.fromEntries(
    Object.entries(envConfig).filter(([_, value]) => value !== undefined)
  )
};

// Determine platform-specific default workspace directory if not set
if (!envConfig.workspace_dir) {
  if (process.platform === 'win32') {
    config.path_rclone = 'rclone.exe'; // Assume it's in PATH on Windows
    config.workspace_dir = path.join(os.homedir(), 'AppData', 'Roaming', 'pf-config');
  } else if (process.platform === 'darwin') {
    config.workspace_dir = path.join(os.homedir(), '.config', 'pf-config');
  }
  
  // Log the workspace directory for debugging
  console.log(`Using default workspace directory: ${config.workspace_dir}`);
} else {
  console.log(`Using workspace directory from environment: ${config.workspace_dir}`);
}

// In production mode, ensure the workspace directory exists
if (isProduction) {
  try {
    fs.ensureDirSync(config.workspace_dir);
    console.log(`Ensured workspace directory exists: ${config.workspace_dir}`);
  } catch (error) {
    console.error(`Error ensuring workspace directory exists: ${error.message}`);
  }
}

// Configuration path
config.configPath = path.join(config.workspace_dir, 'app-config.json');

/**
 * Updates the configuration and saves it to both the app-config.json file and .env file
 * @param {Object} newConfig - New configuration values to merge with existing config
 * @returns {Object} Updated configuration
 */
function updateConfig(newConfig) {
  const fs = require('fs-extra');
  
  // Update config object
  config = { ...config, ...newConfig };
  
  try {
    // Ensure workspace directory exists
    fs.ensureDirSync(config.workspace_dir);
    
    // Save to JSON config file
    fs.writeJsonSync(config.configPath, config, { spaces: 2 });
    
    // Update .env file
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '# PageFinder Configuration Environment Variables\n';
    envContent += `RCLONE_PATH=${config.path_rclone}\n`;
    envContent += `WORKSPACE_DIR=${config.workspace_dir}\n`;
    envContent += `SCRIPTS_PATH=${config.scripts_path}\n`;
    
    fs.writeFileSync(envPath, envContent);
    
    // Update process.env with new values
    process.env.RCLONE_PATH = config.path_rclone;
    process.env.WORKSPACE_DIR = config.workspace_dir;
    process.env.SCRIPTS_PATH = config.scripts_path;
  } catch (error) {
    console.error('Error saving configuration:', error);
  }
  
  return config;
}

/**
 * Loads configuration from app-config.json if it exists
 * @returns {Object} Loaded configuration
 */
function loadConfig() {
  const fs = require('fs-extra');
  
  try {
    // Ensure workspace directory exists
    fs.ensureDirSync(config.workspace_dir);
    
    // Load configuration if it exists
    if (fs.existsSync(config.configPath)) {
      const savedConfig = fs.readJsonSync(config.configPath);
      config = { ...config, ...savedConfig };
      
      // Update process.env with loaded values
      process.env.RCLONE_PATH = config.path_rclone;
      process.env.WORKSPACE_DIR = config.workspace_dir;
      if (config.scripts_path) {
        process.env.SCRIPTS_PATH = config.scripts_path;
      }
    }
  } catch (error) {
    console.error('Error loading configuration:', error);
  }
  
  return config;
}

// Export configuration and functions
module.exports = {
  config,
  updateConfig,
  loadConfig
};