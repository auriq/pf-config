/**
 * Configuration module for PageFinder Configuration Utility
 * Loads environment variables from .env file and provides a centralized configuration object
 */

const path = require('path');
const os = require('os');
require('dotenv').config();

// Default configuration values
const defaultConfig = {
  path_rclone: '/usr/local/bin/rclone',
  workspace_dir: '/tmp/pf-workspace'
};

// Load configuration from environment variables
const envConfig = {
  path_rclone: process.env.RCLONE_PATH,
  workspace_dir: process.env.WORKSPACE_DIR
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
    
    fs.writeFileSync(envPath, envContent);
    
    // Update process.env with new values
    process.env.RCLONE_PATH = config.path_rclone;
    process.env.WORKSPACE_DIR = config.workspace_dir;
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