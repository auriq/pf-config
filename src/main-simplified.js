/**
 * PageFinder Configuration Application
 * Simplified main entry point
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs-extra');
const path = require('path');

// Set up logging
const env = require('./config/environment');
const logFilePath = path.join(env.PATHS.logs, 'app-debug.log');
fs.ensureDirSync(env.PATHS.logs);
fs.writeFileSync(logFilePath, `Debug log started at ${new Date().toISOString()}\n\n`);

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  console.log(message);
  fs.appendFileSync(logFilePath, logMessage);
}

// Global reference to the window object
let mainWindow = null;

/**
 * Create the browser window
 */
function createWindow() {
  log('Creating main window');
  
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
  log(`Loading HTML from: ${indexPath}`);
  log(`File exists: ${fs.existsSync(indexPath)}`);
  
  mainWindow.loadFile(indexPath);
  
  // When content has loaded, show the window
  mainWindow.once('ready-to-show', () => {
    log('Window content loaded, showing window');
    mainWindow.show();
  });
  
  // Handle window closure
  mainWindow.on('closed', () => {
    log('Main window closed');
    mainWindow = null;
  });
  
  // Log any load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    log(`Failed to load: ${errorDescription} (${errorCode})`);
  });

  return mainWindow;
}

// Set up minimal IPC handlers
function setupIPC() {
  // Handle app close
  ipcMain.on("close-app", () => {
    log('Received close-app request, quitting application');
    app.quit();
  });

  // Simplified list-remotes handler (for testing)
  ipcMain.on("list-remotes", (event) => {
    log('Received list-remotes request');
    // Send an empty remotes list to unblock UI
    event.reply("remotes-list", { remotes: [], metadata: {} });
  });
}

// When Electron is ready, start the app
app.on('ready', () => {
  log('Electron ready event fired');
  mainWindow = createWindow();
  setupIPC();
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  log('All windows closed, quitting app');
  app.quit();
});

// On macOS, re-create window when dock icon is clicked
app.on('activate', () => {
  log('App activated');
  if (mainWindow === null) {
    createWindow();
  }
});

// Capture uncaught exceptions
process.on('uncaughtException', (err) => {
  log(`Uncaught Exception: ${err.message}`);
  log(err.stack);
});