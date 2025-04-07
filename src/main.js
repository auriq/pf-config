/**
 * PageFinder Configuration Application
 * Main entry point
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { runPostInstall } = require('./post-install');

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

// Ensure single instance of the app
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('Another instance is already running. Quitting this instance.');
  app.quit();
} else {
  // This is the first instance - register second-instance handler
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    console.log('Second instance detected, focusing the main window');
    // Someone tried to run a second instance, we should focus our window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

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
  // If window already exists, just focus it and return
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    return mainWindow;
  }

  console.log('Creating main window');
  
  // Create the browser window with basic settings
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      // Explicitly enable remote module for packaged app
      enableRemoteModule: true
    },
    title: "PageFinder Configuration",
    show: false, // Don't show until ready
    // Add macOS specific settings
    backgroundColor: '#ffffff',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default'
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
    // On macOS, bring the application to the foreground
    if (process.platform === 'darwin') {
      app.dock.show();
      app.focus({ steal: true });
    }
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
    
    // Initialize the configuration manager first
    const configManager = new ConfigManager();
    console.log('Configuration manager initialized');
    
    // Initialize the application modules
    const CloudConfigApp = require("./modules/app");
    const cloudConfigApp = new CloudConfigApp(configManager);
    
    // Setup IPC before creating the window
    cloudConfigApp.setupIPC();
    console.log('IPC handlers set up');
    
    // Create the window after IPC is set up
    mainWindow = createWindow();
    cloudConfigApp.mainWindow = mainWindow; // Pass the window reference
    
    // Check for zombie processes on macOS
    if (process.platform === 'darwin') {
      await cloudConfigApp.checkForZombieProcesses();
    }
    
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

// Handle macOS open-url events (for custom protocol handling)
app.on('open-url', (event, url) => {
  event.preventDefault();
  console.log(`Received URL: ${url}`);
  
  // If app is already running, focus the window
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
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
  
  // macOS-specific protocol handling setup
  if (process.platform === 'darwin') {
    // Register as handler for custom protocols (if any)
    app.setAsDefaultProtocolClient('pf-config');
    
    // Run post-installation script on macOS
    try {
      // Check if post-install has already run
      const markerPath = path.join(app.getPath('userData'), '.post-install-complete');
      if (!fs.existsSync(markerPath)) {
        console.log('Running post-installation script for first launch...');
        runPostInstall();
      } else {
        console.log('Post-installation already completed.');
      }
    } catch (error) {
      console.error('Error checking/running post-install:', error);
    }
  }
  
  main().catch(error => {
    console.error('Failed to start application:', error);
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  console.log('All windows closed');
  // On macOS, it's common for applications to stay running
  // even when all windows are closed
  if (process.platform !== 'darwin') {
    console.log('Non-macOS platform, quitting app');
    app.quit();
  } else {
    console.log('macOS platform, app remains running');
  }
});

// On macOS, re-create window when dock icon is clicked
app.on('activate', () => {
  console.log('App activated');
  if (mainWindow === null) {
    createWindow();
  } else {
    // If window exists but is minimized, restore it
    if (mainWindow.isMinimized()) mainWindow.restore();
    // Focus the window to bring it to the front
    mainWindow.focus();
  }
});

// Export functions for testing
module.exports = {
  createWindow,
  main
};