const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const { exec } = require("child_process");
const path = require("path");
const fs = require('fs-extra');

/**
 * Application main class - handles window creation and IPC events
 */
class CloudConfigApp {
  constructor(configManager) {
    this.configManager = configManager;
    this.mainWindow = null;
    
    // Only set up IPC handlers if we're in an Electron context
    if (process.type === 'renderer' || process.type === 'browser') {
      this.setupIPCHandlers();
    }
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

  // Set up all IPC event handlers
  setupIPCHandlers() {
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
    
    // Handle browsing for local storage folder
    ipcMain.handle('browse-local-folder', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openDirectory'],
        title: 'Select Local Storage Folder'
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
        
        // Extract bucket from config
        let bucketName = '';
        const bucketMatch = configContent.match(/bucket\s*=\s*([^\n]+)/);
        if (bucketMatch) {
          bucketName = bucketMatch[1].trim();
        }
        
        // If needed, extract access key, secret, etc.
        let accessKey = '';
        const accessKeyMatch = configContent.match(/access_key_id\s*=\s*([^\n]+)/);
        if (accessKeyMatch) {
          accessKey = accessKeyMatch[1].trim();
        }
        
        // Extract region if available
        let region = '';
        const regionMatch = configContent.match(/region\s*=\s*([^\n]+)/);
        if (regionMatch) {
          region = regionMatch[1].trim();
        }
        
        // Construct the path to check - just use the root of the bucket
        let fullPath = `${remoteName}:`;
        
        if (bucketName) {
          fullPath += `${bucketName}`;
        }
        
        console.log(`Checking PageFinder connection to: ${fullPath}`);
        
        // Execute the rclone command to check connection
        const settings = this.configManager.getSettings();
        if (!settings.rclonePath) {
          return {
            success: false,
            message: 'Rclone path not configured. Please set it in the settings.'
          };
        }
        
        // Extract username from the remote name (assuming format like pf-user-2)
        const username = remoteName;
        
        // Use the specified format: username:asi-essentia-ai-new/user/username
        const formattedPath = `${username}:asi-essentia-ai-new/user/${username}`;
        console.log(`Using formatted path: ${formattedPath}`);
        
        // Use lsd command with max-depth 1 as specified, or ls command if checkbox is checked
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
    
    // Handle getting current schedule
    ipcMain.handle('get-current-schedule', async (event) => {
      try {
        // Only for macOS/Linux
        if (process.platform === 'win32') {
          return {
            success: false,
            message: 'Schedule checking not implemented for Windows',
            schedule: null
          };
        }
        
        // Get the script path
        const scriptPath = path.join(process.cwd(), 'scripts', 'sync.sh');
        
        // Check if the script exists
        const scriptExists = fs.existsSync(scriptPath);
        if (!scriptExists) {
          return {
            success: false,
            message: 'No sync script found',
            schedule: null
          };
        }
        
        // Get current crontab
        const crontab = await new Promise((resolve) => {
          exec('crontab -l', (error, stdout) => {
            if (error) {
              // No crontab or other error
              resolve('');
            } else {
              resolve(stdout);
            }
          });
        });
        
        // Look for PageFinder sync job
        const lines = crontab.split('\n');
        let cronExpression = null;
        let jobLine = null;
        
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('# PageFinder Sync Job') && i + 1 < lines.length) {
            jobLine = lines[i + 1];
            break;
          }
          
          if (lines[i].includes(scriptPath)) {
            jobLine = lines[i];
            break;
          }
        }
        
        if (!jobLine) {
          return {
            success: false,
            message: 'No scheduled job found',
            schedule: null
          };
        }
        
        // Parse cron expression
        const parts = jobLine.trim().split(/\s+/);
        if (parts.length < 5) {
          return {
            success: false,
            message: 'Invalid cron expression',
            schedule: null
          };
        }
        
        const minute = parseInt(parts[0]);
        const hour = parseInt(parts[1]);
        const dayOfMonth = parts[2];
        const month = parts[3];
        const dayOfWeek = parts[4];
        
        // Determine frequency
        let frequency = 'daily';
        let dayOfWeekValue = null;
        let dayOfMonthValue = null;
        
        if (minute === 0 && hour === '*') {
          frequency = 'hourly';
        } else if (dayOfMonth !== '*' && month === '*' && dayOfWeek === '*') {
          frequency = 'monthly';
          dayOfMonthValue = parseInt(dayOfMonth);
        } else if (dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
          frequency = 'weekly';
          dayOfWeekValue = parseInt(dayOfWeek);
        }
        
        return {
          success: true,
          message: 'Schedule found',
          schedule: {
            enabled: true,
            frequency,
            hour,
            minute,
            dayOfWeek: dayOfWeekValue,
            dayOfMonth: dayOfMonthValue,
            cronExpression: `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]} ${parts[4]}`
          }
        };
      } catch (error) {
        console.error('Error getting current schedule:', error);
        return {
          success: false,
          message: `Error getting schedule: ${error.message}`,
          schedule: null
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
            // Properly escape the local path by ensuring it's correctly quoted
            const escapedPath = localPath.replace(/"/g, '\\"'); // Escape any quotes in the path
            let configCommand = `"${settings.rclonePath}" config create "${name}" "${provider}" path="${escapedPath}" --config "${this.configManager.configPath}"`;
            console.log('Executing local storage config command:', configCommand);
            await new Promise((resolve, reject) => {
              exec(configCommand, (error, stdout, stderr) => {
                if (error) {
                  event.reply("config-status", `Failed to configure local storage: ${stderr || error.message}`);
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
                this.updateSyncScript();
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

        // Build rclone config command with provider-specific options
        let configCommand;
        
        // Special handling for Google Drive
        if (provider === 'drive' || provider === 'google drive' || provider === 'googledrive') {
          // Use explicit oauth flags for Google Drive to ensure proper authentication
          configCommand = `"${settings.rclonePath}" config create "${name}" "drive" --config "${this.configManager.configPath}" --drive-client-id="" --drive-client-secret="" --drive-scope="drive"`;
          console.log('Using enhanced Google Drive configuration command');
        } else {
          configCommand = `"${settings.rclonePath}" config create "${name}" "${provider}" --config "${this.configManager.configPath}"`;
        }
        
        console.log(`Executing config command: ${configCommand}`);
        
        // Use rclone config to start OAuth flow
        const configProcess = exec(configCommand);

        // Set up output handlers
        configProcess.stdout.on('data', (data) => {
          const output = data.toString();
          console.log('Config stdout:', output);
          event.reply("config-status", output);
        });

        configProcess.stderr.on('data', (data) => {
          const output = data.toString();
          console.log('Config stderr:', output);
          
          // Check for any OAuth URL - supporting multiple URL formats
          if (output.includes('http://127.0.0.1:') || output.includes('https://accounts.google.com/o/oauth2/')) {
            // Extract URLs from the output
            let authUrl;
            
            // Try to match Google OAuth URLs directly
            const googleMatch = output.match(/https:\/\/accounts\.google\.com\/o\/oauth2\/[^\s\n"]*/);
            if (googleMatch) {
              authUrl = googleMatch[0];
            } else {
              // Try to match rclone local server URLs
              const localMatch = output.match(/http:\/\/127\.0\.0\.1:[0-9]+\/auth\?[^\s\n"]*/);
              if (localMatch) {
                authUrl = localMatch[0];
              }
            }
            
            if (authUrl) {
              console.log(`Opening OAuth URL: ${authUrl}`);
              event.reply("config-status", "Opening browser for authentication...");
              shell.openExternal(authUrl);
            }
          } else if (output.includes('Failed to configure')) {
            console.error(`Config error: ${output}`);
            event.reply("config-status", `Configuration failed: ${output}`);
          } else if (output.includes('refresh token')) {
            console.log(`Refresh token issue: ${output}`);
            event.reply("config-status", `Authentication issue: ${output}. Please try again.`);
          } else if (!output.includes('NOTICE:')) {
            console.log(`Config message: ${output}`);
            event.reply("config-status", output);
          }
        });

        // Handle interactive prompts
        try {
          await this.configManager.handleProviderPrompts(configProcess, provider, event);
        } catch (error) {
          event.reply("config-status", `Configuration error: ${error.message}`);
          throw error;
        }

        // Wait for configuration to complete
        await new Promise((resolve, reject) => {
          configProcess.on('close', async (code) => {
            if (code === 0) {
              try {
                // Verify access using provider-specific command
                let verifyCommand = 'about';
                if (provider === 'sharepoint') {
                  verifyCommand = 'lsd'; // SharePoint doesn't support about command
                }
                await this.configManager.executeRclone(`${verifyCommand} ${name}:`, { provider, event });
                event.reply("config-status", `${provider} configuration successful! Access verified.`);
                
                // No subfolder metadata from initial config
                
                // Refresh remotes list with a slight delay to ensure proper update
                console.log(`${provider} configuration successful, refreshing remotes list...`);
                setTimeout(async () => {
                  try {
                    const remotes = await this.configManager.listRemotes();
                    const metadata = this.configManager.getAllRemotesMetadata();
                    console.log('Refreshed remotes list:', remotes);
                    event.reply("remotes-list", { remotes, metadata });
                  } catch (err) {
                    console.error('Error refreshing remotes list:', err);
                  }
                }, 500); // 500ms delay to ensure config file is fully updated
                
                resolve();
              } catch (error) {
                event.reply("config-status", `Configuration failed: Could not verify access - ${error}`);
                reject(error);
              }
            } else {
              event.reply("config-status", "Configuration process failed");
              reject(new Error(`Config process exited with code ${code}`));
            }
          });
        });
        
      } catch (error) {
        event.reply("config-status", `Configuration error: ${error}`);
      }
    });
    
    // Handle remote check request
    ipcMain.on("check-remote", async (event, remoteName) => {
      try {
        event.reply("config-status", `Checking remote ${remoteName}...`);
        const result = await this.configManager.checkRemote(remoteName);
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

    // Handle delete remote request
    ipcMain.on("delete-remote", async (event, remoteName) => {
      try {
        // Delete the remote configuration
        await this.configManager.deleteRemote(remoteName);
        
        // Also delete any metadata for this remote
        this.configManager.deleteRemoteMetadata(remoteName);
        
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
    // Create a combined config file
    const combinedConfigPath = path.join(this.configManager.appConfigDir, 'rclone.conf');
    
    // Read both config files
    let cloudConfig = fs.readFileSync(cloudConfigPath, 'utf8');
    const pfConfig = fs.readFileSync(pfConfigPath, 'utf8');
    
    // Add subfolder information to the cloud config
    const cloudRemotes = await this.configManager.listRemotes();
    for (const cloudRemote of cloudRemotes) {
      // Get metadata for the remote to check for subfolder
      const metadata = this.configManager.getRemoteMetadata(cloudRemote);
      const subfolder = metadata && metadata.subfolder ? metadata.subfolder : '';
      
      if (subfolder) {
        // Check if the remote section exists in the config
        const remoteRegex = new RegExp(`\\[${cloudRemote}\\][^\\[]*(?=\\[|$)`, 'g');
        const remoteMatch = cloudConfig.match(remoteRegex);
        
        if (remoteMatch) {
          // Check if this is a local remote
          const isLocalRemote = remoteMatch[0].includes('type = local');
          
          if (isLocalRemote) {
            // For local remotes, update the path parameter instead of adding a subfolder
            const pathRegex = /path\s*=\s*([^\n]+)/;
            const pathMatch = remoteMatch[0].match(pathRegex);
            
            if (pathMatch) {
              // Replace the path with the subfolder
              const updatedRemoteSection = remoteMatch[0].replace(pathRegex, `path = ${subfolder}`);
              cloudConfig = cloudConfig.replace(remoteMatch[0], updatedRemoteSection);
            }
          } else {
            // For non-local remotes, add the subfolder parameter
            const updatedRemoteSection = remoteMatch[0].replace(/\n$/, '') + `\nsubfolder = ${subfolder}\n`;
            cloudConfig = cloudConfig.replace(remoteMatch[0], updatedRemoteSection);
          }
        }
      }
    }
    
    // Combine the configs
    fs.writeFileSync(combinedConfigPath, cloudConfig + '\n' + pfConfig);
    
    // Extract PF remote name and bucket
    const pfConfigContent = fs.readFileSync(pfConfigPath, 'utf8');
    let pfRemoteName = '';
    const pfRemoteMatch = pfConfigContent.match(/\[([^\]]+)\]/);
    if (pfRemoteMatch) {
      pfRemoteName = pfRemoteMatch[1];
    }
    
    if (!pfRemoteName) {
      return {
        success: false,
        message: 'No remote found in the PageFinder config file.'
      };
    }
    
    // Extract bucket from config
    let bucketName = 'asi-essentia-ai-new';
    const bucketMatch = pfConfigContent.match(/bucket\s*=\s*([^\n]+)/);
    if (bucketMatch) {
      bucketName = bucketMatch[1].trim();
    }
    
    // First, list the top folders in the destination to check for folders to delete
    console.log(`Checking for folders to delete in destination: ${pfRemoteName}:${bucketName}/user/${pfRemoteName}`);
    const destPath = `${pfRemoteName}:${bucketName}/user/${pfRemoteName}`;
    
    // Get list of folders in the destination
    let foldersToDelete = [];
    try {
      // Use lsd command to list directories only, or ls command to list all files
      const listCommand = useLsCommand
        ? `"${settings.rclonePath}" ls "${destPath}" --config "${combinedConfigPath}"`
        : `"${settings.rclonePath}" lsd "${destPath}" --config "${combinedConfigPath}"`;
      console.log(`Executing list command: ${listCommand}`);
      
      const listOutput = await new Promise((resolve, reject) => {
        exec(listCommand, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
          if (error) {
            console.log(`List command failed: ${error.message}`);
            console.log(`List command stderr: ${stderr}`);
            // Don't fail the whole operation if listing fails
            resolve("");
          } else {
            console.log(`List command stdout: ${stdout}`);
            resolve(stdout);
          }
        });
      });
      
      // Parse the output to get folder names
      let folderRegex;
      if (useLsCommand) {
        // Format for ls: path/to/file
        // Extract the top-level directories by looking at the first part of the path
        folderRegex = /^([^\/]+)\//gm;
      } else {
        // Format for lsd: -1 YYYY-MM-DD HH:MM:SS -1 dirname
        folderRegex = /-1\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?\s+-1\s+(.+?)$/gm;
      }
      let match;
      const existingFolders = [];
      
      console.log(`Parsing folder list with regex: ${folderRegex}`);
      
      while ((match = folderRegex.exec(listOutput)) !== null) {
        console.log(`Found folder: ${match[1]}`);
        existingFolders.push(match[1]);
      }
      
      console.log(`Found folders in destination: ${existingFolders.join(', ')}`);
      console.log(`Cloud remotes list: ${cloudRemotes.join(', ')}`);
      
      // Find folders that don't exist in the remotes list
      foldersToDelete = existingFolders.filter(folder => !cloudRemotes.includes(folder));
      
      if (foldersToDelete.length > 0) {
        console.log(`Folders to delete: ${foldersToDelete.join(', ')}`);
      } else {
        console.log('No folders to delete');
      }
    } catch (error) {
      console.error(`Error listing folders in destination: ${error.message}`);
      // Don't fail the whole operation if listing fails
    }
    
    // Test each cloud remote
    const results = [];
    let allSuccessful = true;
    
    // Folders to delete will be handled by the sync.sh script via RCLONE_FOLDERS_TO_DELETE
    
    // Prepare all remotes for syncing
    const remoteConfigs = [];
    
    for (const cloudRemote of cloudRemotes) {
      try {
        // Get metadata for the remote to check for subfolder
        const metadata = this.configManager.getRemoteMetadata(cloudRemote);
        const subfolder = metadata && metadata.subfolder ? metadata.subfolder : '';
        
        // Construct source path
        const sourcePath = subfolder ? `${cloudRemote}:${subfolder}` : `${cloudRemote}:`;
        
        // Construct destination path with cloud storage name
        const destPath = `${pfRemoteName}:${bucketName}/user/${pfRemoteName}/${cloudRemote}`;
        
        // Add to remotes array
        remoteConfigs.push({
          name: cloudRemote,
          source: sourcePath,
          dest: destPath
        });
      } catch (error) {
        console.error(`Error preparing remote ${cloudRemote}:`, error);
        allSuccessful = false;
        results.push({
          remote: cloudRemote,
          success: false,
          error: error.message
        });
      }
    }
    // Get the script paths
    const scriptPath = path.join(process.cwd(), 'scripts', 'sync.sh');
    const updateScriptPath = path.join(process.cwd(), 'scripts', 'update-sync.js');
    
    // First, update the sync.sh script with the current cloud configuration
    console.log(`Updating sync.sh script with current cloud configuration...`);
    try {
      const { execSync } = require('child_process');
      const os = require('os');
      
      // Create a temporary JSON file with the current configuration
      const tempConfigPath = path.join(os.tmpdir(), 'pf-config-temp.json');
      const configData = {
        combinedConfigPath: combinedConfigPath,
        cloudRemotes: cloudRemotes,
        pfRemoteName: pfRemoteName,
        bucketName: bucketName,
        foldersToDelete: foldersToDelete
      };
      
      fs.writeFileSync(tempConfigPath, JSON.stringify(configData, null, 2));
      
      // Pass the temp config file path to the update-sync.js script
      execSync(`node "${updateScriptPath}" --config "${tempConfigPath}"`, {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024
      });
      
      // Clean up the temporary file
      fs.unlinkSync(tempConfigPath);
      console.log(`Successfully updated sync.sh script`);
    } catch (error) {
      console.error(`Error updating sync.sh script:`, error);
      allSuccessful = false;
      results.push({
        remote: 'All remotes',
        success: false,
        error: `Failed to update sync.sh script: ${error.message}`,
        output: error.message
      });
      
      // Keep the combined config file for batch jobs
      console.log(`Combined config file created at: ${combinedConfigPath}`);
      
      return {
        success: false,
        message: 'Failed to update sync.sh script',
        results: results
      };
    }
    
    // Now execute the updated sync.sh script with the -v flag
    const exactCommand = `"${scriptPath}" -v`;
    console.log(`Executing command: ${exactCommand}`);
    
    // Execute the command
    try {
      // Use execSync to get the exact output as it would appear in the terminal
      const { execSync } = require('child_process');
      const output = execSync(exactCommand, {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024
      });
      
      // Add a single result for all remotes
      results.push({
        remote: 'All remotes',
        command: exactCommand,
        success: allSuccessful,
        output: output
      });
    } catch (error) {
      console.error(`Error testing connections:`, error);
      allSuccessful = false;
      results.push({
        remote: 'All remotes',
        success: false,
        error: error.message,
        output: error.message
      });
    }
    
    // Keep the combined config file for batch jobs
    console.log(`Combined config file created at: ${combinedConfigPath}`);
    
    return {
      success: allSuccessful,
      message: allSuccessful ? 'All connections tested successfully' : 'Some connections failed',
      results: results
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
    // Handle generate sync script request
    ipcMain.handle('generate-sync-script', async (event, { schedule }) => {
      try {
        // Import os module for tmpdir
        const os = require('os');
        
        // Only for macOS/Linux
        if (process.platform === 'win32') {
          return {
            success: false,
            message: 'Schedule setup not implemented for Windows',
            error: 'Windows platform is not supported for scheduling'
          };
        }
        
        // Get the script path
        const scriptPath = path.join(process.cwd(), 'scripts', 'sync.sh');
        
        // Check if the script exists
        const scriptExists = fs.existsSync(scriptPath);
        if (!scriptExists) {
          return {
            success: false,
            message: 'No sync script found',
            error: 'The sync.sh script does not exist'
          };
        }
        
        // Make sure the script is executable
        fs.chmodSync(scriptPath, '755');
        
        // Generate the crontab entry
        let cronExpression = '';
        if (schedule.frequency === 'hourly') {
          cronExpression = '0 * * * *';
        } else if (schedule.frequency === 'daily') {
          cronExpression = `${schedule.minute} ${schedule.hour} * * *`;
        } else if (schedule.frequency === 'weekly') {
          cronExpression = `${schedule.minute} ${schedule.hour} * * ${schedule.dayOfWeek}`;
        } else if (schedule.frequency === 'monthly') {
          cronExpression = `${schedule.minute} ${schedule.hour} ${schedule.dayOfMonth} * *`;
        }
        
        // Get current crontab
        const currentCrontab = await new Promise((resolve) => {
          exec('crontab -l', (error, stdout) => {
            if (error) {
              // No crontab or other error
              resolve('');
            } else {
              resolve(stdout);
            }
          });
        });
        
        // Remove any existing PageFinder sync job
        const lines = currentCrontab.split('\n');
        const newLines = [];
        let skipNext = false;
        
        for (let i = 0; i < lines.length; i++) {
          if (skipNext) {
            skipNext = false;
            continue;
          }
          
          if (lines[i].includes('# PageFinder Sync Job')) {
            skipNext = true;
            continue;
          }
          
          if (lines[i].includes(scriptPath)) {
            continue;
          }
          if (lines[i].trim()) {
            newLines.push(lines[i]);
          }
        }
        
        // Add the new job if enabled
        if (schedule.enabled) {
          newLines.push('# PageFinder Sync Job');
          // Use -e option to execute (not dry-run) and -v for verbose output
          newLines.push(`${cronExpression} ${scriptPath} -e -v`);
        }
        
        // Write the new crontab
        const newCrontab = newLines.join('\n') + '\n';
        
        await new Promise((resolve, reject) => {
          const tempFile = path.join(os.tmpdir(), 'pf-crontab');
          fs.writeFileSync(tempFile, newCrontab);
          
          exec(`crontab ${tempFile}`, (error) => {
            fs.unlinkSync(tempFile); // Clean up temp file
            
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });
        
        return {
          success: true,
          message: schedule.enabled
            ? 'Sync script scheduled successfully'
            : 'Sync schedule disabled successfully',
          scriptPath: scriptPath
        };
      } catch (error) {
        console.error('Error generating sync script:', error);
        return {
          success: false,
          message: 'Failed to set up sync schedule',
          error: error.message
        };
      }
    });

    // Handle close request
    ipcMain.on("close-app", () => {
      app.quit();
    });
    
    // End of setupIPCHandlers
  }
  
  /**
   * Update the sync.sh script with the current cloud configuration
   */
  async updateSyncScript() {
    try {
      console.log('Updating sync.sh script with current cloud configuration...');
      
      // Get the script paths
      const scriptPath = path.join(process.cwd(), 'scripts', 'sync.sh');
      const updateScriptPath = path.join(process.cwd(), 'scripts', 'update-sync.js');
      
      // Get the cloud remotes
      const cloudRemotes = await this.configManager.listRemotes();
      
      // Create a temporary JSON file with the current configuration
      const os = require('os');
      const tempConfigPath = path.join(os.tmpdir(), 'pf-config-temp.json');
      
      // Get the PageFinder config path
      const pfConfigPath = path.join(this.configManager.appConfigDir, 'pf.conf');
      
      // Check if the PageFinder config file exists
      if (!fs.existsSync(pfConfigPath)) {
        console.log('PageFinder config file not found, skipping sync.sh update');
        return;
      }
      
      // Read the PageFinder config file to extract the remote name and bucket
      const pfConfigContent = fs.readFileSync(pfConfigPath, 'utf8');
      
      // Extract remote name from config
      let pfRemoteName = '';
      const remoteMatch = pfConfigContent.match(/\[([^\]]+)\]/);
      if (remoteMatch) {
        pfRemoteName = remoteMatch[1];
      }
      
      if (!pfRemoteName) {
        console.log('No remote found in the PageFinder config file, skipping sync.sh update');
        return;
      }
      
      // Extract bucket from config
      let bucketName = 'asi-essentia-ai-new';
      const bucketMatch = pfConfigContent.match(/bucket\s*=\s*([^\n]+)/);
      if (bucketMatch) {
        bucketName = bucketMatch[1].trim();
      }
      
      // Create the config data
      const configData = {
        combinedConfigPath: this.configManager.configPath,
        cloudRemotes: cloudRemotes,
        pfRemoteName: pfRemoteName,
        bucketName: bucketName
      };
      
      // Write the config data to the temporary file
      fs.writeFileSync(tempConfigPath, JSON.stringify(configData, null, 2));
      
      // Execute the update-sync.js script
      const { execSync } = require('child_process');
      execSync(`node "${updateScriptPath}" --config "${tempConfigPath}"`, {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024
      });
      
      // Clean up the temporary file
      fs.unlinkSync(tempConfigPath);
      
      console.log('Successfully updated sync.sh script');
    } catch (error) {
      console.error('Error updating sync.sh script:', error);
    }
  }

  // Initialize the application
  init() {
    // Only proceed if we're in an Electron context
    if (typeof app !== 'undefined') {
      app.whenReady().then(() => {
        const mainWindow = this.createWindow();
        
        // Check rclone path on startup
        const settings = this.configManager.getSettings();
        if (!settings.rclonePath) {
          mainWindow.webContents.on('did-finish-load', () => {
            mainWindow.webContents.send('show-rclone-setup');
          });
        }
      });

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
    } else {
      console.log("Not running in Electron context. Some features will be disabled.");
    }
  }
  
  /**
   * Update the sync.sh script with the current cloud configuration
   */
  async updateSyncScript() {
      try {
        console.log('Updating sync.sh script with current cloud configuration...');
        
        // Get the script paths
        const scriptPath = path.join(process.cwd(), 'scripts', 'sync.sh');
        const updateScriptPath = path.join(process.cwd(), 'scripts', 'update-sync.js');
        
        // Get the cloud remotes
        const cloudRemotes = await this.configManager.listRemotes();
        
        // Create a temporary JSON file with the current configuration
        const os = require('os');
        const tempConfigPath = path.join(os.tmpdir(), 'pf-config-temp.json');
        
        // Get the PageFinder config path
        const pfConfigPath = path.join(this.configManager.appConfigDir, 'pf.conf');
        
        // Check if the PageFinder config file exists
        if (!fs.existsSync(pfConfigPath)) {
          console.log('PageFinder config file not found, skipping sync.sh update');
          return;
        }
        
        // Read the PageFinder config file to extract the remote name and bucket
        const pfConfigContent = fs.readFileSync(pfConfigPath, 'utf8');
        
        // Extract remote name from config
        let pfRemoteName = '';
        const remoteMatch = pfConfigContent.match(/\[([^\]]+)\]/);
        if (remoteMatch) {
          pfRemoteName = remoteMatch[1];
        }
        
        if (!pfRemoteName) {
          console.log('No remote found in the PageFinder config file, skipping sync.sh update');
          return;
        }
        
        // Extract bucket from config
        let bucketName = 'asi-essentia-ai-new';
        const bucketMatch = pfConfigContent.match(/bucket\s*=\s*([^\n]+)/);
        if (bucketMatch) {
          bucketName = bucketMatch[1].trim();
        }
        
        // Create the config data
        const configData = {
          combinedConfigPath: this.configManager.configPath,
          cloudRemotes: cloudRemotes,
          pfRemoteName: pfRemoteName,
          bucketName: bucketName
        };
        
        // Write the config data to the temporary file
        fs.writeFileSync(tempConfigPath, JSON.stringify(configData, null, 2));
        
        // Execute the update-sync.js script
        const { execSync } = require('child_process');
        execSync(`node "${updateScriptPath}" --config "${tempConfigPath}"`, {
          encoding: 'utf8',
          maxBuffer: 10 * 1024 * 1024
        });
        
        // Clean up the temporary file
        fs.unlinkSync(tempConfigPath);
        
        console.log('Successfully updated sync.sh script');
      } catch (error) {
        console.error('Error updating sync.sh script:', error);
      }
    }
}

module.exports = CloudConfigApp;
