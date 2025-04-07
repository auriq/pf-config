#!/usr/bin/env node

/**
 * Test Purge Orphan Folders
 *
 * This script tests the orphan folder purging functionality in sync-handler.js
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
// Import the sync-handler module
const syncHandler = require('../src/modules/sync-handler');


// Test configuration
const testConfig = {
  rclonePath: '/usr/local/bin/rclone',
  combinedConfigPath: path.join('/tmp/pf-config-temp', 'rclone.conf'),
  cloudRemotes: ['gg'], // Only include 'gg' to make any other folder an orphan
  pfRemoteName: 'pf-user-2',
  bucketName: 'asi-essentia-ai-new'
};

// Function to create a test orphan folder
async function createTestOrphanFolder() {
  try {
    const orphanFolderName = 'test-orphan-folder';
    const destPath = `${testConfig.pfRemoteName}:${testConfig.bucketName}/user/${testConfig.pfRemoteName}/${orphanFolderName}`;
    
    console.log(`Creating test orphan folder: ${destPath}`);
    
    // Create a temporary file
    const tempFilePath = path.join(os.tmpdir(), 'test-orphan-file.txt');
    fs.writeFileSync(tempFilePath, 'This is a test file for the orphan folder test.');
    
    // Use rclone to copy the file to the destination
    const copyCmd = `"${testConfig.rclonePath}" copy "${tempFilePath}" "${destPath}" --config "${testConfig.combinedConfigPath}"`;
    await executeCommand(copyCmd);
    
    // Clean up the temporary file
    fs.unlinkSync(tempFilePath);
    
    console.log(`Test orphan folder created successfully: ${destPath}`);
    return true;
  } catch (error) {
    console.error(`Error creating test orphan folder: ${error.message}`);
    return false;
  }
}

// Function to execute a command and return the output
async function executeCommand(command) {
  return new Promise((resolve, reject) => {
    console.log(`Executing command: ${command}`);
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing command: ${error.message}`);
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

// Main test function
async function runTest() {
  try {
    console.log('Starting test for purgeOrphanFolders function...');
    
    // Check if the combined config file exists
    if (!fs.existsSync(testConfig.combinedConfigPath)) {
      console.error(`Config file not found at: ${testConfig.combinedConfigPath}`);
      console.log('Creating a temporary config file for testing...');
      
      // Create a temporary config file
      fs.writeFileSync(testConfig.combinedConfigPath, `
[${testConfig.pfRemoteName}]
type = local
nounc = true
`);
    }
    
    // List folders in the destination before purging
    const destPath = `${testConfig.pfRemoteName}:${testConfig.bucketName}/user/${testConfig.pfRemoteName}`;
    console.log(`Listing folders in destination: ${destPath}`);
    
    try {
      const lsdCmd = `"${testConfig.rclonePath}" lsd "${destPath}" --max-depth 1 --config "${testConfig.combinedConfigPath}"`;
      const lsdOutput = await executeCommand(lsdCmd);
      console.log('Folders in destination before purging:');
      console.log(lsdOutput);
    } catch (lsdError) {
      console.error(`Error listing folders: ${lsdError.message}`);
    }
    
    // Call the testSync function with execute=true to purge orphan folders
    console.log('Calling testSync function to purge orphan folders...');
    await syncHandler.testSync({
      rclonePath: testConfig.rclonePath,
      combinedConfigPath: testConfig.combinedConfigPath,
      cloudRemotes: testConfig.cloudRemotes,
      pfRemoteName: testConfig.pfRemoteName,
      bucketName: testConfig.bucketName,
      execute: true
    });
    
    // List folders in the destination after purging
    console.log(`Listing folders in destination after purging: ${destPath}`);
    
    try {
      const lsdCmd = `"${testConfig.rclonePath}" lsd "${destPath}" --max-depth 1 --config "${testConfig.combinedConfigPath}"`;
      const lsdOutput = await executeCommand(lsdCmd);
      console.log('Folders in destination after purging:');
      console.log(lsdOutput);
    } catch (lsdError) {
      console.error(`Error listing folders: ${lsdError.message}`);
    }
    
    console.log('Test completed!');
  } catch (error) {
    console.error(`Test failed: ${error.message}`);
  }
}

// Run the test
runTest();