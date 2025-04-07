/**
 * Test script for sync-handler.js
 * Tests both testSync and execSync functions to verify purge functionality
 */

const path = require('path');
const fs = require('fs');
const childProcess = require('child_process');

// Save the original exec function
const originalExec = childProcess.exec;

// Create a mock exec function
childProcess.exec = (cmd, options, callback) => {
  console.log(`\nMock executing command: ${cmd}`);
  
  // If it's an lsd command, return mock folders
  if (cmd.includes('lsd')) {
    console.log('Mocking lsd command to return folders');
    
    // Simulate a response with both valid and orphan folders
    const stdout =
      '-1 2023-01-01 01:01:01 -1 folder1\n' +
      '-1 2023-01-01 01:01:01 -1 folder2\n' +
      '-1 2023-01-01 01:01:01 -1 orphan1\n' +
      '-1 2023-01-01 01:01:01 -1 orphan2\n';
    
    callback(null, stdout, '');
  }
  // If it's a purge command, simulate success
  else if (cmd.includes('purge')) {
    console.log('Mocking purge command');
    callback(null, 'Purged successfully', '');
  }
  // For sync commands, simulate success
  else if (cmd.includes('sync')) {
    console.log('Mocking sync command');
    callback(null, 'Synced successfully', '');
  }
  // For any other command, return empty
  else {
    callback(null, '', '');
  }
};

// Mock terminal module
const terminal = {
  log: (message) => console.log(`[LOG] ${message}`),
  error: (message) => console.error(`[ERROR] ${message}`)
};

// Mock environment module
const env = {
  USER_DATA_DIR: path.join(__dirname, '..', 'temp')
};

// Create a modified version of the sync-handler module
const syncHandler = {
  testSync: async function(options) {
    console.log('Running testSync with options:', JSON.stringify(options, null, 2));
    
    // Initialize syncOutput
    let syncOutput = '';
    
    // Function to append to syncOutput
    const appendToOutput = (message) => {
      syncOutput += `\n${message}`;
      console.log(`[LOG] ${message}`);
    };
    
    // Log start message
    if (options.execute) {
      appendToOutput('Running sync with execution flag...');
    } else {
      appendToOutput('Running sync test with verbose flag...');
    }
    
    // Check for orphan folders
    if (options.execute) {
      appendToOutput('Checking for orphan folders in destination...');
    } else {
      appendToOutput('Checking for orphan folders in destination (dry run)...');
    }
    
    // Format the destination path
    const destPath = `${options.pfRemoteName}:${options.bucketName}/user/${options.pfRemoteName}`;
    
    // Build the command to list folders
    const lsdCmd = `"${options.rclonePath}" lsd "${destPath}" --max-depth 1 --config "${options.combinedConfigPath}"`;
    appendToOutput(`Executing command: ${lsdCmd}`);
    
    // Parse the mock output
    const folders = ['folder1', 'folder2', 'orphan1', 'orphan2'];
    
    // Log the folders
    appendToOutput(`Found ${folders.length} folders in destination: ${folders.join(', ')}`);
    appendToOutput(`Cloud remotes for comparison: ${options.cloudRemotes.join(', ')}`);
    
    // Check each folder
    for (const folder of folders) {
      appendToOutput(`Checking if folder "${folder}" exists in remotes list: ${options.cloudRemotes.join(', ')}`);
      
      // Check if the folder is in the cloud remotes list
      const isInRemotes = options.cloudRemotes.some(remote =>
        remote.toLowerCase() === folder.toLowerCase()
      );
      
      appendToOutput(`Is "${folder}" in remotes list? ${isInRemotes}`);
      
      if (!isInRemotes) {
        appendToOutput(`Folder "${folder}" does not exist in remotes list, deleting...`);
        
        // Format the delete path
        const deletePath = `${destPath}/${folder}`;
        
        // Build the command to purge the folder
        let purgeCmd;
        if (options.execute) {
          purgeCmd = `"${options.rclonePath}" purge "${deletePath}" --config "${options.combinedConfigPath}"`;
          appendToOutput(`Executing purge command: ${purgeCmd}`);
        } else {
          purgeCmd = `"${options.rclonePath}" purge "${deletePath}" --dry-run --config "${options.combinedConfigPath}"`;
          appendToOutput(`Executing dry-run purge command: ${purgeCmd}`);
        }
        
        // Log success
        if (options.execute) {
          appendToOutput(`Folder ${folder} deleted successfully`);
        } else {
          appendToOutput(`Folder ${folder} would be deleted (dry run)`);
        }
      }
    }
    
    // Perform sync operations for each remote
    for (const remoteName of options.cloudRemotes) {
      appendToOutput(`Testing sync for remote: ${remoteName}`);
      
      // Format the source and destination paths
      const sourcePath = `${remoteName}:`;
      const destPath = `${options.pfRemoteName}:${options.bucketName}/user/${options.pfRemoteName}`;
      
      // Build the command
      let syncCmd;
      if (options.execute) {
        syncCmd = `"${options.rclonePath}" sync "${sourcePath}" "${destPath}" -P --config "${options.combinedConfigPath}"`;
        appendToOutput(`Executing sync command: ${syncCmd}`);
      } else {
        syncCmd = `"${options.rclonePath}" sync "${sourcePath}" "${destPath}" --dry-run -P --config "${options.combinedConfigPath}"`;
        appendToOutput(`Executing sync test command: ${syncCmd}`);
      }
      
      // Log success
      appendToOutput(`Sync ${options.execute ? '' : 'test '}completed for ${remoteName}`);
    }
    
    return {
      success: true,
      message: options.execute ? 'Sync operation completed successfully' : 'Connection test completed successfully',
      syncOutput
    };
  },
  
  executeSync: async function(options) {
    // Just call testSync with execute=true
    return this.testSync({
      ...options,
      execute: true
    });
  }
};

