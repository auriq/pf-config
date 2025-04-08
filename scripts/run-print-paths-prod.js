const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Set NODE_ENV to production
process.env.NODE_ENV = 'production';

// Disable GPU acceleration for this test app
app.disableHardwareAcceleration();

// Run the print-paths script when the app is ready
app.whenReady().then(() => {
  console.log('App is ready, running print-paths.js in PRODUCTION mode');
  require('./print-paths.js');
});