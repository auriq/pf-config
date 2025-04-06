/**
 * Script to run the simplified version of the app
 */
const { spawn } = require('child_process');
const path = require('path');
const electron = require('electron');

// Path to the simplified main file
const simplifiedMainPath = path.join(__dirname, '..', 'src', 'main-simplified.js');

console.log('Starting simplified app...');
console.log(`Using electron at: ${electron}`);
console.log(`Running file: ${simplifiedMainPath}`);

// Spawn electron with the simplified main file
const electronProcess = spawn(electron, [simplifiedMainPath], {
  stdio: 'inherit' // Inherit stdio to see output in console
});

electronProcess.on('close', (code) => {
  console.log(`Electron process exited with code ${code}`);
});