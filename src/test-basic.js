/**
 * Ultra-minimal Electron application test
 * This file has NO dependencies on any of our custom code
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');

// Global reference to prevent garbage collection
let mainWindow;

// Function to create a window
function createWindow() {
  console.log('Creating window...');
  
  // Create a simple window
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false, // No Node integration for safety
      contextIsolation: true  // Context isolation for safety
    }
  });
  
  console.log('Loading test-basic.html');
  // Load the HTML file
  mainWindow.loadFile(path.join(__dirname, 'test-basic.html'));
  
  // Open DevTools for debugging
  mainWindow.webContents.openDevTools();
  
  // Handle window closed event
  mainWindow.on('closed', () => {
    console.log('Window closed');
    mainWindow = null;
  });
  
  console.log('Window created successfully');
}

// App ready event
app.on('ready', () => {
  console.log('App ready, creating window');
  createWindow();
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  console.log('All windows closed');
  app.quit();
});

// Log any errors
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION:', error);
});