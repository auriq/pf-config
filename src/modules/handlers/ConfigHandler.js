/**
 * Config Handler Module
 * Handles configuration-related IPC events
 */

const { ipcMain, shell, dialog } = require("electron");
const { exec } = require("child_process");
const path = require("path");
const fs = require('fs-extra');

/**
 * Class to handle configuration-related IPC events
 */
class ConfigHandler {
  /**
   * Initialize the handler
   * @param {Object} app - The main CloudConfigApp instance
   * @param {Object} configManager - The ConfigManager instance
   */
  constructor(app, configManager) {
    this.app = app;
    this.configManager = configManager;
    this.setupEventHandlers();
  }

  /**
   * Set up all configuration-related event handlers
   */
  setupEventHandlers() {
    // Handle get rclone path
    ipcMain.handle('get-rclone-path', () => {
      const settings = this.configManager.getSettings();
      return settings.rclonePath || '';
    });

    // Handle validate rclone path
    ipcMain.handle('validate-rclone-path', async (event, rclonePath) => {
      const isValid = await this.configManager.validateRclonePath(rclonePath);
      if (isValid) {
        const settings = this.configManager.getSettings();
        settings.rclonePath = rclonePath;
        this.configManager.saveSettings(settings);
      }
      return isValid;
    });
    
    // Handle browsing for PageFinder config file
    ipcMain.handle('browse-pf-config', async () => {
      const result = await dialog.showOpenDialog(this.app.mainWindow, {
        properties: ['openFile'],
        filters: [
          { name: 'Config Files', extensions: ['conf'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        title: 'Select Rclone Configuration File'
      });
      
      if (result.canceled) {
        return null;
      }
      
      return result.filePaths[0];
    });
    
    // Handle browsing for local storage folder
    ipcMain.handle('browse-local-folder', async () => {
      const result = await dialog.showOpenDialog(this.app.mainWindow, {
        properties: ['openDirectory'],
        title: 'Select Local Storage Folder'
      });
      
      if (result.canceled) {
        return null;
      }
      
      // Return the selected path directly since that's what the renderer expects
      return result.filePaths[0];
    });
    
    // Handle validating and saving PageFinder config
    ipcMain.handle('validate-pf-config', async (event, filePath) => {
      try {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
          return { success: false, message: 'File does not exist' };
        }
        
        // Read the file content
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Simple validation - check if it looks like an rclone config
        if (!content.includes('[') || !content.includes(']')) {
          return { success: false, message: 'Not a valid rclone config file' };
        }
        
        // Copy the file to the PageFinder config location
        const pfConfigPath = path.join(this.configManager.appConfigDir, 'pf.conf');
        fs.copyFileSync(filePath, pfConfigPath);
        
        return {
          success: true,
          message: 'Config file validated and saved',
          path: pfConfigPath
        };
      } catch (error) {
        console.error('Error validating PageFinder config:', error);
        return { success: false, message: `Error: ${error.message}` };
      }
    });

    // Handle remote configuration
    ipcMain.on("configure-remote", async (event, { name, provider, localPath }) => {
      try {
        event.reply("config-status", `Starting ${provider} configuration...`);
        
        const settings = this.configManager.getSettings();
        if (!settings.rclonePath) {
          event.reply("config-status", "Rclone path not configured. Please set it in the settings.");
          return;
        }

        // Special handling for local storage
        if (provider === 'local') {
          try {
            // Verify the local path exists
            if (!fs.existsSync(localPath)) {
              event.reply("config-status", `Local path "${localPath}" does not exist. Please provide a valid path.`);
              return;
            }
            
            // Create the local remote directly
            // Ensure the local path is properly formatted
            // Use rclone with '--obscure' to handle spaces and special characters in paths
            // First, create the config without the path to avoid escaping issues
            let createCommand = `"${settings.rclonePath}" config create "${name}" "${provider}" --config "${this.configManager.configPath}"`;
            console.log('Creating local remote without path:', createCommand);
            await new Promise((resolve, reject) => {
              exec(createCommand, (error, stdout, stderr) => {
                if (error) {
                  event.reply("config-status", `Failed to create local storage: ${stderr || error.message}`);
                  reject(error);
                } else {
                  resolve(stdout);
                }
              });
            });
            
            // Now set the path parameter separately
            let pathCommand = `"${settings.rclonePath}" config update "${name}" path="${localPath}" --config "${this.configManager.configPath}"`;
            console.log('Setting local storage path:', pathCommand);
            await new Promise((resolve, reject) => {
              exec(pathCommand, (error, stdout, stderr) => {
                if (error) {
                  event.reply("config-status", `Failed to set local storage path: ${stderr || error.message}`);
                  reject(error);
                } else {
                  event.reply("config-status", `Local storage configured successfully!`);
                  resolve(stdout);
                }
              });
            });
            
            // Set the selected local path as the subfolder metadata
            const metadata = {
              type: 'subfolder',
              subfolder: localPath
            };
            this.configManager.saveRemoteMetadata(name, metadata);
            console.log(`Set subfolder metadata for ${name} to ${localPath}`);

            // Refresh remotes list with a slight delay
            console.log('Local storage configured, refreshing remotes list...');
            setTimeout(async () => {
              try {
                const remotes = await this.configManager.listRemotes();
                const metadata = this.configManager.getAllRemotesMetadata();
                console.log('Refreshed remotes list:', remotes);
                event.reply("remotes-list", { remotes, metadata });
                
                // Update the sync.sh script with the new configuration
                this.app.updateSyncScript();
              } catch (err) {
                console.error('Error refreshing remotes list:', err);
              }
            }, 500); // 500ms delay to ensure config file is written
            return;
          } catch (error) {
            event.reply("config-status", `Local storage configuration error: ${error.message}`);
            return;
          }
        }

        // For cloud providers, launch the OAuth flow
        const rclonePath = settings.rclonePath;
        
        // Build the command to run the OAuth flow
        const command = `"${rclonePath}" config create "${name}" "${provider}" --config "${this.configManager.configPath}"`;
        console.log(`Starting OAuth flow with command: ${command}`);
        
        event.reply("config-status", `Starting ${provider} configuration... This will open a browser window. Please follow the instructions to authorize access.`);
        
        // Execute the command
        const child = exec(command, { maxBuffer: 10 * 1024 * 1024 });
        
        // Handle the output
        let output = '';
        let errorOutput = '';
        
        child.stdout.on('data', (data) => {
          output += data;
          
          // Log any URLs that appear in the output (OAuth authorization URLs)
          const urlMatch = data.toString().match(/(https?:\/\/[^\s]+)/);
          if (urlMatch) {
            const url = urlMatch[1];
            console.log(`OAuth URL detected: ${url}`);
            event.reply("config-status", `Please open the following URL in your browser if it doesn't open automatically: ${url}`);
          }
          
          // Send progress updates to the renderer
          event.reply("config-status", `${data}`);
        });
        
        child.stderr.on('data', (data) => {
          errorOutput += data;
          // Don't log errors to avoid printing sensitive information
          event.reply("config-status", `${data}`);
        });
        
        // Handle process completion
        child.on('close', async (code) => {
          if (code !== 0) {
            event.reply("config-status", `Configuration process exited with code ${code}. Error: ${errorOutput}`);
            return;
          }
          
          // Configuration successful
          event.reply("config-status", `${provider} configured successfully!`);
          
          // Refresh the remotes list
          try {
            const remotes = await this.configManager.listRemotes();
            const metadata = this.configManager.getAllRemotesMetadata();
            event.reply("remotes-list", { remotes, metadata });
            
            // Update the sync.sh script with the new configuration
            this.app.updateSyncScript();
          } catch (err) {
            console.error('Error refreshing remotes list:', err);
          }
        });
      } catch (error) {
        event.reply("config-status", `Configuration error: ${error}`);
      }
    });

    // Handle subfolder setting
    ipcMain.on("set-subfolder", async (event, { remoteName, subfolder }) => {
      try {
        console.log(`Setting subfolder for ${remoteName}: ${subfolder}`);
        
        // Save the metadata
        const metadata = {
          type: 'subfolder',
          subfolder: subfolder
        };
        
        this.configManager.saveRemoteMetadata(remoteName, metadata);
        
        event.reply("subfolder-status", {
          success: true,
          message: subfolder
            ? `Subfolder restriction set to ${subfolder} for ${remoteName}`
            : `Subfolder restriction removed for ${remoteName}`,
          remoteName: remoteName
        });
        
      } catch (error) {
        console.error("Error setting subfolder:", error);
        event.reply("subfolder-status", {
          success: false,
          message: `Failed to set subfolder: ${error.message}`,
          remoteName: remoteName
        });
      }
    });
  }
}

module.exports = ConfigHandler;