#!/usr/bin/env node

/**
 * Test Window Movable
 *
 * This script tests that the application window is movable.
 */

// Handle Squirrel events for Windows installer
if (process.platform === 'win32') {
  try {
    // If we can't find electron-squirrel-startup, just continue
    // This is a workaround for the error
    require('electron-squirrel-startup');
  } catch (e) {
    console.log('electron-squirrel-startup not found, continuing...');
  }
}

const { app, BrowserWindow } = require('electron');
const path = require('path');

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

const createWindow = () => {
  // Create the browser window with movable: true
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: "Test Window Movable",
    movable: true,
    frame: true,
    resizable: true
  });

  // Load a simple HTML file
  mainWindow.loadFile(path.join(__dirname, '..', 'src', 'test-basic.html'));
  
  // Open the DevTools for debugging
  // mainWindow.webContents.openDevTools();
  
  console.log('Window created with movable: true');
  
  // Log window position when it changes
  mainWindow.on('move', () => {
    const position = mainWindow.getPosition();
    console.log(`Window moved to position: [${position[0]}, ${position[1]}]`);
  });
};

// Create window when Electron has finished initialization
app.on('ready', () => {
  console.log('App is ready, creating window...');
  createWindow();
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

console.log('Test window movable script started');