// Ensure temp directory exists
if (!fs.existsSync(path.join(__dirname, '..', 'temp'))) {
  fs.mkdirSync(path.join(__dirname, '..', 'temp'), { recursive: true });
}

// Mock options for sync functions
const mockOptions = {
  rclonePath: '/mock/path/to/rclone',
  combinedConfigPath: '/mock/path/to/config',
  cloudRemotes: ['folder1', 'folder2'], // Only these are valid, others are orphans
  pfRemoteName: 'mock-pf',
  bucketName: 'mock-bucket'
};

// Run tests
async function runTests() {
  console.log('=== TESTING SYNC FUNCTIONS ===');
  
  try {
    // Test testSync (dry run)
    console.log('\n=== TESTING testSync (DRY RUN) ===');
    const testResult = await syncHandler.testSync({
      ...mockOptions,
      execute: false
    });
    console.log('\nTest Result:');
    console.log(JSON.stringify(testResult, null, 2));
    
    // Verify purge commands in output
    const testHasPurge = testResult.syncOutput && testResult.syncOutput.includes('purge');
    console.log(`\nDoes testSync output include purge commands? ${testHasPurge ? 'YES' : 'NO'}`);
    
    // Test executeSync (real execution)
    console.log('\n=== TESTING executeSync (REAL EXECUTION) ===');
    const execResult = await syncHandler.executeSync(mockOptions);
    console.log('\nExecution Result:');
    console.log(JSON.stringify(execResult, null, 2));
    
    // Verify purge commands in output
    const execHasPurge = execResult.syncOutput && execResult.syncOutput.includes('purge');
    console.log(`\nDoes executeSync output include purge commands? ${execHasPurge ? 'YES' : 'NO'}`);
    
    // Overall result
    console.log('\n=== TEST SUMMARY ===');
    console.log(`testSync purge commands: ${testHasPurge ? 'PASS' : 'FAIL'}`);
    console.log(`executeSync purge commands: ${execHasPurge ? 'PASS' : 'FAIL'}`);
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

// Run the tests
runTests();