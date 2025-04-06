/**
 * Script to run the minimal version of the app for testing
 */
const { spawn } = require('child_process');
const path = require('path');
const electron = require('electron');

// Path to the minimal main file
const minimalMainPath = path.join(__dirname, '..', 'src', 'minimal-main.js');

console.log('Starting minimal test app...');
console.log(`Using electron at: ${electron}`);
console.log(`Running file: ${minimalMainPath}`);

// Spawn electron with the minimal main file
const electronProcess = spawn(electron, [minimalMainPath], {
  stdio: 'inherit' // Inherit stdio to see output in console
});

electronProcess.on('close', (code) => {
  console.log(`Electron process exited with code ${code}`);
});