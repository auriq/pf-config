/**
 * Minimal PageFinder Configuration Application
 * Simplified version for troubleshooting UI issues
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs-extra');

// Set up logging to file
const env = require('./config/environment');
const logFilePath = path.join(env.PATHS.logs, 'app-debug.log');
fs.ensureDirSync(env.PATHS.logs);
fs.writeFileSync(logFilePath, `Debug log started at ${new Date().toISOString()}\n\n`);

/**
 * Log a message to both console and file
 */
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  console.log(message);
  fs.appendFileSync(logFilePath, logMessage);
}

// Global reference to prevent garbage collection
let mainWindow;

/**
 * Create a basic browser window
 */
function createWindow() {
  log('Creating window...');
  
  // Create a minimal window
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  // Log app paths for debugging
  log(`__dirname: ${__dirname}`);
  log(`App path: ${app.getAppPath()}`);
  log(`App base directory: ${env.PATHS.appBase}`);
  
  // Check if index.html exists
  const indexPath = path.join(__dirname, 'index.html');
  log(`Index path: ${indexPath}`);
  log(`Index exists: ${fs.existsSync(indexPath)}`);
  
  // Load a simple HTML string instead of a file to verify window works
  mainWindow.loadURL(`data:text/html;charset=utf-8,
    <html>
      <head>
        <title>Minimal Test</title>
        <style>
          body { background: #2980b9; color: white; font-family: sans-serif; padding: 2em; text-align: center; }
          h1 { font-size: 2em; }
          .info { background: white; color: #333; padding: 1em; border-radius: 4px; margin-top: 2em; }
        </style>
      </head>
      <body>
        <h1>PageFinder Minimal Test</h1>
        <p>If you can see this, the window is working!</p>
        <div class="info">
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <p><strong>Platform:</strong> ${process.platform}</p>
        </div>
      </body>
    </html>
  `);
  
  // Open DevTools for debugging
  mainWindow.webContents.openDevTools();
  
  // Log when the window is ready to show
  mainWindow.webContents.on('did-finish-load', () => {
    log('Window content loaded successfully');
  });
  
  // Log errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    log(`Failed to load: ${errorDescription} (${errorCode})`);
  });
  
  mainWindow.on('closed', () => {
    log('Window closed');
    mainWindow = null;
  });
  
  log('Window creation complete');
}

// App ready event
app.on('ready', () => {
  log('App ready event fired');
  createWindow();
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  log('All windows closed');
  app.quit();
});

// Catch errors
process.on('uncaughtException', (error) => {
  log(`UNCAUGHT EXCEPTION: ${error.message}`);
  log(error.stack);
});