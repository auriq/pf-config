const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Disable GPU acceleration for this test app
app.disableHardwareAcceleration();

// Run the print-paths script when the app is ready
app.whenReady().then(() => {
  console.log('App is ready, running print-paths.js');
  require('./print-paths.js');
});