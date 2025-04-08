/**
 * Sync Handler Module
 * 
 * This module provides functions for syncing between cloud storage and PageFinder.
 * It replaces the shell script approach with direct JavaScript functions.
 */

const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const env = require('../config/environment');
const terminal = require('./terminal-output');

/**
 * Perform a test sync operation (dry run)
 * 
 * @param {Object} options - Options for the sync operation
 * @param {string} options.rclonePath - Path to the rclone executable
 * @param {string} options.combinedConfigPath - Path to the combined rclone config file
 * @param {Array<string>} options.cloudRemotes - Array of cloud remote names
 * @param {string} options.pfRemoteName - PageFinder remote name
 * @param {string} options.bucketName - Bucket name
 * @param {Object} options.remoteMetadata - Metadata for remotes, including subfolder restrictions
 * @returns {Promise<Object>} - Result of the sync operation
 */
async function testSync(options) {
  const { rclonePath, combinedConfigPath, cloudRemotes: rawCloudRemotes, pfRemoteName, bucketName, execute = false, remoteMetadata = {} } = options;
  
  // Ensure cloudRemotes is an array of strings (remote names)
  let cloudRemotes = [];
  if (Array.isArray(rawCloudRemotes)) {
    cloudRemotes = rawCloudRemotes;
  } else if (rawCloudRemotes && typeof rawCloudRemotes === 'object' && rawCloudRemotes.remotes) {
    // Handle case where cloudRemotes is the direct result of configManager.listRemotes()
    cloudRemotes = rawCloudRemotes.remotes;
  } else if (rawCloudRemotes && typeof rawCloudRemotes === 'object') {
    // Handle case where cloudRemotes might be an object with remote names as keys
    cloudRemotes = Object.keys(rawCloudRemotes);
  }
  
  // Use consistent messaging, only difference should be dry-run flag
  terminal.log(`Running sync${execute ? '' : ' (dry-run)'}...`);
  let syncOutput = '';
  
  // Function to append to syncOutput
  const appendToOutput = (message) => {
    syncOutput += `\n${message}`;
    terminal.log(message);
  };
  let success = true;
  
  // Create a temporary JSON config for the sync operation
  const tmpConfigPath = path.join(env.USER_DATA_DIR, 'pf-config-sync-test.json');
  
  try {
    // Write config to temp file
    fs.writeFileSync(tmpConfigPath, JSON.stringify(options, null, 2));
    
    // Check for orphan folders in the destination
    {
      // Add a clear header for orphan folder checking
      // Use consistent messaging for orphan folder checking
      appendToOutput('=== CHECKING FOR ORPHAN FOLDERS ===');
      appendToOutput(`Checking for orphan folders in destination${execute ? '' : ' (dry-run)'}...`);
      
      // Format the destination path (base path without remote name)
      const destPath = `${pfRemoteName}:${bucketName}/user/${pfRemoteName}`;
      
      // Build the command to list folders in the destination
      const lsdCmd = `"${rclonePath}" lsd "${destPath}" --max-depth 1 --config "${combinedConfigPath}"`;
      appendToOutput(`Executing command: ${lsdCmd}`);
      
      try {
        // Execute the command to list folders in the destination
        const { stdout } = await new Promise((resolve, reject) => {
          exec(lsdCmd, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
              terminal.error(`Error listing folders: ${error.message}`);
              reject(error);
              return;
            }
            resolve({ stdout, stderr });
          });
        });
        
        // Parse the output to get the list of folders
        const folders = [];
        const lines = stdout.split('\n');
        
        // Log the raw output for debugging
        appendToOutput(`Raw output from rclone lsd command:\n${stdout}`);
        
        for (const line of lines) {
          if (line.trim()) {
            // Extract the folder name (last token)
            const parts = line.trim().split(/\s+/);
            appendToOutput(`Parsed line: ${line.trim()} into parts: ${JSON.stringify(parts)}`);
            
            if (parts.length > 0) {
              const folder = parts[parts.length - 1];
              folders.push(folder);
              appendToOutput(`Found folder in destination: ${folder}`);
            } else {
              appendToOutput(`Warning: Could not parse folder name from line: ${line.trim()}`);
            }
          }
        }
        
        appendToOutput(`Found ${folders.length} folders in destination: ${folders.join(', ')}`);
        appendToOutput(`Cloud remotes for comparison: ${cloudRemotes.join(', ')}`);
        
        // If no folders were found, log a warning
        if (folders.length === 0) {
          appendToOutput('Warning: No folders found in destination. Skipping orphan folder check.');
        }
        
        // Check each folder to see if it exists in the remotes list
        for (const folder of folders) {
          // Normalize folder name for comparison (remove any trailing slashes)
          const normalizedFolder = folder.replace(/\/$/, '');
          
          appendToOutput(`Checking if folder "${normalizedFolder}" exists in remotes list: ${cloudRemotes.join(', ')}`);
          
          // Check if the folder is in the cloud remotes list
          // An orphan folder is one that exists in the destination but not in the source
          
          // Debug the comparison
          appendToOutput(`Checking folder "${normalizedFolder}" against cloud remotes: ${JSON.stringify(cloudRemotes)}`);
          
          // Check if the folder exists in the cloud remotes list
          const matchingRemote = cloudRemotes.find(remote =>
            remote.toLowerCase() === normalizedFolder.toLowerCase()
          );
          
          const isInRemotes = !!matchingRemote;
          
          // Log the result
          appendToOutput(`Folder "${normalizedFolder}" ${isInRemotes ? 'exists' : 'does not exist'} in remotes list`);
          
          appendToOutput(`Is "${normalizedFolder}" in remotes list? ${isInRemotes}`);
          
          if (!isInRemotes) {
            appendToOutput(`Folder "${normalizedFolder}" does not exist in remotes list, deleting...`);
            
            // Format the delete path
            const deletePath = `${destPath}/${normalizedFolder}`;
            
            // Build the command to purge the folder
            let purgeCmd;
            // Use consistent messaging for purging
            appendToOutput(`=== PURGING ORPHAN FOLDER: ${normalizedFolder}${execute ? '' : ' (dry-run)'} ===`);
            purgeCmd = `"${rclonePath}" purge "${deletePath}"${execute ? '' : ' --dry-run'} --config "${combinedConfigPath}"`;
            appendToOutput(`Executing purge command: ${purgeCmd}`);
            
            // Execute the purge command
            try {
              await new Promise((resolve, reject) => {
                exec(purgeCmd, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
                  if (error) {
                    terminal.error(`Error purging folder ${folder}: ${error.message}`);
                    reject(error);
                    return;
                  }
                  
                  // Use consistent messaging for purge results
                  appendToOutput(`=== PURGE SUCCESSFUL: Folder ${normalizedFolder}${execute ? ' deleted' : ' would be deleted (dry-run)'} ===`);
                  resolve({ stdout, stderr });
                });
              });
            } catch (purgeError) {
              const errorMsg = `Failed to delete folder ${folder}: ${purgeError.message}`;
              appendToOutput(errorMsg);
              terminal.error(errorMsg);
              // Continue with the next folder even if this one fails
            }
          }
        }
      } catch (error) {
        const errorMsg = `Error checking for orphan folders: ${error.message}`;
        appendToOutput(errorMsg);
        terminal.error(errorMsg);
        // Continue with the sync operation even if checking for orphan folders fails
      }
    }
    
    // For each remote, perform a sync operation
    // Filter out 'remotes' to prevent errors with non-existent config sections
    for (const remoteName of cloudRemotes.filter(name => name !== 'remotes')) {
      terminal.log(`Testing sync for remote: ${remoteName}`);
      
      // Check if this remote has subfolder restrictions
      let subfolder = '';
      if (remoteMetadata && remoteMetadata[remoteName] && remoteMetadata[remoteName].type === 'subfolder') {
        subfolder = remoteMetadata[remoteName].subfolder || '';
        terminal.log(`Using subfolder restriction for ${remoteName}: ${subfolder}`);
      }
      
      // Format the source and destination paths
      // If subfolder is specified, append it to the source path
      // Handle case where subfolder already starts with a slash
      const sourcePath = subfolder
        ? `${remoteName}:${subfolder.startsWith('/') ? '' : '/'}${subfolder}`
        : `${remoteName}:`;
      const destPath = `${pfRemoteName}:${bucketName}/user/${pfRemoteName}/${remoteName}`;
      
      // Build the command
      let syncCmd;
      // Use consistent command construction and messaging
      syncCmd = `"${rclonePath}" sync "${sourcePath}" "${destPath}"${execute ? '' : ' --dry-run'} --config "${combinedConfigPath}"`;
      terminal.log(`Executing sync${execute ? '' : ' test'} command: ${syncCmd}`);
      
      // Execute the sync command
      try {
        const { stdout, stderr } = await new Promise((resolve, reject) => {
          exec(syncCmd, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
              terminal.error(`Sync test error: ${error.message}`);
              success = false;
              // Still return the output even if there's an error
              resolve({ stdout: `Error: ${error.message}\n\nOutput:\n${stdout}\n\nErrors:\n${stderr}`, stderr });
            } else {
              resolve({ stdout, stderr });
            }
          });
        });
        
        // Append the output for this remote
        syncOutput += `\n--- Sync test for ${remoteName} ---\n${stdout}`;
        terminal.log(`Sync test output for ${remoteName}: ${stdout}`);
      } catch (syncError) {
        terminal.error(`Error syncing remote ${remoteName}:`, syncError.message);
        syncOutput += `\n--- Error syncing ${remoteName} ---\n${syncError.message}`;
        success = false;
      }
    }
    
    // Clean up temp files
    try {
      fs.unlinkSync(tmpConfigPath);
    } catch (cleanupError) {
      terminal.error('Error cleaning up temp file:', cleanupError.message);
    }
    
    return {
      success: success && !syncOutput.includes('Error:'),
      message: success
        ? `Sync${execute ? '' : ' test'} completed successfully`
        : `Sync${execute ? '' : ' test'} encountered issues`,
      syncOutput
    };
  } catch (error) {
    terminal.error('Error testing connections:', error.message);
    
    // Clean up temp files
    try {
      if (fs.existsSync(tmpConfigPath)) {
        fs.unlinkSync(tmpConfigPath);
      }
    } catch (cleanupError) {
      terminal.error('Error cleaning up temp file:', cleanupError.message);
    }
    
    return {
      success: false,
      message: `Sync${execute ? '' : ' test'} failed: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Alias for testSync with execute=true for backward compatibility
 *
 * @param {Object} options - Options for the sync operation
 * @returns {Promise<Object>} - Result of the sync operation
 */
async function executeSync(options) {
  // Add execute flag to options
  return testSync({
    ...options,
    execute: true
  });
}

module.exports = {
  testSync,
  executeSync
};