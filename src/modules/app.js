const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const { exec } = require("child_process");
const path = require("path");
const fs = require('fs-extra');
const os = require('os');

/**
 * Application main class - handles window creation and IPC events
 */
class CloudConfigApp {
  constructor(configManager) {
    this.configManager = configManager;
    this.mainWindow = null;
  }

  // Create the main application window
  createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1100,
      height: 900,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      title: "PageFinder Configuration"
    });

    this.mainWindow.loadFile(path.join(__dirname, "..", "index.html"));
    
    // List remotes after window loads
    this.mainWindow.webContents.on('did-finish-load', async () => {
      try {
        const remotes = await this.configManager.listRemotes();
        const metadata = this.configManager.getAllRemotesMetadata();
        this.mainWindow.webContents.send("remotes-list", { remotes, metadata });
      } catch (error) {
        console.error("Error listing remotes:", error);
      }
    });
    
    return this.mainWindow;
  }

  // Check for and clean up zombie rclone processes before starting
  async checkForZombieProcesses() {
    try {
      const { exec } = require('child_process');
      const platform = process.platform;
      
      // Different commands for different platforms
      let checkCommand;
      if (platform === 'win32') {
        checkCommand = 'tasklist /fi "imagename eq rclone.exe" /fo csv /v';
      } else {
        // macOS or Linux
        checkCommand = 'ps -ef | grep "rclone config" | grep -v grep';
      }
      
      // Execute the command to find rclone processes
      const zombieProcesses = await new Promise((resolve) => {
        exec(checkCommand, (error, stdout) => {
          if (error) {
            // No processes found or command failed
            resolve([]);
            return;
          }
          
          // Parse the output to get process IDs
          const processes = [];
          if (platform === 'win32') {
            // Parse Windows CSV output
            const lines = stdout.split('\n').filter(line => line.includes('rclone.exe'));
            for (const line of lines) {
              const parts = line.split(',');
              if (parts.length >= 2 && parts[1]) {
                const pid = parts[1].replace(/"/g, '').trim();
                processes.push({ pid, command: line });
              }
            }
          } else {
            // Parse Unix ps output
            const lines = stdout.split('\n').filter(Boolean);
            for (const line of lines) {
              const parts = line.trim().split(/\s+/);
              if (parts.length >= 2) {
                const pid = parts[1];
                processes.push({ pid, command: line });
              }
            }
          }
          
          resolve(processes);
        });
      });
      
      // If zombie processes were found, ask user for confirmation to kill them
      if (zombieProcesses.length > 0) {
        // Create dialog only if app is ready
        if (app.isReady()) {
          const { dialog } = require('electron');
          
          const processDetails = zombieProcesses.map(p => `PID: ${p.pid}`).join('\n');
          const result = await dialog.showMessageBox({
            type: 'warning',
            title: 'Zombie Rclone Processes Detected',
            message: 'Found hanging rclone processes that might interfere with OAuth authentication',
            detail: `${zombieProcesses.length} rclone processes found:\n${processDetails}\n\nWould you like to terminate these processes?`,
            buttons: ['Yes, terminate them', 'No, leave them running'],
            defaultId: 0,
            cancelId: 1
          });
          
          // If user confirmed, kill the processes
          if (result.response === 0) {
            for (const process of zombieProcesses) {
              try {
                const killCommand = platform === 'win32'
                  ? `taskkill /F /PID ${process.pid}`
                  : `kill -9 ${process.pid}`;
                  
                await new Promise((resolve) => {
                  exec(killCommand, (error) => {
                    if (error) {
                      console.error(`Failed to kill process ${process.pid}:`, error);
                    } else {
                      console.log(`Successfully terminated process ${process.pid}`);
                    }
                    resolve();
                  });
                });
              } catch (error) {
                console.error(`Error killing process ${process.pid}:`, error);
              }
            }
            
            // Show confirmation after termination
            await dialog.showMessageBox({
              type: 'info',
              title: 'Processes Terminated',
              message: 'Zombie rclone processes have been terminated',
              buttons: ['OK']
            });
          }
        }
      }
    } catch (error) {
      console.error('Error checking for zombie processes:', error);
    }
  }

  // Initialize the application
  init() {
    console.log("[INFO] Application initialized");
    
    // Register app events
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
    
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });
    
    app.on('ready', async () => {
      console.log("[INFO] Application started");
      // Call checkForZombieProcesses before creating the window
      await this.checkForZombieProcesses();
      this.createWindow();
      this.setupIPC();
    });
    
    // Setup IPC for app close
    ipcMain.on("close-app", () => {
      app.quit();
    });
  }

  // Helper function to combine cloud.conf and pf.conf into rclone.conf
  async combinedRcloneConfig() {
    try {
      // Get paths to config files
      const cloudConfigPath = this.configManager.configPath;
      const pfConfigPath = path.join(this.configManager.appConfigDir, 'pf.conf');
      const rcloneConfPath = path.join(this.configManager.appConfigDir, 'rclone.conf');
      
      // Check if both config files exist
      if (!fs.existsSync(cloudConfigPath)) {
        console.error('Cloud configuration file not found');
        return false;
      }
      
      if (!fs.existsSync(pfConfigPath)) {
        console.error('PageFinder configuration file not found');
        return false;
      }
      
      // Combine the configs
      const cloudConfig = fs.readFileSync(cloudConfigPath, 'utf8');
      const pfConfig = fs.readFileSync(pfConfigPath, 'utf8');
      
      // Write the combined config
      fs.writeFileSync(rcloneConfPath, cloudConfig + '\n' + pfConfig);
      console.log(`Combined config files into ${rcloneConfPath}`);
      
      return true;
    } catch (error) {
      console.error('Error combining config files:', error);
      return false;
    }
  }

  // Set up all IPC handlers
  setupIPC() {
    // Handle list remotes request
    ipcMain.on("list-remotes", async (event) => {
      try {
        const remotes = await this.configManager.listRemotes();
        const metadata = this.configManager.getAllRemotesMetadata();
        event.reply("remotes-list", { remotes, metadata });
      } catch (error) {
        console.error("Error listing remotes:", error);
        event.reply("remotes-list", { remotes: [], metadata: {} });
      }
    });

    // Handle remote check request
    ipcMain.on("check-remote", async (event, { remoteName, useLsCommand }) => {
      try {
        event.reply("config-status", `Checking remote ${remoteName}...`);
        const result = await this.configManager.checkRemote(remoteName, { useLsCommand });
        const metadata = this.configManager.getRemoteMetadata(remoteName);
        
        event.reply("remote-status", {
          name: remoteName,
          ...result,
          metadata: metadata
        });
      } catch (error) {
        event.reply("config-status", `Failed to check remote: ${error}`);
      }
    });

    // Handle delete remote request
    ipcMain.on("delete-remote", async (event, remoteName) => {
      try {
        console.log(`Deleting remote ${remoteName}...`);
        
        // Delete the remote configuration
        await this.configManager.deleteRemote(remoteName);
        console.log(`Successfully deleted remote configuration for ${remoteName}`);
        
        // Also delete any metadata for this remote
        const metadataDeleted = this.configManager.deleteRemoteMetadata(remoteName);
        if (!metadataDeleted) {
          console.warn(`Warning: Failed to delete metadata for remote ${remoteName}. This may cause orphaned metadata.`);
        }
        
        event.reply("delete-status", {
          success: true,
          message: `Remote ${remoteName} deleted successfully`
        });
        
        // Refresh the remotes list after deletion
        const remotes = await this.configManager.listRemotes();
        const metadata = this.configManager.getAllRemotesMetadata();
        event.reply("remotes-list", { remotes, metadata });
        
        // Update the sync.sh script with the new configuration
        this.updateSyncScript();
      } catch (error) {
        console.error("Error deleting remote:", error);
        event.reply("delete-status", {
          success: false,
          message: `Failed to delete remote: ${error.message}`
        });
      }
    });

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
      const result = await dialog.showOpenDialog(this.mainWindow, {
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
    
    // Handle checking PageFinder connection
    ipcMain.handle('check-pf-connection', async (event, { useLsCommand = false }) => {
      try {
        const pfConfigPath = path.join(this.configManager.appConfigDir, 'pf.conf');
        
        // Check if the config file exists
        if (!fs.existsSync(pfConfigPath)) {
          return {
            success: false,
            message: 'PageFinder config file not found. Please set up the configuration first.'
          };
        }
        
        // Read the config file to extract all needed information
        const configContent = fs.readFileSync(pfConfigPath, 'utf8');
        
        // Extract remote name from config
        let remoteName = '';
        
        // Simple regex to find a remote name (looks for [name] pattern)
        const remoteMatch = configContent.match(/\[([^\]]+)\]/);
        if (remoteMatch) {
          remoteName = remoteMatch[1];
        }
        
        if (!remoteName) {
          return {
            success: false,
            message: 'No remote found in the config file.'
          };
        }
        
        // Format and test connection
        const settings = this.configManager.getSettings();
        if (!settings.rclonePath) {
          return {
            success: false,
            message: 'Rclone path not configured. Please set it in the settings.'
          };
        }

        // Use the specified format for testing connection
        const formattedPath = `${remoteName}:asi-essentia-ai-new/user/${remoteName}`;
        console.log(`Using formatted path: ${formattedPath}`);
        
        // Use lsd command with max-depth 1, or ls command if checkbox is checked
        const command = useLsCommand
          ? `"${settings.rclonePath}" ls "${formattedPath}" --config "${pfConfigPath}"`
          : `"${settings.rclonePath}" lsd "${formattedPath}" --max-depth 1 --config "${pfConfigPath}"`;
        console.log(`Executing command: ${command}`);
        
        const output = await new Promise((resolve, reject) => {
          exec(command, (error, stdout, stderr) => {
            if (error) {
              console.log(`Command failed: ${error.message}`);
              reject(error);
              return;
            }
            
            if (stderr && stderr.includes('error')) {
              reject(new Error(stderr));
              return;
            }
            
            resolve(stdout || "No content found in user directory.");
          });
        });
        
        return {
          success: true,
          message: 'Connection successful',
          details: {
            remoteName,
            username: remoteName,
            path: `asi-essentia-ai-new/user/${remoteName}`,
            fullPath: `${remoteName}:asi-essentia-ai-new/user/${remoteName}`,
            output
          }
        };
      } catch (error) {
        console.error('Error checking PageFinder connection:', error);
        return {
          success: false,
          message: `Connection failed: ${error.message}`,
          error: error.message
        };
      }
    });

    // Handle checking if PageFinder config file exists
    ipcMain.handle('check-pf-config-exists', async (event) => {
      const pfConfigPath = path.join(this.configManager.appConfigDir, 'pf.conf');
      return fs.existsSync(pfConfigPath);
    });

    // Handle test connection between cloud storage and PageFinder
    ipcMain.handle('test-connection', async (event) => {
      try {
        const settings = this.configManager.getSettings();
        if (!settings.rclonePath) {
          return {
            success: false,
            message: 'Rclone path not configured. Please set it in the settings.'
          };
        }
    
        // Get paths to config files
        const cloudConfigPath = this.configManager.configPath;
        const pfConfigPath = path.join(this.configManager.appConfigDir, 'pf.conf');
        
        // Check if both config files exist
        if (!fs.existsSync(cloudConfigPath)) {
          return {
            success: false,
            message: 'Cloud configuration file not found. Please set up cloud storage first.'
          };
        }
        
        if (!fs.existsSync(pfConfigPath)) {
          return {
            success: false,
            message: 'PageFinder configuration file not found. Please set up PageFinder first.'
          };
        }

        // Combine cloud.conf and pf.conf into rclone.conf
        const combinedSuccess = await this.combinedRcloneConfig();
        if (!combinedSuccess) {
          return {
            success: false,
            message: 'Failed to combine configuration files'
          };
        }
        
        // Use the standard rclone.conf file
        const combinedConfigPath = path.join(this.configManager.appConfigDir, 'rclone.conf');
        
        // Read the PF config
        const pfConfig = fs.readFileSync(pfConfigPath, 'utf8');
        
        // Extract PageFinder remote name from config
        const pfRemoteMatch = pfConfig.match(/\[([^\]]+)\]/);
        if (!pfRemoteMatch) {
          return {
            success: false,
            message: 'Invalid PageFinder config: Remote name not found'
          };
        }
        
        const pfRemoteName = pfRemoteMatch[1];
        
        // Get cloud remotes
        const cloudRemotes = await this.configManager.listRemotes();
        
        // Default bucket name
        let bucketName = 'asi-essentia-ai-new';
        const bucketMatch = pfConfig.match(/bucket\s*=\s*([^\n]+)/);
        if (bucketMatch) {
          bucketName = bucketMatch[1].trim();
        }
        
        // Run only sync.sh with verbose flag 
        console.log('Running sync.sh with verbose flag...');
        let syncOutput = '';
        let success = true;
        
        try {
          const syncScriptPath = path.join(process.cwd(), 'scripts', 'sync.sh');
          if (fs.existsSync(syncScriptPath)) {
            // Create a temporary JSON config for the sync script
            const tmpConfigPath = path.join(os.tmpdir(), 'pf-config-sync-test.json');
            
            // Make sure cloudRemotes is an array of strings (remote names)
            let remoteNames = [];
            if (Array.isArray(cloudRemotes)) {
              remoteNames = cloudRemotes;
            } else if (typeof cloudRemotes === 'object') {
              remoteNames = Object.keys(cloudRemotes);
            }
            
            console.log(`Cloud remotes for sync: ${JSON.stringify(remoteNames)}`);
            
            // Create the config for sync
            const syncConfig = {
              combinedConfigPath,
              cloudRemotes: remoteNames,
              pfRemoteName,
              bucketName,
              foldersToDelete: []
            };
            
            // Write config to temp file
            fs.writeFileSync(tmpConfigPath, JSON.stringify(syncConfig, null, 2));
            
            try {
              // First, update the sync.sh script with the current remotes using update-sync.js
              const updateScriptPath = path.join(process.cwd(), 'scripts', 'update-sync.js');
              
              if (!fs.existsSync(updateScriptPath)) {
                syncOutput = 'Update script not found at: ' + updateScriptPath;
                success = false;
                try {
                  fs.unlinkSync(tmpConfigPath);
                } catch (err) {
                  console.error('Failed to delete temp config file:', err);
                }
              } else {
                // Run update-sync.js with our config to update the sync.sh script
                const updateCmd = `node "${updateScriptPath}" --config "${tmpConfigPath}"`;
                console.log(`Updating sync script: ${updateCmd}`);
                
                try {
                  // Wait for the update script to finish
                  const updateOutput = await new Promise((resolve, reject) => {
                    exec(updateCmd, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
                      if (error) {
                        console.error(`Update script error: ${error.message}`);
                        reject(error);
                        return;
                      }
                      resolve(stdout);
                    });
                  });
                  
                  console.log(`Update script output: ${updateOutput}`);
                  
                  // Now run the updated sync.sh with verbose flag
                  const cmd = `"${syncScriptPath}" -v`;
                  console.log(`Executing sync test: ${cmd}`);
                  
                  syncOutput = await new Promise((resolve, reject) => {
                    exec(cmd, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
                      if (error) {
                        console.error(`Sync test error: ${error.message}`);
                        success = false;
                        // Still return the output even if there's an error
                        resolve(`Error: ${error.message}\n\nOutput:\n${stdout}\n\nErrors:\n${stderr}`);
                      } else {
                        resolve(stdout);
                      }
                    });
                  });
                } catch (runError) {
                  console.error('Error running sync script:', runError);
                  syncOutput = `Failed to run sync test: ${runError.message}`;
                  success = false;
                }
                
                try {
                  // Clean up temp file
                  fs.unlinkSync(tmpConfigPath);
                } catch (cleanupError) {
                  console.error('Error cleaning up temp file:', cleanupError);
                }
              }
            } catch (updateError) {
              console.error('Error updating sync script:', updateError);
              syncOutput = `Failed to update sync script: ${updateError.message}`;
              success = false;
              
              try {
                // Try to clean up temp file if it still exists
                if (fs.existsSync(tmpConfigPath)) {
                  fs.unlinkSync(tmpConfigPath);
                }
              } catch (cleanupError) {
                console.error('Error cleaning up temp file:', cleanupError);
              }
            }
          } else {
            syncOutput = 'Sync script not found at: ' + syncScriptPath;
            success = false;
          }
        } catch (error) {
          console.error('Error running sync script:', error);
          syncOutput = `Failed to run sync test: ${error.message}`;
          success = false;
        }
        
        // No need to clean up combined config file as we're using the standard one
        
        // Check if there was an error in the sync operation
        const wasSuccessful = success && !syncOutput.includes('Error:');
        
        return {
          success: wasSuccessful,
          message: wasSuccessful ? 'Connection test completed successfully' : 'Sync test encountered issues',
          syncOutput
        };
      } catch (error) {
        console.error('Error testing connections:', error);
        return {
          success: false,
          message: `Test failed: ${error.message}`,
          error: error.message
        };
      }
    });
    
    // Handle browsing for local storage folder
    ipcMain.handle('browse-local-folder', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openDirectory'],
        title: 'Select Local Storage Folder'
      });
      
      if (result.canceled) {
        return null;
      }
      
      // Return the selected path directly since that's what the renderer expects
      return result.filePaths[0];
    });
    
    // Handle executing sync.sh with the -e (execute) flag
    ipcMain.handle('run-sync-with-exec', async (event) => {
      try {
        const settings = this.configManager.getSettings();
        if (!settings.rclonePath) {
          return {
            success: false,
            message: 'Rclone path not configured. Please set it in the settings.'
          };
        }
    
        // Get paths to config files
        const cloudConfigPath = this.configManager.configPath;
        const pfConfigPath = path.join(this.configManager.appConfigDir, 'pf.conf');
        
        // Check if both config files exist
        if (!fs.existsSync(cloudConfigPath) || !fs.existsSync(pfConfigPath)) {
          return {
            success: false,
            message: 'Configuration files not found. Please set up cloud storage and PageFinder first.'
          };
        }
        
        // Combine cloud.conf and pf.conf into rclone.conf
        const combinedSuccess = await this.combinedRcloneConfig();
        if (!combinedSuccess) {
          return {
            success: false,
            message: 'Failed to combine configuration files'
          };
        }
        
        // Use the standard rclone.conf file
        const combinedConfigPath = path.join(this.configManager.appConfigDir, 'rclone.conf');
        
        // Read the PF config
        const pfConfig = fs.readFileSync(pfConfigPath, 'utf8');
        
        // Extract PageFinder remote name
        const pfRemoteMatch = pfConfig.match(/\[([^\]]+)\]/);
        if (!pfRemoteMatch) {
          // We don't need to clean up the standard config path
          return {
            success: false,
            message: 'Invalid PageFinder config: Remote name not found'
          };
        }
        
        const pfRemoteName = pfRemoteMatch[1];
        
        // Get cloud remotes
        const cloudRemotes = await this.configManager.listRemotes();
        
        // Make sure cloudRemotes is an array of strings (remote names)
        let remoteNames = [];
        if (Array.isArray(cloudRemotes)) {
          remoteNames = cloudRemotes;
        } else if (typeof cloudRemotes === 'object') {
          remoteNames = Object.keys(cloudRemotes);
        }
        
        console.log(`Cloud remotes for sync exec: ${JSON.stringify(remoteNames)}`);
        
        // Default bucket name
        let bucketName = 'asi-essentia-ai-new';
        const bucketMatch = pfConfig.match(/bucket\s*=\s*([^\n]+)/);
        if (bucketMatch) {
          bucketName = bucketMatch[1].trim();
        }
        
        try {
          // Run sync.sh with execute flag
          console.log('Running sync.sh with -e flag for actual execution...');
          
          const syncScriptPath = path.join(process.cwd(), 'scripts', 'sync.sh');
          if (!fs.existsSync(syncScriptPath)) {
            fs.unlinkSync(combinedConfigPath);
            return {
              success: false,
              message: 'Sync script not found at: ' + syncScriptPath
            };
          }
          
          // Create the JSON config for sync.sh
          const tmpConfigPath = path.join(os.tmpdir(), 'pf-config-sync-exec.json');
          const syncConfig = {
            combinedConfigPath,
            cloudRemotes: remoteNames,
            pfRemoteName,
            bucketName,
            foldersToDelete: []
          };
          
          // Write config to temp file
          fs.writeFileSync(tmpConfigPath, JSON.stringify(syncConfig, null, 2));
          
          // First update the sync.sh script
          const updateScriptPath = path.join(process.cwd(), 'scripts', 'update-sync.js');
          if (!fs.existsSync(updateScriptPath)) {
            fs.unlinkSync(tmpConfigPath);
            fs.unlinkSync(combinedConfigPath);
            return {
              success: false,
              message: 'Update script not found at: ' + updateScriptPath
            };
          }
          
          // Run update-sync.js
          const updateCmd = `node "${updateScriptPath}" --config "${tmpConfigPath}"`;
          console.log(`Updating sync script for execution: ${updateCmd}`);
          
          // Wait for the update script to complete
          await new Promise((resolve, reject) => {
            exec(updateCmd, { maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
              if (error) {
                console.error(`Update script error: ${error.message}`);
                reject(error);
                return;
              }
              console.log(`Update script output: ${stdout}`);
              resolve();
            });
          });
          
          // Now execute sync.sh with -e flag (execute mode)
          const cmd = `"${syncScriptPath}" -e -v`;
          console.log(`Executing sync command: ${cmd}`);
          
          // Execute the command and capture output
          const output = await new Promise((resolve, reject) => {
            exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
              if (error) {
                console.error(`Sync execution error: ${error.message}`);
                // Return the output even if there's an error, but mark as unsuccessful in the return object
                resolve(`Error: ${error.message}\n\nOutput:\n${stdout}\n\nErrors:\n${stderr}`);
                return;
              }
              resolve(stdout);
            });
          });
          
          // Clean up temp files
          try {
            if (fs.existsSync(tmpConfigPath)) fs.unlinkSync(tmpConfigPath);
            // We don't clean up the standard rclone.conf file
          } catch (cleanupError) {
            console.error('Error cleaning up temp files:', cleanupError);
          }
          
          // Check if there was an error in the sync operation
          const wasSuccessful = !output.includes('Error:');
          
          return {
            success: wasSuccessful,
            message: wasSuccessful ? 'Sync operation completed' : 'Sync operation encountered issues',
            output
          };
        } catch (syncError) {
          console.error('Error during sync execution:', syncError);
          
          // Clean up temp files
          try {
            if (fs.existsSync(tmpConfigPath)) fs.unlinkSync(tmpConfigPath);
            // We don't clean up the standard rclone.conf file
          } catch (cleanupError) {
            console.error('Error cleaning up temp files:', cleanupError);
          }
          
          return {
            success: false,
            message: `Sync failed: ${syncError.message}`,
            error: syncError.message
          };
        }
      } catch (error) {
        console.error('Error executing sync:', error);
        return {
          success: false,
          message: `Sync operation failed: ${error.message}`,
          error: error.message
        };
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
          } catch (err) {
            console.error('Error refreshing remotes list:', err);
          }
        });
      } catch (error) {
        event.reply("config-status", `Configuration error: ${error}`);
      }
    });

    // Set subfolder restriction for a remote
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

    // Handle get sync log request
    ipcMain.on("get-sync-log", async (event) => {
      try {
        const logPath = path.join(process.cwd(), 'logs', 'sync_detail.log');
        
        // Check if the log file exists
        if (!fs.existsSync(logPath)) {
          event.reply("sync-log-content", {
            success: false,
            error: "Log file not found. No sync has been run yet."
          });
          return;
        }
        
        // Read the log file
        const logContent = fs.readFileSync(logPath, 'utf8');
        
        // Send log content back to the renderer
        event.reply("sync-log-content", {
          success: true,
          content: logContent
        });
      } catch (error) {
        console.error('Error reading sync log:', error);
        event.reply("sync-log-content", {
          success: false,
          error: error.message
        });
      }
    });
  }
  
  // Update the sync.sh script with current configuration
  async updateSyncScript() {
    // This method intentionally left as a stub for simplicity
    console.log("Sync script update - functionality moved to handlers");
    return true;
  }
}

module.exports = CloudConfigApp;
