#!/usr/bin/env node

/**
 * Script to check for folders in the destination that don't exist in the remotes list
 * and delete them (with --dry-run option by default)
 *
 * Usage:
 *   node check-and-delete.js [--execute]
 *
 * Options:
 *   --execute  Actually delete the folders (without --dry-run)
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

const execPromise = util.promisify(exec);

// Configuration
const CONFIG_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'pf-config');
const CLOUD_CONFIG_PATH = path.join(CONFIG_DIR, 'cloud.conf');
const PF_CONFIG_PATH = path.join(CONFIG_DIR, 'pf.conf');
const COMBINED_CONFIG_PATH = path.join(CONFIG_DIR, 'rclone.conf');

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');

// Function to log messages
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// Main function
async function main() {
  try {
    log('Starting check-and-delete script');
    log(`Mode: ${dryRun ? 'DRY RUN (no actual deletions)' : 'EXECUTE (will actually delete folders)'}`);

    // Check if config files exist
    if (!fs.existsSync(CLOUD_CONFIG_PATH)) {
      log('Error: Cloud configuration file not found');
      return;
    }

    if (!fs.existsSync(PF_CONFIG_PATH)) {
      log('Error: PageFinder configuration file not found');
      return;
    }

    // Get rclone path from settings
    const settingsPath = path.join(CONFIG_DIR, 'settings.json');
    if (!fs.existsSync(settingsPath)) {
      log('Error: Settings file not found');
      return;
    }

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const rclonePath = settings.rclonePath;

    if (!rclonePath) {
      log('Error: Rclone path not configured');
      return;
    }

    log(`Using rclone at: ${rclonePath}`);

    // Create combined config file
    const cloudConfig = fs.readFileSync(CLOUD_CONFIG_PATH, 'utf8');
    const pfConfig = fs.readFileSync(PF_CONFIG_PATH, 'utf8');
    fs.writeFileSync(COMBINED_CONFIG_PATH, cloudConfig + '\n' + pfConfig);
    log(`Created combined config file at: ${COMBINED_CONFIG_PATH}`);

    // Get list of cloud remotes
    log('Getting list of cloud remotes');
    const { stdout: remotesOutput } = await execPromise(`"${rclonePath}" --config "${CLOUD_CONFIG_PATH}" listremotes`);
    const cloudRemotes = remotesOutput.trim().split('\n').map(remote => remote.replace(':', ''));
    log(`Cloud remotes: ${cloudRemotes.join(', ')}`);

    // Extract PF remote name and bucket
    const pfConfigContent = fs.readFileSync(PF_CONFIG_PATH, 'utf8');
    const pfRemoteMatch = pfConfigContent.match(/\[([^\]]+)\]/);
    
    if (!pfRemoteMatch) {
      log('Error: No remote found in the PageFinder config file');
      return;
    }
    
    const pfRemoteName = pfRemoteMatch[1];
    log(`PageFinder remote name: ${pfRemoteName}`);

    // Extract bucket name
    let bucketName = 'asi-essentia-ai-new';
    const bucketMatch = pfConfigContent.match(/bucket\s*=\s*([^\n]+)/);
    if (bucketMatch) {
      bucketName = bucketMatch[1].trim();
    }
    log(`Bucket name: ${bucketName}`);

    // Construct destination path
    const destPath = `${pfRemoteName}:${bucketName}/user/${pfRemoteName}`;
    log(`Destination path: ${destPath}`);

    // List folders in destination
    log('Listing folders in destination');
    try {
      const { stdout: listOutput } = await execPromise(`"${rclonePath}" lsd "${destPath}" --config "${COMBINED_CONFIG_PATH}"`);
      log(`List command output: ${listOutput}`);

      // Parse the output to get folder names
      // The format appears to be: 0 YYYY-MM-DD HH:MM:SS -1 dirname
      const folderRegex = /\s+0\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+-1\s+(.+?)$/gm;
      let match;
      const existingFolders = [];
      
      log(`Parsing with regex: ${folderRegex}`);
      
      while ((match = folderRegex.exec(listOutput)) !== null) {
        log(`Found folder match: ${match[0]}, extracted: ${match[1]}`);
        existingFolders.push(match[1]);
      }
      
      log(`Found folders in destination: ${existingFolders.join(', ')}`);
      
      // Find folders that don't exist in the remotes list
      const foldersToDelete = existingFolders.filter(folder => !cloudRemotes.includes(folder));
      
      if (foldersToDelete.length > 0) {
        log(`Folders to delete: ${foldersToDelete.join(', ')}`);
        
        // Delete each folder
        for (const folderToDelete of foldersToDelete) {
          const deletePath = `${destPath}/${folderToDelete}`;
          const dryRunFlag = dryRun ? '--dry-run' : '';
          log(`Deleting folder: ${deletePath}${dryRun ? ' (dry run)' : ''}`);
          
          try {
            const { stdout: deleteOutput } = await execPromise(`"${rclonePath}" purge "${deletePath}" ${dryRunFlag} -v --config "${COMBINED_CONFIG_PATH}"`);
            log(`Delete command output: ${deleteOutput || 'No output'}`);
            if (!dryRun) {
              log(`Folder ${folderToDelete} has been deleted!`);
            } else {
              log(`Folder ${folderToDelete} would be deleted (dry run)`);
            }
          } catch (error) {
            log(`Error deleting folder ${folderToDelete}: ${error.message}`);
            if (error.stderr) {
              log(`Error stderr: ${error.stderr}`);
            }
          }
        }
      } else {
        log('No folders to delete');
      }
    } catch (error) {
      log(`Error listing folders in destination: ${error.message}`);
      if (error.stderr) {
        log(`Error stderr: ${error.stderr}`);
      }
    }

    log('Script completed');
  } catch (error) {
    log(`Error: ${error.message}`);
    if (error.stack) {
      log(`Stack trace: ${error.stack}`);
    }
  }
}

// Run the main function
main().catch(error => {
  log(`Unhandled error: ${error.message}`);
  if (error.stack) {
    log(`Stack trace: ${error.stack}`);
  }
});