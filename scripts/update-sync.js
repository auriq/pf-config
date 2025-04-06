#!/usr/bin/env node

/**
 * Script to update the sync.sh script with functionality to check for folders
 * in the destination that don't exist in the remotes list and delete them
 * Updated to support both Windows and macOS/Linux
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const util = require('util');

const execPromise = util.promisify(exec);

// Parse command line arguments
const args = process.argv.slice(2);
let configFilePath = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--config' && i + 1 < args.length) {
    configFilePath = args[i + 1];
    break;
  }
}

// Configuration
// Platform-specific config directory
const CONFIG_DIR = process.platform === 'win32'
  ? path.join(process.env.USERPROFILE, 'AppData', 'Roaming', 'pf-config')
  : path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'pf-config');

// Config file paths
let CLOUD_CONFIG_PATH = path.join(CONFIG_DIR, 'cloud.conf');
let PF_CONFIG_PATH = path.join(CONFIG_DIR, 'pf.conf');
let COMBINED_CONFIG_PATH = path.join(CONFIG_DIR, 'rclone.conf');

// Platform-specific script paths
const isWindows = process.platform === 'win32';

// Get the application base path, accounting for packaged vs development environment
const getAppBasePath = () => {
  // When running from electron-packaged app
  if (process.resourcesPath) {
    return process.resourcesPath;
  }
  
  // When running during development
  return process.cwd();
};

const appBasePath = getAppBasePath();
const SYNC_SCRIPT_PATH = path.join(appBasePath, 'scripts', isWindows ? 'sync.bat' : 'sync.sh');
const SYNC_TEMPLATE_PATH = path.join(appBasePath, 'scripts', isWindows ? 'sync-template.bat' : 'sync-template.sh');

// If a config file was provided, use it
let customConfig = null;
if (configFilePath) {
  try {
    log(`Using custom config file: ${configFilePath}`);
    customConfig = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
    
    if (customConfig.combinedConfigPath) {
      COMBINED_CONFIG_PATH = customConfig.combinedConfigPath;
      log(`Using custom combined config path: ${COMBINED_CONFIG_PATH}`);
    }
  } catch (error) {
    log(`Error reading custom config file: ${error.message}`);
  }
}

// Function to log messages
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// Main function
async function main() {
  try {
    log('Starting update-sync script');

    // Check if sync.sh exists
    if (!fs.existsSync(SYNC_SCRIPT_PATH)) {
      log('Error: sync.sh script not found');
      return;
    }

    // Check if sync-template.sh exists
    if (!fs.existsSync(SYNC_TEMPLATE_PATH)) {
      log('Error: sync-template.sh script not found');
      return;
    }

    // Get settings
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

    // Get list of cloud remotes
    let cloudRemotes = [];
    let pfRemoteName = '';
    let bucketName = 'asi-essentia-ai-new';
    let foldersToDelete = [];
    
    if (customConfig && customConfig.cloudRemotes) {
      // Use cloud remotes from custom config
      cloudRemotes = customConfig.cloudRemotes;
      log(`Using cloud remotes from custom config: ${cloudRemotes.join(', ')}`);
      
      // Use PF remote name from custom config
      if (customConfig.pfRemoteName) {
        pfRemoteName = customConfig.pfRemoteName;
        log(`Using PageFinder remote name from custom config: ${pfRemoteName}`);
      }
      
      // Use bucket name from custom config
      if (customConfig.bucketName) {
        bucketName = customConfig.bucketName;
        log(`Using bucket name from custom config: ${bucketName}`);
      }
      
      // Use folders to delete from custom config
      if (customConfig.foldersToDelete) {
        foldersToDelete = customConfig.foldersToDelete;
        log(`Using folders to delete from custom config: ${foldersToDelete.join(', ')}`);
      }
    } else {
      // Get list of cloud remotes from config file
      log('Getting list of cloud remotes from config file');
      const { stdout: remotesOutput } = await execPromise(`"${rclonePath}" --config "${CLOUD_CONFIG_PATH}" listremotes`);
      cloudRemotes = remotesOutput.trim().split('\n').map(remote => remote.replace(':', ''));
      log(`Cloud remotes: ${cloudRemotes.join(', ')}`);

      // Extract PF remote name and bucket
      const pfConfigContent = fs.readFileSync(PF_CONFIG_PATH, 'utf8');
      const pfRemoteMatch = pfConfigContent.match(/\[([^\]]+)\]/);
      
      if (!pfRemoteMatch) {
        log('Error: No remote found in the PageFinder config file');
        return;
      }
      
      pfRemoteName = pfRemoteMatch[1];
      log(`PageFinder remote name: ${pfRemoteName}`);

      // Extract bucket name
      const bucketMatch = pfConfigContent.match(/bucket\s*=\s*([^\n]+)/);
      if (bucketMatch) {
        bucketName = bucketMatch[1].trim();
      }
      log(`Bucket name: ${bucketName}`);
    }

    // Read the sync.sh script
    const syncScript = fs.readFileSync(SYNC_SCRIPT_PATH, 'utf8');
    log('Read sync.sh script');

    // Read the sync-template.sh script
    const syncTemplate = fs.readFileSync(SYNC_TEMPLATE_PATH, 'utf8');
    log('Read sync-template.sh script');

    // Create a new sync script with the updated template
    let newSyncScript = syncTemplate;
    
    // Replace placeholders
    newSyncScript = newSyncScript.replace(/{{DATE}}/g, new Date().toISOString());
    newSyncScript = newSyncScript.replace(/{{RCLONE_PATH}}/g, rclonePath);
    newSyncScript = newSyncScript.replace(/{{CONFIG_PATH}}/g, COMBINED_CONFIG_PATH);
    newSyncScript = newSyncScript.replace(/{{LOG_DIR}}/g, path.join(appBasePath, 'logs'));
    newSyncScript = newSyncScript.replace(/{{PF_REMOTE_NAME}}/g, pfRemoteName);
    newSyncScript = newSyncScript.replace(/{{BUCKET_NAME}}/g, bucketName);
    newSyncScript = newSyncScript.replace(/{{CLOUD_REMOTES}}/g, cloudRemotes.join(' '));
    
    // Add folders to delete as an environment variable
    if (foldersToDelete && foldersToDelete.length > 0) {
      log(`Adding folders to delete: ${foldersToDelete.join(', ')}`);
      // Add the RCLONE_FOLDERS_TO_DELETE environment variable at the beginning of the script
      newSyncScript = newSyncScript.replace(
        '#!/bin/bash',
        `#!/bin/bash\n\n# Set folders to delete\nexport RCLONE_FOLDERS_TO_DELETE='["${foldersToDelete.join('","')}"]'`
      );
    }

    // Extract the sync commands from the existing sync.sh script
    const syncCommandsMatch = syncScript.match(/# SECTION 2: SYNC OPERATIONS\n([\s\S]*?)\n\n# Log completion/);
    if (syncCommandsMatch) {
      let syncCommands = syncCommandsMatch[1].trim();
      
      // Modify the sync commands to use DRY_RUN and VERBOSE variables
      // First, extract each sync command block
      const syncBlocks = syncCommands.split(/log "Syncing .* to PageFinder\.\.\."/g);
      let modifiedSyncCommands = '';
      
      // Process each sync block
      let currentRemote = '';
      const remoteRegex = /log "Syncing (.*?) to PageFinder\.\.\."/;
      const commandRegex = /"([^"]+)" sync "([^"]+)" "([^"]+)" (-P) --config "([^"]+)"/;
      
      // Get all the remote names from the sync commands
      const remoteMatches = syncCommands.match(/log "Syncing (.*?) to PageFinder\.\.\."/g) || [];
      
      // Process each remote and its corresponding sync command
      for (let i = 0; i < remoteMatches.length; i++) {
        const remoteMatch = remoteMatches[i].match(remoteRegex);
        if (remoteMatch) {
          currentRemote = remoteMatch[1];
          
          // Find the corresponding command block
          const commandBlock = syncCommands.split(remoteMatches[i])[1].split(/log "Syncing .* to PageFinder\.\.\."/)[0];
          const commandMatch = commandBlock.match(commandRegex);
          
          if (commandMatch) {
            const [_, rclonePath, sourcePath, destPath, progressFlag, configPath] = commandMatch;
            
            // Create the modified sync command with DRY_RUN and VERBOSE
            modifiedSyncCommands += `log "Syncing ${currentRemote} to PageFinder..."\n`;
            modifiedSyncCommands += `if [ -n "$DRY_RUN" ]; then\n`;
            modifiedSyncCommands += `    log "DRY RUN: Would sync ${sourcePath} to ${destPath}"\n`;
            modifiedSyncCommands += `    "${rclonePath}" sync "${sourcePath}" "${destPath}" --dry-run $VERBOSE --config "${configPath}" >> "\${LOG_FILE}" 2>&1\n`;
            modifiedSyncCommands += `else\n`;
            modifiedSyncCommands += `    "${rclonePath}" sync "${sourcePath}" "${destPath}" $VERBOSE --config "${configPath}" >> "\${LOG_FILE}" 2>&1\n`;
            modifiedSyncCommands += `    if [ $? -eq 0 ]; then\n`;
            modifiedSyncCommands += `        log "Sync for ${currentRemote} completed successfully"\n`;
            modifiedSyncCommands += `    else\n`;
            modifiedSyncCommands += `        log "ERROR: Sync for ${currentRemote} failed"\n`;
            modifiedSyncCommands += `    fi\n`;
            modifiedSyncCommands += `fi\n\n`;
          }
        }
      }
      
      // If we couldn't parse the commands properly, just use the original with a warning
      if (!modifiedSyncCommands) {
        log('Warning: Could not parse sync commands format, using original commands');
        newSyncScript = newSyncScript.replace('{{SYNC_COMMANDS}}', syncCommands);
      } else {
        newSyncScript = newSyncScript.replace('{{SYNC_COMMANDS}}', modifiedSyncCommands.trim());
      }
      
      log('Extracted and modified sync commands from existing sync.sh script');
    } else {
      log('Error: Could not extract sync commands from existing sync.sh script');
      return;
    }

    // Write the new sync script
    fs.writeFileSync(SYNC_SCRIPT_PATH, newSyncScript);
    log(`Updated sync script at: ${SYNC_SCRIPT_PATH}`);

    // Make the script executable (only needed for non-Windows platforms)
    if (!isWindows) {
      fs.chmodSync(SYNC_SCRIPT_PATH, '755');
      log('Made sync script executable');
    }

    log('Script completed successfully');
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