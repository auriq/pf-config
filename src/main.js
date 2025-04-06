/**
 * PageFinder Configuration Application
 * Main entry point
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');

// Configure console logging first
let terminal;
try {
  terminal = require('./modules/terminal-output');
  terminal.configure({
    useColors: true,
    showTimestamp: true,
    logToFile: true
  });
  
  // Reset the log file at application startup
  terminal.resetLogFile();
  console.log('Terminal output module loaded successfully');
} catch (error) {
  console.error('Failed to load terminal-output module:', error.message);
}

// Log application startup
console.log('PageFinder Configuration application starting...');
console.log(`Platform: ${process.platform}, Architecture: ${process.arch}`);

// Load environment module
let env;
try {
  env = require('./config/environment');
  console.log('Environment module loaded successfully');
  
  // Ensure required directories exist
  if (env.ensureDirectories()) {
    console.log('Required directories verified');
  } else {
    console.error('Failed to verify required directories');
  }
} catch (error) {
  console.error('Failed to load environment module:', error.message);
}

// Import application modules
const ConfigManager = require("./modules/config-manager");

// Global reference to the window object
let mainWindow = null;

/**
 * Create the browser window - this function directly creates 
 * the window without depending on other modules
 */
function createWindow() {
  console.log('Creating main window');
  
  // Create the browser window with basic settings
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: "PageFinder Configuration",
    show: false // Don't show until ready
  });

  // Load the index.html file
  const indexPath = path.join(__dirname, "index.html");
  console.log(`Loading HTML from: ${indexPath}`);
  console.log(`File exists: ${fs.existsSync(indexPath)}`);
  
  mainWindow.loadFile(indexPath);
  
  // When content has loaded, show the window
  mainWindow.once('ready-to-show', () => {
    console.log('Window content loaded, showing window');
    mainWindow.show();
  });
  
  // Handle window closure
  mainWindow.on('closed', () => {
    console.log('Main window closed');
    mainWindow = null;
  });
  
  // Log any load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`Failed to load: ${errorDescription} (${errorCode})`);
  });

  // Return the window instance
  return mainWindow;
}

/**
 * Main function to initialize and start the application
 */
async function main() {
  try {
    console.log('Initializing application');
    
    // Create directories if they don't exist
    const logsDir = path.join(process.cwd(), 'logs');
    fs.ensureDirSync(logsDir);
    
    // Create the window first
    mainWindow = createWindow();
    
    // Initialize the configuration manager (don't wait for it)
    const configManager = new ConfigManager();
    console.log('Configuration manager initialized');
    
    // Initialize the application modules
    const CloudConfigApp = require("./modules/app");
    const cloudConfigApp = new CloudConfigApp(configManager);
    cloudConfigApp.mainWindow = mainWindow; // Pass the window reference
    
    // Setup IPC directly instead of calling init() to avoid duplication
    cloudConfigApp.setupIPC();
    
    console.log('Application initialization complete');
    
    return cloudConfigApp;
  } catch (error) {
    console.error('Error in main:', error);
    throw error;
  }
}

// Capture uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error(`Uncaught Exception: ${err.message}`);
  console.error(err.stack);
  
  if (app.isReady()) {
    const options = {
      type: 'error',
      title: 'Application Error',
      message: 'An unexpected error occurred.',
      detail: err.message,
      buttons: ['OK']
    };
    
    if (mainWindow) {
      const { dialog } = require('electron');
      dialog.showMessageBoxSync(mainWindow, options);
    }
  }
});

// When Electron is ready, start the app
app.on('ready', () => {
  console.log('Electron ready event fired');
  
  // Setup direct IPC close handler at the main process level
  ipcMain.on("close-app", () => {
    console.log('[MAIN] Close application request received, force quitting');
    app.exit(0); // Force immediate exit
  });
  
  main().catch(error => {
    console.error('Failed to start application:', error);
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  console.log('All windows closed, quitting app');
  app.quit();
});

// On macOS, re-create window when dock icon is clicked
app.on('activate', () => {
  console.log('App activated');
  if (mainWindow === null) {
    createWindow();
  }
});

// Export functions for testing
module.exports = {
  createWindow,
  main
};