const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const { exec } = require("child_process");
const path = require("path");
const fs = require('fs-extra');
const os = require('os');
const syncHandler = require('./sync-handler');

// Set up console output logging to terminal.log
function setupConsoleLogging() {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  
  // Function to write to terminal.log
  function writeToTerminalLog(message) {
    try {
      const logDir = path.join(os.tmpdir(), 'pf-config-temp', 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      const logFile = path.join(logDir, 'terminal.log');
      const timestamp = new Date().toISOString();
      fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
    } catch (error) {
      // Use original console to avoid infinite recursion
      originalConsoleError('Error writing to terminal log:', error);
    }
  }
  
  // Override console.log
  console.log = function() {
    const args = Array.from(arguments);
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    // Write to terminal.log
    writeToTerminalLog(message);
    
    // Call original console.log
    originalConsoleLog.apply(console, arguments);
  };
  
  // Override console.error
  console.error = function() {
    const args = Array.from(arguments);
    const message = 'ERROR: ' + args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    // Write to terminal.log
    writeToTerminalLog(message);
    
    // Call original console.error
    originalConsoleError.apply(console, arguments);
  };
  
  // Override console.warn
  console.warn = function() {
    const args = Array.from(arguments);
    const message = 'WARNING: ' + args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    // Write to terminal.log
    writeToTerminalLog(message);
    
    // Call original console.warn
    originalConsoleWarn.apply(console, arguments);
  };
  
  console.log('Console logging to terminal.log has been set up');
}

// Initialize console logging
setupConsoleLogging();

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
      title: "PageFinder Configuration",
      // Ensure the window is movable, has a frame, and is resizable
      movable: true,
      frame: true,
      resizable: true
    });

    this.mainWindow.loadFile(path.join(__dirname, "..", "index.html"));
    
    // List remotes after window loads
    this.mainWindow.webContents.on('did-finish-load', () => {
      // Set a timeout to ensure UI doesn't hang
      console.log('Window loaded, loading remotes with timeout protection');
      
      // Send initial UI ready message
      this.mainWindow.webContents.send("ui-ready", { status: "ok" });
      
      // Load remotes with timeout protection
      this.loadRemotesWithTimeout();
    });
    
    return this.mainWindow;
  }
  
  // Initialize the application and set up handlers
  init() {
    // Only create a window if one doesn't already exist (prevent duplicate windows)
    if (!this.mainWindow) {
      this.createWindow();
    }
    
    // Note: setupScheduleHandler is now called from setupIPC to avoid duplicate registration
    
    // Handle graceful shutdown on SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      console.log("[INFO] Received SIGINT, exiting");
      app.quit();
    });
    
    // Handle graceful shutdown on SIGTERM
    process.on('SIGTERM', () => {
      console.log("[INFO] Received SIGTERM, exiting");
      app.quit();
    });
    
    // We don't register app lifecycle events here anymore
    // They are now handled in main.js to avoid duplication
    
    // Note: setupIPC() is now called directly from main.js
    // to avoid duplicate handler registration
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

  // Removed duplicate init() method - consolidated into the single init() method above

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

  // Set up all IPC handlers - this is called directly from main.js
  setupIPC() {
    console.log('Setting up IPC handlers in CloudConfigApp');
    // Setup IPC for app close with higher priority
    ipcMain.removeAllListeners("close-app"); // Remove any existing handlers first
    ipcMain.on("close-app", () => {
      console.log("[INFO] Close application request received");
      console.log("[INFO] Calling app.exit() to force quit");
      app.exit(0); // Use app.exit(0) instead of app.quit() to force immediate exit
    });
    // Setup schedule-related handlers (only called once from here)
    if (!this._scheduleHandlersInitialized) {
      this.setupScheduleHandler();
      this._scheduleHandlersInitialized = true;
    }
    this.setupScheduleHandler();

    // Handle list remotes request
    ipcMain.on("list-remotes", async (event) => {
      try {
        const remotesResult = await this.configManager.listRemotes();
        const metadata = this.configManager.getAllRemotesMetadata();
        
        console.log(`[REMOTES_DEBUG] Got remotes result:`, remotesResult);
        
        // Extract the remotes array from the result object
        // The ConfigManager returns { remotes: [...], error: null }
        const remotesList = remotesResult.remotes || [];
        const error = remotesResult.error || null;
        
        console.log(`[REMOTES_DEBUG] Extracted ${remotesList.length} remotes:`, remotesList);
        
        // Send the properly structured data to the renderer
        event.reply("remotes-list", {
          remotes: remotesList,
          metadata,
          error
        });
      } catch (error) {
        console.error("Error listing remotes:", error);
        event.reply("remotes-list", { remotes: [], metadata: {}, error: error.message });
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
        // No need to update sync.sh script anymore as we're using sync-handler.js
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
        // Use sync-handler.js instead of sync.sh
        console.log('Running sync test using sync-handler.js...');

        
        // Make sure cloudRemotes is an array of strings (remote names)
        let remoteNames = [];
        if (Array.isArray(cloudRemotes)) {
          remoteNames = cloudRemotes;
        } else if (cloudRemotes && typeof cloudRemotes === 'object' && Array.isArray(cloudRemotes.remotes)) {
          // Handle case where cloudRemotes is the direct result of configManager.listRemotes()
          remoteNames = cloudRemotes.remotes;
        } else if (typeof cloudRemotes === 'object') {
          // This is a fallback, but should not normally be used
          console.warn('Warning: Unexpected format for cloudRemotes, using Object.keys as fallback');
          remoteNames = Object.keys(cloudRemotes);
        }
        
        console.log(`Cloud remotes for sync: ${JSON.stringify(remoteNames)}`);
        
        // Get rclone path from settings
        // Use the settings variable already declared above
        if (!settings.rclonePath) {
          return {
            success: false,
            message: 'Rclone path not configured. Please set it in the settings.'
          };
        }
        
        // Get remote metadata for subfolder restrictions
        const remoteMetadata = this.configManager.getAllRemotesMetadata();
        
        // Create the options for sync operation
        const syncOptions = {
          rclonePath: settings.rclonePath,
          combinedConfigPath,
          cloudRemotes: remoteNames,
          pfRemoteName,
          bucketName,
          foldersToDelete: [],
          remoteMetadata
        };
        
        // Execute the test sync operation
        const result = await syncHandler.testSync(syncOptions);

        // Extract the results
        const { success, message, syncOutput } = result;
        
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
    // Handle executing sync operation using sync-handler.js
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
        } else if (cloudRemotes && typeof cloudRemotes === 'object' && Array.isArray(cloudRemotes.remotes)) {
          // Handle case where cloudRemotes is the direct result of configManager.listRemotes()
          remoteNames = cloudRemotes.remotes;
        } else if (typeof cloudRemotes === 'object') {
          // This is a fallback, but should not normally be used
          console.warn('Warning: Unexpected format for cloudRemotes, using Object.keys as fallback');
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
          // Use sync-handler.js instead of sync.sh
          console.log('Running sync operation using sync-handler.js...');
          
          // Get remote metadata for subfolder restrictions
          const remoteMetadata = this.configManager.getAllRemotesMetadata();
          
          // Create the options for sync operation
          const syncOptions = {
            rclonePath: settings.rclonePath,
            combinedConfigPath,
            cloudRemotes: remoteNames,
            pfRemoteName,
            bucketName,
            foldersToDelete: [],
            remoteMetadata
          };
          
          // Execute the sync operation with execute flag
          const result = await syncHandler.testSync({
            ...syncOptions,
            execute: true
          });
// Extract the results
const { success: syncWasSuccessful, message, syncOutput, error } = result;

// Check if there was an error in the sync operation
// Handle case where syncOutput might be undefined (error case)
const wasSuccessful = syncWasSuccessful && (syncOutput ? !syncOutput.includes('Error:') : true);

return {
  success: wasSuccessful,
  message: wasSuccessful ? 'Sync operation completed' : 'Sync operation encountered issues',
  output: syncOutput || error || 'No output available'
};
        } catch (syncError) {
          console.error('Error during sync execution:', syncError);
          
          // Clean up is not needed as we're using the standard rclone.conf file
          try {
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
        // Use the environment module to get the correct logs path
        const env = require('../config/environment');
        
        // Try to use terminal.log instead of sync_detail.log
        const logPath = path.join(env.PATHS.logs, 'terminal.log');
        
        // Check if the log file exists
        if (!fs.existsSync(logPath)) {
          console.log(`Log file not found at: ${logPath}`);
          event.reply("sync-log-content", {
            success: false,
            error: "Log file not found. Please check the logs directory."
          });
          return;
        }
        
        console.log(`Reading log file from: ${logPath}`);
        
        // Read the log file
        const logContent = fs.readFileSync(logPath, 'utf8');
        console.log(`Successfully read log file, size: ${logContent.length} bytes`);
        
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
    
    // Handle get terminal log request
    ipcMain.on("get-terminal-log", async (event) => {
      try {
        const logPath = path.join(os.tmpdir(), 'pf-config-temp', 'logs', 'terminal.log');
        
        // Check if the log file exists
        if (!fs.existsSync(logPath)) {
          event.reply("terminal-log-content", {
            success: false,
            error: "Terminal log file not found. No operations have been run yet."
          });
          return;
        }
        
        // Read the log file
        const logContent = fs.readFileSync(logPath, 'utf8');
        
        // Send log content back to the renderer
        event.reply("terminal-log-content", {
          success: true,
          content: logContent
        });
      } catch (error) {
        console.error('Error reading terminal log:', error);
        event.reply("terminal-log-content", {
          success: false,
          error: error.message
        });
      }
    });
  }
  
  // Handle schedule-related requests
  setupScheduleHandler() {
    // Remove any existing handlers first to prevent duplicate registration
    ipcMain.removeHandler('get-current-schedule');
    ipcMain.removeHandler('remove-schedule');
    ipcMain.removeHandler('save-schedule');
    
    console.log('Setting up schedule handlers');
    
    // Handler to get the current schedule
    ipcMain.handle('get-current-schedule', async (event) => {
      try {
        const settings = this.configManager.getSettings();
        return {
          success: true,
          schedule: settings.schedule || {
            enabled: false,
            frequency: 'daily',
            hour: 0,
            minute: 0,
            dayOfWeek: 0,
            dayOfMonth: 1
          }
        };
      } catch (error) {
        console.error('Error getting current schedule:', error);
        return {
          success: false,
          message: `Failed to get schedule: ${error.message}`,
          error: error.message
        };
      }
    });
    
    // Handler to remove a schedule
    ipcMain.handle('remove-schedule', async (event) => {
      try {
        // Get current settings
        const settings = this.configManager.getSettings();
        
        // Remove the schedule from settings
        if (settings.schedule) {
          delete settings.schedule;
          this.configManager.saveSettings(settings);
        }
        
        // Remove the batch job
        await this.removeSyncBatchJob();
        
        return {
          success: true,
          message: 'Schedule removed successfully'
        };
      } catch (error) {
        console.error('Error removing schedule:', error);
        return {
          success: false,
          message: `Failed to remove schedule: ${error.message}`,
          error: error.message
        };
      }
    });
    ipcMain.handle('save-schedule', async (event, schedule) => {
      try {
        console.log('Saving schedule:', schedule);
        
        // Store the schedule in settings
        this.configManager.saveSettings({
          ...this.configManager.getSettings(),
          schedule: schedule
        });
        
        // Generate a cron expression
        let cronExpression = '';
        if (schedule.enabled) {
          // Format: minute hour * * day-of-week
          // For daily: minute hour * * *
          // For weekly: minute hour * * day-of-week (0-6, Sunday=0)
          // For monthly: minute hour day-of-month * *
          
          switch (schedule.frequency) {
            case 'daily':
              cronExpression = `${schedule.minute} ${schedule.hour} * * *`;
              break;
            case 'weekly':
              cronExpression = `${schedule.minute} ${schedule.hour} * * ${schedule.dayOfWeek}`;
              break;
            case 'monthly':
              cronExpression = `${schedule.minute} ${schedule.hour} ${schedule.dayOfMonth} * *`;
              break;
          }
          
          // Log the generated cron expression
          console.log('Generated cron expression:', cronExpression);
          
          // Set up the batch job to execute sync
          await this.setupSyncBatchJob(schedule, cronExpression);
        } else {
          // If schedule is disabled, remove any existing scheduled tasks
          await this.removeSyncBatchJob();
        }
        
        return {
          success: true,
          message: 'Schedule saved and batch job set up successfully',
          cronExpression: cronExpression
        };
      } catch (error) {
        console.error('Error saving schedule:', error);
        return {
          success: false,
          message: `Failed to save schedule: ${error.message}`,
          error: error.message
        };
      }
    });
    
    // Add method to set up the sync batch job
    this.setupSyncBatchJob = async (schedule, cronExpression) => {
      try {
        const env = require('../config/environment');
        const { exec } = require('child_process');
        const path = require('path');
        const fs = require('fs-extra');
        
        // Get platform-specific configuration
        const platformConfig = env.getPlatformConfig();
        const isWindows = env.IS_WINDOWS;
        const isMac = env.IS_MAC;
        
        // Create a JavaScript file that will execute the sync operation
        const syncJsPath = path.join(env.PATHS.scripts, 'scheduled-sync.js');
        
        // Write the JavaScript file that will use the sync-handler module directly
        const syncJsContent = `
/**
 * Scheduled Sync Script
 * This script is automatically generated and executed by the scheduler
 */
const path = require('path');
const fs = require('fs');

// Set up console logging to terminal.log
const setupConsoleLogging = () => {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  
  // Function to write to terminal.log
  function writeToTerminalLog(message) {
    try {
      const logDir = path.join('${env.PATHS.logs.replace(/\\/g, '\\\\')}');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      const logFile = path.join(logDir, 'terminal.log');
      const timestamp = new Date().toISOString();
      fs.appendFileSync(logFile, '[' + timestamp + '] ' + message + '\\n');
    } catch (error) {
      // Use original console to avoid infinite recursion
      console.error('Error writing to terminal log:', error);
    }
  }
  
  // Store original console methods
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  
  // Override console.log
  console.log = function() {
    const args = Array.from(arguments);
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    // Write to terminal.log
    writeToTerminalLog(message);
    
    // Call original console.log
    originalConsoleLog.apply(console, arguments);
  };
  
  // Override console.error
  console.error = function() {
    const args = Array.from(arguments);
    const message = 'ERROR: ' + args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    // Write to terminal.log
    writeToTerminalLog(message);
    
    // Call original console.error
    originalConsoleError.apply(console, arguments);
  };
  
  // Override console.warn
  console.warn = function() {
    const args = Array.from(arguments);
    const message = 'WARNING: ' + args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    // Write to terminal.log
    writeToTerminalLog(message);
    
    // Call original console.warn
    originalConsoleWarn.apply(console, arguments);
  };
};

// Initialize console logging
setupConsoleLogging();

// Log start of sync
console.log('Starting scheduled sync operation at ' + new Date().toISOString());

// Import the sync-handler module directly
const syncHandlerPath = '${path.join(env.PATHS.appBase, 'src', 'modules', 'sync-handler').replace(/\\/g, '\\\\')}';
console.log('Loading sync-handler module from:', syncHandlerPath);
const syncHandler = require(syncHandlerPath);

// Get settings from config
const configDir = "${this.configManager.appConfigDir.replace(/\\/g, '\\\\')}";
const settingsPath = path.join(configDir, 'settings.json');
const metadataPath = path.join(configDir, 'remotes-metadata.json');
const rcloneConfigPath = path.join(configDir, 'cloud.conf');
const pfConfigPath = path.join(configDir, 'pf.conf');
const combinedConfigPath = path.join(configDir, 'rclone.conf');

// Load settings
let settings = {};
try {
  if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  }
} catch (error) {
  console.error('Error loading settings:', error);
  process.exit(1);
}

// Load metadata
let metadata = { remotes: {} };
try {
  if (fs.existsSync(metadataPath)) {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  }
} catch (error) {
  console.error('Error loading metadata:', error);
}

// Combine configs if needed
try {
  if (fs.existsSync(rcloneConfigPath) && fs.existsSync(pfConfigPath)) {
    const cloudConfig = fs.readFileSync(rcloneConfigPath, 'utf8');
    const pfConfig = fs.readFileSync(pfConfigPath, 'utf8');
    fs.writeFileSync(combinedConfigPath, cloudConfig + '\\n' + pfConfig);
    console.log('Combined config files for sync operation');
  } else {
    console.error('Missing required config files');
    process.exit(1);
  }
} catch (error) {
  console.error('Error combining config files:', error);
  process.exit(1);
}

// Extract PF remote name from config
let pfRemoteName = '';
try {
  const pfConfigContent = fs.readFileSync(pfConfigPath, 'utf8');
  const remoteMatch = pfConfigContent.match(/\\[([^\\]]+)\\]/);
  if (remoteMatch) {
    pfRemoteName = remoteMatch[1];
  }
} catch (error) {
  console.error('Error extracting PF remote name:', error);
}

// Get cloud remotes from metadata
const cloudRemotes = Object.keys(metadata.remotes || {});
if (cloudRemotes.length === 0) {
  console.error('No cloud remotes found in metadata');
  process.exit(1);
}

// Prepare sync options - using the same format as in the test connection
const syncOptions = {
  rclonePath: settings.rclonePath,
  combinedConfigPath: combinedConfigPath,
  cloudRemotes: cloudRemotes,
  pfRemoteName: pfRemoteName,
  bucketName: 'asi-essentia-ai-new',
  foldersToDelete: [], // Add foldersToDelete parameter
  remoteMetadata: metadata.remotes || {},
  execute: true // Set execute flag to true for scheduled runs
};

// Execute sync using the testSync function with execute flag
console.log('Executing sync with options:', JSON.stringify(syncOptions, null, 2));

// Use the testSync function - this is the same function used in the test connection
// but with execute=true to run without the dry-run flag
syncHandler.testSync(syncOptions)
  .then(result => {
    // Extract the results
    const { success: syncWasSuccessful, message, syncOutput, error } = result;
    
    // Check if there was an error in the sync operation
    // Handle case where syncOutput might be undefined (error case)
    const wasSuccessful = syncWasSuccessful && (syncOutput ? !syncOutput.includes('Error:') : true);
    
    // Log the result
    console.log('Scheduled sync completed with result:', {
      success: wasSuccessful,
      message: wasSuccessful ? 'Sync operation completed' : 'Sync operation encountered issues',
      output: syncOutput || error || 'No output available'
    });
    
    // Exit with appropriate code
    process.exit(wasSuccessful ? 0 : 1);
  })
  .catch(error => {
    console.error('Scheduled sync failed:', error);
    process.exit(1);
  });
`;

        // Ensure scripts directory exists
        fs.ensureDirSync(env.PATHS.scripts);
        
        // Write the sync script
        fs.writeFileSync(syncJsPath, syncJsContent);
        
        // Make the script executable on Unix-like systems
        if (!isWindows) {
          fs.chmodSync(syncJsPath, '755');
          
          // Also ensure the log directory exists and has correct permissions
          fs.ensureDirSync(env.PATHS.logs);
          fs.chmodSync(env.PATHS.logs, '755');
        }
        
        // Get the Node.js executable path
        const nodePath = process.execPath;
        
        console.log(`Setting up batch job to execute sync script: ${syncJsPath}`);
        
        if (isWindows) {
          // Windows implementation using Task Scheduler
          const taskName = 'PageFinderSync';
          
          // Format time for schtasks
          const hour = schedule.hour.toString().padStart(2, '0');
          const minute = schedule.minute.toString().padStart(2, '0');
          
          // Build the schedule string based on frequency
          let scheduleString = '';
          switch (schedule.frequency) {
            case 'daily':
              scheduleString = '/SC DAILY';
              break;
            case 'weekly':
              // Convert 0-6 day format to MON,TUE,etc.
              const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
              scheduleString = `/SC WEEKLY /D ${days[schedule.dayOfWeek]}`;
              break;
            case 'monthly':
              scheduleString = `/SC MONTHLY /D ${schedule.dayOfMonth}`;
              break;
          }
          
          // Delete any existing task first
          const deleteCmd = `schtasks /Delete /TN "${taskName}" /F`;
          try {
            await new Promise((resolve, reject) => {
              exec(deleteCmd, (error, stdout, stderr) => {
                // Ignore errors as the task might not exist
                resolve();
              });
            });
          } catch (error) {
            // Ignore errors when deleting task
            console.log('No existing task to delete or error deleting task');
          }
          
          // Create the new scheduled task
          const createCmd = `schtasks /Create /TN "${taskName}" /TR "${nodePath} \\"${syncJsPath}\\"" ${scheduleString} /ST ${hour}:${minute} /F`;
          console.log(`Creating scheduled task with command: ${createCmd}`);
          
          await new Promise((resolve, reject) => {
            exec(createCmd, (error, stdout, stderr) => {
              if (error) {
                console.error(`Error creating scheduled task: ${error.message}`);
                reject(error);
                return;
              }
              console.log(`Scheduled task created: ${stdout}`);
              resolve(stdout);
            });
          });
        } else if (isMac || !isWindows) {
          // macOS/Linux implementation using crontab
          
          // Get the user's current crontab
          const tempCronFile = path.join(env.USER_DATA_DIR, 'temp_crontab');
          
          // Export current crontab to a file
          await new Promise((resolve, reject) => {
            exec('crontab -l', (error, stdout, stderr) => {
              try {
                // If there's no crontab, create an empty one
                if (error && error.code !== 0) {
                  fs.writeFileSync(tempCronFile, '');
                } else {
                  // Filter out any existing PageFinder sync entries and empty lines
                  const lines = stdout.split('\n')
                    .filter(line => line.trim() !== '' && !line.includes('# PageFinder Sync'));
                  
                  // Write filtered content without trailing newlines
                  const content = lines.join('\n');
                  fs.writeFileSync(tempCronFile, content.trim());
                }
                resolve();
              } catch (err) {
                reject(err);
              }
            });
          });
          
          // Add our new cron job - ensure there's exactly one newline before adding
          // Include environment variables and use full paths
          const homeDir = process.env.HOME || process.env.USERPROFILE;
          const cronJob = `\n${schedule.minute} ${schedule.hour} * * ${schedule.frequency === 'weekly' ? schedule.dayOfWeek : '*'} cd "${env.PATHS.appBase}" && HOME="${homeDir}" PATH="/usr/local/bin:/usr/bin:/bin:$PATH" "${nodePath}" "${syncJsPath}" >> "${env.PATHS.logs}/cron-sync.log" 2>&1 # PageFinder Sync Job`;
          fs.appendFileSync(tempCronFile, cronJob);
          
          // Install the new crontab
          await new Promise((resolve, reject) => {
            exec(`crontab ${tempCronFile}`, (error, stdout, stderr) => {
              if (error) {
                console.error(`Error installing crontab: ${error.message}`);
                reject(error);
                return;
              }
              console.log('Crontab installed successfully');
              resolve();
            });
          });
          
          // Clean up the temporary file
          fs.unlinkSync(tempCronFile);
        }
        
        console.log('Batch job set up successfully');
        return true;
      } catch (error) {
        console.error('Error setting up batch job:', error);
        throw error;
      }
    };
    
    // Add method to remove the sync batch job
    this.removeSyncBatchJob = async () => {
      try {
        const env = require('../config/environment');
        const { exec } = require('child_process');
        const path = require('path');
        const fs = require('fs-extra');
        
        const isWindows = env.IS_WINDOWS;
        
        if (isWindows) {
          // Windows implementation - delete the scheduled task
          const taskName = 'PageFinderSync';
          const deleteCmd = `schtasks /Delete /TN "${taskName}" /F`;
          
          await new Promise((resolve, reject) => {
            exec(deleteCmd, (error, stdout, stderr) => {
              if (error) {
                // Task might not exist, so don't treat as error
                console.log(`Task ${taskName} might not exist or error deleting: ${error.message}`);
                resolve();
                return;
              }
              console.log(`Scheduled task deleted: ${stdout}`);
              resolve(stdout);
            });
          });
        } else {
          // macOS/Linux implementation - remove from crontab
          const tempCronFile = path.join(env.USER_DATA_DIR, 'temp_crontab');
          
          // Export current crontab to a file
          await new Promise((resolve, reject) => {
            exec('crontab -l', (error, stdout, stderr) => {
              try {
                if (error && error.code !== 0) {
                  // No crontab exists
                  fs.writeFileSync(tempCronFile, '');
                } else {
                  // Filter out any PageFinder sync entries and empty lines
                  const lines = stdout.split('\n')
                    .filter(line => line.trim() !== '' && !line.includes('# PageFinder Sync'));
                  
                  // Write filtered content without trailing newlines
                  const content = lines.join('\n');
                  fs.writeFileSync(tempCronFile, content.trim());
                }
                resolve();
              } catch (err) {
                reject(err);
              }
            });
          });
          
          // Install the new crontab (without the PageFinder entries)
          await new Promise((resolve, reject) => {
            exec(`crontab ${tempCronFile}`, (error, stdout, stderr) => {
              if (error) {
                console.error(`Error installing crontab: ${error.message}`);
                reject(error);
                return;
              }
              console.log('Crontab updated successfully (PageFinder entries removed)');
              resolve();
            });
          });
          
          // Clean up the temporary file
          fs.unlinkSync(tempCronFile);
        }
        
        console.log('Batch job removed successfully');
        return true;
      } catch (error) {
        console.error('Error removing batch job:', error);
        throw error;
      }
    };
  }
  
  /**
   * Log a command execution to the exec_log.log file
   * @param {string} command - The command being executed
   * @param {string} stdout - The standard output of the command
   * @param {string} stderr - The standard error output of the command
   * @param {Error} error - Any error that occurred during execution
   */
  logCommandExecution(command, stdout = '', stderr = '', error = null) {
    try {
      const logPath = env.PATHS.logs;
      const logFile = path.join(logPath, 'exec_log.log');
      
      // Create logs directory if it doesn't exist
      if (!fs.existsSync(logPath)) {
        fs.mkdirSync(logPath, { recursive: true });
      }
      
      // Create the log file if it doesn't exist
      if (!fs.existsSync(logFile)) {
        fs.writeFileSync(logFile, '', 'utf8');
      }
      
      // Check current log file size
      const stats = fs.statSync(logFile);
      const MAX_LOG_SIZE = 2 * 1024 * 1024; // 2MB
      
      // Format the log entry
      const timestamp = new Date().toISOString();
      let logEntry = `\n${'='.repeat(80)}\n`;
      logEntry += `[${timestamp}] COMMAND: ${command}\n`;
      logEntry += `${'='.repeat(80)}\n\n`;
      
      if (stdout) {
        logEntry += `--- STDOUT ---\n${stdout}\n\n`;
      }
      
      if (stderr) {
        logEntry += `--- STDERR ---\n${stderr}\n\n`;
      }
      
      if (error) {
        logEntry += `--- ERROR ---\n${error.message}\n\n`;
      }
      
      // If file exceeds size limit, trim it
      if (stats.size + logEntry.length > MAX_LOG_SIZE) {
        console.log(`Exec log file exceeds ${MAX_LOG_SIZE / (1024 * 1024)}MB, trimming...`);
        
        // Read the file content
        let content = fs.readFileSync(logFile, 'utf8');
        
        // Calculate how much to keep (approximately half of the content)
        const halfSize = Math.floor(content.length / 2);
        
        // Find a newline character after the halfway point to make a clean cut
        let cutPoint = content.indexOf('\n', halfSize);
        if (cutPoint === -1) cutPoint = halfSize; // Fallback if no newline found
        
        // Keep the second half of the file
        content = content.substring(cutPoint);
        
        // Add a header indicating the file was trimmed
        const trimHeader = `[LOG TRIMMED AT ${timestamp}]\n` +
                          `Previous log entries were removed to keep file size under ${MAX_LOG_SIZE / (1024 * 1024)}MB\n` +
                          `-------------------------------------------\n\n`;
        
        // Write the trimmed content and new log entry
        fs.writeFileSync(logFile, trimHeader + content + logEntry);
      } else {
        // Append the log entry to the file
        fs.appendFileSync(logFile, logEntry);
      }
    } catch (logError) {
      console.error('Error writing to exec log:', logError);
    }
  }
  
  /**
   * Execute a command and log it to exec_log.log
   * @param {string} command - The command to execute
   * @param {Object} options - Options for child_process.exec
   * @returns {Promise<string>} - The stdout output of the command
   */
  async executeCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      console.log(`Executing command: ${command}`);
      
      const { exec } = require('child_process');
      const process = exec(command, options, (error, stdout, stderr) => {
        // Log the command execution
        this.logCommandExecution(command, stdout, stderr, error);
        
        if (error) {
          console.error(`Command failed: ${error.message}`);
          reject(error);
          return;
        }
        
        if (stderr && stderr.includes('error')) {
          const stderrError = new Error(stderr);
          this.logCommandExecution(command, stdout, stderr, stderrError);
          reject(stderrError);
          return;
        }
        
        resolve(stdout);
      });
    });
  }
  
  // Removed cleanupZombieProcesses method
// This method is kept for backward compatibility but doesn't do anything
// as we're using sync-handler.js directly
async updateSyncScript() {
  console.log("Sync script update - no longer needed as we're using sync-handler.js");
  return true;
}
  
  /**
   * Load remotes with timeout protection to prevent UI hanging
   * This method ensures the UI remains responsive even if remote loading fails
   */
  loadRemotesWithTimeout() {
    console.log('Loading remotes with direct error handling');
    
    // Create a promise for loading remotes - no timeout race needed anymore
    const loadRemotesPromise = async () => {
      try {
        console.log('Starting remote loading process');
        
        // Get the result from the improved listRemotes method
        const result = await this.configManager.listRemotes();
        console.log(`Remote loading completed: ${result.remotes.length} remotes found`);
        
        if (result.error) {
          console.error(`Remote loading error: ${result.error}`);
          
          // Show a specific error dialog based on the error type
          if (this.mainWindow) {
            let title = 'Remote Loading Error';
            let message = 'Error loading remotes';
            let detail = result.error;
            
            // Customize message based on error type
            if (result.error.includes('OAuth authentication required')) {
              title = 'Authentication Required';
              message = 'OAuth Authentication Required';
              detail = 'You need to authenticate with your cloud provider first. Please run rclone config in a terminal to complete the authentication process.';
            } else if (result.error.includes('not found')) {
              title = 'Configuration Error';
              message = 'Rclone Not Found';
              detail = `${result.error}\n\nPlease install rclone or set the correct path in settings.`;
            } else if (result.error.includes('permissions')) {
              title = 'Permission Error';
              message = 'Rclone Permission Issue';
              detail = `${result.error}\n\nPlease fix the permissions for rclone or the config file.`;
            }
            
            // Show the error dialog
            const { dialog } = require('electron');
            dialog.showMessageBox(this.mainWindow, {
              type: 'error',
              title: title,
              message: message,
              detail: detail,
              buttons: ['OK']
            });
            
            // Send the error to the renderer
            this.mainWindow.webContents.send("remotes-list", {
              remotes: [],
              metadata: {},
              error: result.error
            });
          }
          return;
        }
        
        // If successful, get metadata and send to renderer
        const metadata = this.configManager.getAllRemotesMetadata();
        
        if (this.mainWindow) {
          this.mainWindow.webContents.send("remotes-list", {
            remotes: result.remotes,
            metadata: metadata
          });
        }
      } catch (error) {
        console.error('Unexpected error in loadRemotesWithTimeout:', error);
        
        if (this.mainWindow) {
          // Show a generic error dialog for unexpected errors
          const { dialog } = require('electron');
          dialog.showMessageBox(this.mainWindow, {
            type: 'error',
            title: 'Unexpected Error',
            message: 'An unexpected error occurred',
            detail: `Error: ${error.message || 'Unknown error'}\n\nPlease check the application logs for more details.`,
            buttons: ['OK']
          });
          
          this.mainWindow.webContents.send("remotes-list", {
            remotes: [],
            metadata: {},
            error: `Unexpected error: ${error.message || 'Unknown error'}`
          });
        }
      }
    };
    
    // Execute the promise immediately
    loadRemotesPromise();
  }
}

module.exports = CloudConfigApp;
