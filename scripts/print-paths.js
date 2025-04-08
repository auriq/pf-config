const path = require('path');
const { app } = require('electron');

// Wait for app to be ready
app.whenReady().then(() => {
  console.log('=== PRODUCTION PATH VALUES ===');
  console.log(`app.getAppPath(): ${app.getAppPath()}`);
  console.log(`app.getPath('userData'): ${app.getPath('userData')}`);
  console.log(`app.getPath('logs'): ${app.getPath('logs')}`);
  console.log(`app.getPath('home'): ${app.getPath('home')}`);
  console.log(`app.getPath('temp'): ${app.getPath('temp')}`);
  console.log(`app.getPath('exe'): ${app.getPath('exe')}`);
  console.log(`process.cwd(): ${process.cwd()}`);
  console.log(`__dirname: ${__dirname}`);
  
  // Load environment module
  try {
    const env = require('../src/config/environment');
    console.log('\n=== ENVIRONMENT MODULE PATHS ===');
    console.log(`env.PATHS.appBase: ${env.PATHS.appBase}`);
    console.log(`env.PATHS.appConfig: ${env.PATHS.appConfig}`);
    console.log(`env.PATHS.logs: ${env.PATHS.logs}`);
    console.log(`env.PATHS.data: ${env.PATHS.data}`);
    console.log(`env.PATHS.scripts: ${env.PATHS.scripts}`);
    console.log(`env.USER_DATA_DIR: ${env.USER_DATA_DIR}`);
    
    // Load ConfigManager to check config paths
    const ConfigManager = require('../src/modules/config-manager');
    const configManager = new ConfigManager();
    console.log('\n=== CONFIG MANAGER PATHS ===');
    console.log(`configManager.appConfigDir: ${configManager.appConfigDir}`);
    console.log(`configManager.configPath: ${configManager.configPath}`);
    console.log(`configManager.settingsPath: ${configManager.settingsPath}`);
    console.log(`configManager.metadataPath: ${configManager.metadataPath}`);
    
    // Check if directories exist
    const fs = require('fs-extra');
    console.log('\n=== DIRECTORY EXISTENCE ===');
    console.log(`env.PATHS.appBase exists: ${fs.existsSync(env.PATHS.appBase)}`);
    console.log(`env.PATHS.appConfig exists: ${fs.existsSync(env.PATHS.appConfig)}`);
    console.log(`env.PATHS.logs exists: ${fs.existsSync(env.PATHS.logs)}`);
    
    // List files in logs directory if it exists
    if (fs.existsSync(env.PATHS.logs)) {
      console.log('\n=== FILES IN LOGS DIRECTORY ===');
      const files = fs.readdirSync(env.PATHS.logs);
      files.forEach(file => {
        console.log(`- ${file}`);
      });
    }
  } catch (error) {
    console.error('Error loading environment module:', error);
  }
  
  // Exit after printing
  setTimeout(() => {
    app.exit();
  }, 1000);
});