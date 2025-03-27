const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const { exec } = require("child_process");
const path = require("path");
const fs = require('fs-extra');

let mainWindow;

/**
 * Configuration Manager Class
 * Handles all interactions with rclone configuration
 */
class ConfigManager {
  constructor() {
    this.appConfigDir = this.getAppConfigDir();
    this.configPath = this.getRcloneConfigPath();
    this.settingsPath = this.getSettingsPath();
    this.metadataPath = this.getMetadataPath();
    
    // Ensure necessary directories exist
    this.ensureDirectories();
    
    // Initialize metadata if needed
    this.initializeMetadata();
  }

  // Get the app config directory path
  getAppConfigDir() {
    const userHome = process.env.HOME || process.env.USERPROFILE;
    return path.join(userHome, '.config', 'pf-config');
  }

  // Get the rclone config file path
  getRcloneConfigPath() {
    return path.join(this.appConfigDir, 'cloud.conf');
  }

  // Get the app settings file path
  getSettingsPath() {
    return path.join(this.appConfigDir, 'settings.json');
  }
  
  // Get the remotes metadata file path
  getMetadataPath() {
    return path.join(this.appConfigDir, 'remotes-metadata.json');
  }
  
  // Initialize metadata file if it doesn't exist
  initializeMetadata() {
    const metadataPath = this.getMetadataPath();
    if (!fs.existsSync(metadataPath)) {
      fs.writeFileSync(metadataPath, JSON.stringify({ remotes: {} }, null, 2));
    }
  }
  
  // Get metadata for a specific remote
  getRemoteMetadata(remoteName) {
    try {
      const metadataPath = this.getMetadataPath();
      if (!fs.existsSync(metadataPath)) {
        return null;
      }
      
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      return metadata.remotes[remoteName] || null;
    } catch (error) {
      console.error('Error getting remote metadata:', error);
      return null;
    }
  }
  
  // Get metadata for all remotes
  getAllRemotesMetadata() {
    try {
      const metadataPath = this.getMetadataPath();
      if (!fs.existsSync(metadataPath)) {
        return {};
      }
      
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      return metadata.remotes || {};
    } catch (error) {
      console.error('Error getting all remotes metadata:', error);
      return {};
    }
  }
  
  // Save metadata for a specific remote
  saveRemoteMetadata(remoteName, metadata) {
    try {
      const metadataPath = this.getMetadataPath();
      let allMetadata = { remotes: {} };
      
      if (fs.existsSync(metadataPath)) {
        allMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      }
      
      allMetadata.remotes[remoteName] = metadata;
      fs.writeFileSync(metadataPath, JSON.stringify(allMetadata, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving remote metadata:', error);
      return false;
    }
  }
  
  // Delete metadata for a specific remote
  deleteRemoteMetadata(remoteName) {
    try {
      const metadataPath = this.getMetadataPath();
      if (!fs.existsSync(metadataPath)) {
        return true;
      }
      
      const allMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      
      if (allMetadata.remotes && allMetadata.remotes[remoteName]) {
        delete allMetadata.remotes[remoteName];
        fs.writeFileSync(metadataPath, JSON.stringify(allMetadata, null, 2));
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting remote metadata:', error);
      return false;
    }
  }
  
  /**
   * Get the configuration for a specific remote from the rclone config file
   * @param {string} remoteName - The name of the remote
   * @returns {Object|null} - The remote configuration or null
   */
  async getRemoteConfig(remoteName) {
    try {
      if (!fs.existsSync(this.configPath)) {
        console.error('Config file not found:', this.configPath);
        return null;
      }
      
      // Read the config file
      const configContent = fs.readFileSync(this.configPath, 'utf8');
      
      // Find the section for the specific remote
      const remoteRegex = new RegExp(`\\[${remoteName}\\]([^\\[]*)`);
      const match = configContent.match(remoteRegex);
      
      if (!match) {
        console.log(`No configuration found for remote: ${remoteName}`);
        return null;
      }
      
      // Parse the configuration
      const configSection = match[1].trim();
      const config = {};
      
      // Add the basic properties
      configSection.split('\n').forEach(line => {
        // Skip empty lines
        if (!line.trim()) return;
        
        // Split by = and trim whitespace
        const [key, value] = line.split('=').map(part => part.trim());
        if (key && value) {
          config[key] = value;
        }
      });
      
      console.log(`Config for ${remoteName}:`, config);
      return config;
    } catch (error) {
      console.error(`Error getting remote config for ${remoteName}:`, error);
      return null;
    }
  }

  // Create necessary directories
  ensureDirectories() {
    if (!fs.existsSync(this.appConfigDir)) {
      fs.mkdirSync(this.appConfigDir, { recursive: true });
    }
    
    // Create config file if it doesn't exist
    if (!fs.existsSync(this.configPath)) {
      fs.writeFileSync(this.configPath, '', 'utf8');
    }
  }

  // Get application settings
  getSettings() {
    const DEFAULT_RCLONE_PATH = '/usr/local/bin/rclone';
    
    if (fs.existsSync(this.settingsPath)) {
      return JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
    }
    
    // Try default path first
    if (fs.existsSync(DEFAULT_RCLONE_PATH)) {
      const settings = { rclonePath: DEFAULT_RCLONE_PATH };
      this.saveSettings(settings);
      return settings;
    }
    
    return { rclonePath: '' };
  }

  // Save application settings
  saveSettings(settings) {
    fs.writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2));
  }

  // Validate rclone installation path
  async validateRclonePath(rclonePath) {
    return new Promise((resolve) => {
      exec(`"${rclonePath}" --version`, (error, stdout) => {
        resolve(!error && stdout.includes('rclone'));
      });
    });
  }

  // List configured remotes
  async listRemotes() {
    try {
      const settings = this.getSettings();
      if (!settings.rclonePath) {
        throw new Error('Rclone path not configured');
      }

      const output = await new Promise((resolve, reject) => {
        exec(`"${settings.rclonePath}" --config "${this.configPath}" listremotes`, (error, stdout) => {
          if (error) {
            reject(error);
          } else {
            resolve(stdout);
          }
        });
      });

      return output.trim().split('\n').map(remote => remote.replace(':', ''));
    } catch (error) {
      console.error('Error listing remotes:', error);
      return [];
    }
  }

  // Delete a remote configuration
  async deleteRemote(remoteName) {
    if (!fs.existsSync(this.configPath)) {
      throw new Error("Config file not found");
    }
    
    let content = fs.readFileSync(this.configPath, 'utf8');
    const remoteRegex = new RegExp(`\\[${remoteName}\\][^\\[]*(?=\\[|$)`, 'g');
    
    if (!content.match(remoteRegex)) {
      throw new Error("Remote not found");
    }
    
    content = content.replace(remoteRegex, '');
    fs.writeFileSync(this.configPath, content.trim() + '\n', 'utf8');
  }

  // Execute rclone commands with provider-specific options
  executeRclone(command, options = {}) {
    return new Promise((resolve, reject) => {
      const settings = this.getSettings();
      if (!settings.rclonePath) {
        reject(new Error('Rclone path not configured. Please set it in the settings.'));
        return;
      }

      console.log(`Executing rclone command: ${command}`);
      
      // Build command with additional flags based on provider
      let fullCommand = `"${settings.rclonePath}" --config "${this.configPath}"`;
      
      // Add provider-specific flags
      if (options.provider) {
        switch (options.provider) {
          case 'onedrive':
            // OneDrive will use rclone's default credentials
            break;
          case 'sharepoint':
            // SharePoint needs additional parameters for site URL
            fullCommand += ' --sharepoint-client-id "" --sharepoint-client-secret ""';
            break;
          case 'box':
            // Box uses a different authentication flow
            fullCommand += ' --box-client-id "" --box-client-secret ""';
            break;
          case 'dropbox':
            // Dropbox uses app authentication
            fullCommand += ' --dropbox-client-id "" --dropbox-client-secret ""';
            break;
        }
      }
      
      // Add the main command
      fullCommand += ` ${command}`;
      
      const rcloneProcess = exec(fullCommand, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          console.error(`Rclone error: ${error.message}`);
          console.error(`Stderr: ${stderr}`);
          
          // Provider-specific error handling
          if (stderr.includes('oauth2: cannot fetch token')) {
            reject('Authentication failed. Please check your credentials and try again.');
          } else if (stderr.includes('quota')) {
            reject('Storage quota exceeded. Please free up space or upgrade your plan.');
          } else {
            reject(stderr || error.message);
          }
        } else {
          console.log(`Rclone output: ${stdout}`);
          resolve(stdout);
        }
      });

      rcloneProcess.stdout.on('data', (data) => {
        console.log(`Rclone stdout: ${data}`);
        
        // Handle provider-specific interactive prompts
        if (data.includes('Enter a team drive ID')) {
          rcloneProcess.stdin.write('\n'); // Skip team drive selection
        }
      });

      rcloneProcess.stderr.on('data', (data) => {
        const output = data.toString();
        console.error(`Rclone stderr: ${output}`);
        
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
          
          if (authUrl && options.event) {
            console.log(`Opening OAuth URL from executeRclone: ${authUrl}`);
            options.event.reply("config-status", "Opening browser for authentication...");
            shell.openExternal(authUrl);
          }
        }
      });
    });
  }

  // Handle provider-specific interactive prompts during configuration
  handleProviderPrompts(process, provider, event) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Configuration timed out'));
      }, 300000); // 5 minute timeout

      process.stdout.on('data', (data) => {
        const input = data.toString().toLowerCase();
        
        if (provider === 'onedrive') {
          if (input.includes('choose a number')) {
            process.stdin.write('1\n'); // Select default region
          } else if (input.includes('choose drive type')) {
            process.stdin.write('1\n'); // Select personal account
          }
        }
      });

      process.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });
    });
  }
// Check remote contents
async checkRemote(remoteName) {
  try {
    console.log(`Checking remote: ${remoteName}`);
    // Check if there's a subfolder restriction in metadata
    const metadata = this.getRemoteMetadata(remoteName);
    console.log(`Remote metadata:`, metadata);
    
    const subfolder = metadata && metadata.subfolder ? metadata.subfolder : '';
    
    // Get all remotes to check if this is a local remote
    const remotes = await this.listRemotes();
    const remoteConfig = await this.getRemoteConfig(remoteName);
    const isLocalRemote = remoteConfig && remoteConfig.type === 'local';
    
    let pathPrefix;
    if (isLocalRemote && subfolder) {
      // For local remotes, join the path with the subfolder using path.join
      // Since we use rclone, local remotes still use the colon syntax but need special handling
      console.log(`Local remote detected with subfolder: ${subfolder}`);
      pathPrefix = `${remoteName}:/${subfolder}`;
    } else {
      // For cloud remotes, use standard format
      pathPrefix = subfolder ? `${remoteName}:${subfolder}` : `${remoteName}:`;
    }
    console.log(`Using path prefix: ${pathPrefix}`);
    console.log(`Using path prefix: ${pathPrefix}`);
    
    // Get total number of files
    console.log(`Executing size command...`);
    const listOutput = await this.executeRclone(`size ${pathPrefix}`);
    console.log(`Size command result:`, listOutput);
    
    // Get directories only using lsd command
    console.log(`Executing lsd command...`);
    // lsd lists directories instead of files, which is more efficient than using --max-depth
    const recentDirs = await this.executeRclone(`lsd ${pathPrefix}`);
    console.log(`List command result length: ${recentDirs ? recentDirs.length : 0} characters`);
    
    const header = "        Date       Time    Directory\n" +
                   "----------------------------------------\n";
    // Process the directories list if we have data
    let topDirs = header;
    
    if (recentDirs && recentDirs.trim()) {
      const processedLines = recentDirs.split('\n')
        .filter(line => line.trim())
        .map(line => {
          // Format for lsd: -1 YYYY-MM-DD HH:MM:SS -1 dirname
          const match = line.match(/^-1\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})(?:\.\d+)?\s+-1\s+(.+?)$/);
          if (match) {
            const [_, date, time, dirname] = match;
            return `           ${date} ${time}  ${dirname}`;
          }
          return line;
        })
        .slice(0, 100);
      
      // Get all lines and count them
      const allLines = recentDirs.split('\n').filter(line => line.trim());
      const totalDirsCount = allLines.length;
      
      // Process only the first 100 lines
      const processedLinesLimited = processedLines.slice(0, 100);
      
      if (processedLinesLimited.length > 0) {
        // Add header with count information
        if (totalDirsCount > 100) {
          topDirs += `Showing top 100 of ${totalDirsCount} directories:\n\n`;
        } else {
          topDirs += `Showing all ${totalDirsCount} directories:\n\n`;
        }
        
        topDirs += processedLinesLimited.join('\n');
      } else {
        topDirs += "No directories found";
      }
    } else {
      topDirs += "No directories found";
    }
    
    console.log('Processed directory listing complete');
    
    return {
      name: remoteName,
      metadata: metadata,
      type: remoteConfig ? remoteConfig.type : 'unknown',
      path: remoteConfig && remoteConfig.type === 'local' ? remoteConfig.path : null,
      summary: listOutput || "Could not retrieve size information",
      recentFiles: topDirs
    };
  } catch (error) {
    console.error('Error in checkRemote:', error);
    // Return graceful error instead of throwing
    // Get metadata and remote config even in error case
    const metadata = this.getRemoteMetadata(remoteName) || {};
    const remoteConfig = await this.getRemoteConfig(remoteName);
    
    return {
      name: remoteName,
      metadata: metadata,
      type: remoteConfig ? remoteConfig.type : 'unknown',
      path: remoteConfig && remoteConfig.type === 'local' ? remoteConfig.path : null,
      summary: "Error retrieving information",
      recentFiles: "Could not list directories: " + error.message
    };
  }
}
}

/**
 * Application main class - handles window creation and IPC events
 */
class CloudConfigApp {
  constructor() {
    this.configManager = new ConfigManager();
    this.setupIPCHandlers();
  }

  // Create the main application window
  createWindow() {
    mainWindow = new BrowserWindow({
      width: 1100,
      height: 900,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      title: "PageFinder Configuration"
    });

    mainWindow.loadFile(path.join(__dirname, "index.html"));
    
    // List remotes after window loads
    mainWindow.webContents.on('did-finish-load', async () => {
      try {
        const remotes = await this.configManager.listRemotes();
        const metadata = this.configManager.getAllRemotesMetadata();
        mainWindow.webContents.send("remotes-list", { remotes, metadata });
      } catch (error) {
        console.error("Error listing remotes:", error);
      }
    });
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
      const result = await dialog.showOpenDialog(mainWindow, {
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
      const result = await dialog.showOpenDialog(mainWindow, {
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
    ipcMain.handle('check-pf-connection', async (event, {}) => {
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
        
        // Use lsd command with max-depth 1 as specified
        const command = `"${settings.rclonePath}" lsd "${formattedPath}" --max-depth 1 --config "${pfConfigPath}"`;
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
    
    // Handle generating sync script
    ipcMain.handle('generate-sync-script', async (event, { schedule }) => {
      try {
        const settings = this.configManager.getSettings();
        if (!settings.rclonePath) {
          return {
            success: false,
            message: 'Rclone path not configured. Please set it in the settings.'
          };
        }
        
        // Get paths to config files
        const combinedConfigPath = path.join(this.configManager.appConfigDir, 'rclone.conf');
        
        // Check if combined config file exists
        if (!fs.existsSync(combinedConfigPath)) {
          return {
            success: false,
            message: 'Combined configuration file not found. Please run a test connection first.'
          };
        }
        
        // Get list of cloud remotes
        const cloudRemotes = await this.configManager.listRemotes();
        
        // Extract PF remote name from the combined config
        const configContent = fs.readFileSync(combinedConfigPath, 'utf8');
        const remoteMatches = configContent.match(/\[([^\]]+)\]/g);
        let pfRemoteName = '';
        
        if (remoteMatches) {
          // Find a remote that's not in cloudRemotes (should be the PF remote)
          for (const match of remoteMatches) {
            const name = match.substring(1, match.length - 1);
            if (!cloudRemotes.includes(name)) {
              pfRemoteName = name;
              break;
            }
          }
        }
        
        if (!pfRemoteName) {
          return {
            success: false,
            message: 'Could not identify PageFinder remote in the configuration.'
          };
        }
        
        // Extract bucket name (default to asi-essentia-ai-new if not found)
        let bucketName = 'asi-essentia-ai-new';
        const bucketMatch = configContent.match(/bucket\s*=\s*([^\n]+)/);
        if (bucketMatch) {
          bucketName = bucketMatch[1].trim();
        }
        
        // Create sync commands for each cloud remote
        let syncCommands = '';
        
        for (const cloudRemote of cloudRemotes) {
          // Get metadata for the remote to check for subfolder
          const metadata = this.configManager.getRemoteMetadata(cloudRemote);
          const subfolder = metadata && metadata.subfolder ? metadata.subfolder : '';
          
          // Construct source path
          const sourcePath = subfolder ? `${cloudRemote}:${subfolder}` : `${cloudRemote}:`;
          
          // Construct destination path with cloud storage name
          const destPath = `${pfRemoteName}:${bucketName}/user/${pfRemoteName}/${cloudRemote}`;
          
          // Add the sync command
          syncCommands += `log "Syncing ${cloudRemote} to PageFinder..."\n`;
          syncCommands += `"${settings.rclonePath}" sync "${sourcePath}" "${destPath}" -P --config "${combinedConfigPath}" >> "\${LOG_FILE}" 2>&1\n`;
          syncCommands += `if [ $? -eq 0 ]; then\n`;
          syncCommands += `    log "Sync for ${cloudRemote} completed successfully"\n`;
          syncCommands += `else\n`;
          syncCommands += `    log "ERROR: Sync for ${cloudRemote} failed"\n`;
          syncCommands += `fi\n\n`;
        }
        
        // Read the template
        const templatePath = path.join(__dirname, '..', 'scripts', 'sync-template.sh');
        let scriptTemplate = fs.readFileSync(templatePath, 'utf8');
        
        // Replace placeholders
        const currentDate = new Date().toISOString();
        const logDir = path.join(process.cwd(), 'logs');
        
        scriptTemplate = scriptTemplate.replace('{{DATE}}', currentDate);
        scriptTemplate = scriptTemplate.replace('{{RCLONE_PATH}}', settings.rclonePath);
        scriptTemplate = scriptTemplate.replace('{{CONFIG_PATH}}', combinedConfigPath);
        scriptTemplate = scriptTemplate.replace('{{LOG_DIR}}', logDir);
        scriptTemplate = scriptTemplate.replace('{{SYNC_COMMANDS}}', syncCommands);
        
        // Write the script to a file
        const scriptPath = path.join(process.cwd(), 'scripts', 'sync.sh');
        fs.writeFileSync(scriptPath, scriptTemplate);
        fs.chmodSync(scriptPath, '755'); // Make executable
        
        // Create cron job if schedule is provided
        if (schedule && schedule.enabled) {
          // Generate cron expression based on schedule
          let cronExpression = '0 0 * * *'; // Default to daily at midnight
          
          if (schedule.frequency === 'hourly') {
            // Run at the beginning of every hour
            cronExpression = '0 * * * *';
          } else if (schedule.frequency === 'daily') {
            // Run at specific hour and minute
            const hour = schedule.hour || 0;
            const minute = schedule.minute || 0;
            cronExpression = `${minute} ${hour} * * *`;
          } else if (schedule.frequency === 'weekly') {
            // Run on specific day of week at specific hour and minute
            const dayOfWeek = schedule.dayOfWeek || 0; // 0 = Sunday
            const hour = schedule.hour || 0;
            const minute = schedule.minute || 0;
            cronExpression = `${minute} ${hour} * * ${dayOfWeek}`;
          } else if (schedule.frequency === 'monthly') {
            // Run on specific day of month at specific hour and minute
            const dayOfMonth = schedule.dayOfMonth || 1;
            const hour = schedule.hour || 0;
            const minute = schedule.minute || 0;
            cronExpression = `${minute} ${hour} ${dayOfMonth} * *`;
          }
          
          // Create a crontab entry
          const cronCommand = `${scriptPath} >> ${logDir}/cron.log 2>&1`;
          
          // For macOS/Linux, use crontab
          if (process.platform !== 'win32') {
            // Get existing crontab
            const tempCronPath = path.join(this.configManager.appConfigDir, 'tempcron');
            
            try {
              // Create a direct crontab entry file
              const cronEntry = `# PageFinder Sync Job - Added ${currentDate}\n${cronExpression} ${cronCommand}\n`;
              fs.writeFileSync(tempCronPath, cronEntry);
              
              console.log(`Setting up cron job with expression: ${cronExpression}`);
              console.log(`Cron command: ${cronCommand}`);
              console.log(`Cron entry:\n${cronEntry}`);
              
              // Use a more direct approach to set the crontab
              // First, get the current crontab
              const currentCrontab = await new Promise((resolve, reject) => {
                exec('crontab -l 2>/dev/null || echo ""', (error, stdout) => {
                  if (error && error.code !== 1) { // code 1 just means no crontab
                    console.error('Error getting current crontab:', error);
                    reject(error);
                    return;
                  }
                  resolve(stdout);
                });
              });
              
              console.log('Current crontab content:');
              console.log(currentCrontab);
              
              // Filter out any existing PageFinder sync jobs
              const filteredCrontab = currentCrontab
                .split('\n')
                .filter(line => !line.includes('# PageFinder Sync Job') && !line.includes(scriptPath))
                .join('\n');
              
              // Add our new job
              const newCrontab = filteredCrontab +
                `\n# PageFinder Sync Job - Added ${currentDate}\n${cronExpression} ${cronCommand}\n`;
              
              // Write the complete crontab to a file
              fs.writeFileSync(tempCronPath, newCrontab);
              
              console.log('New crontab content:');
              console.log(newCrontab);
              
              // Install the new crontab directly
              await new Promise((resolve, reject) => {
                exec(`crontab "${tempCronPath}"`, (error, stdout, stderr) => {
                  if (error) {
                    console.error('Error setting up crontab:', error);
                    console.error('Stderr:', stderr);
                    reject(error);
                    return;
                  }
                  console.log('Crontab set up successfully');
                  if (stdout) console.log('Stdout:', stdout);
                  resolve();
                });
              });
              
              // Verify that the crontab was set correctly
              await new Promise((resolve) => {
                exec('crontab -l', (error, stdout, stderr) => {
                  if (error) {
                    console.error('Error verifying crontab:', error);
                    console.error('Stderr:', stderr);
                  } else {
                    console.log('Current crontab contents:');
                    console.log(stdout);
                    
                    // Check if our job is in the crontab
                    if (stdout.includes('PageFinder Sync Job')) {
                      console.log('PageFinder Sync Job found in crontab - SUCCESS!');
                    } else {
                      console.error('PageFinder Sync Job NOT found in crontab - FAILED!');
                    }
                  }
                  resolve(); // Always resolve, even if there's an error
                });
              });
              
              // Clean up
              fs.unlinkSync(tempCronPath);
            } catch (error) {
              console.error('Error setting up cron job:', error);
              return {
                success: false,
                message: `Script generated but failed to schedule: ${error.message}`,
                scriptPath: scriptPath
              };
            }
          } else {
            // For Windows, we would use Task Scheduler
            // This is a simplified version - in a real app, you'd use the Windows Task Scheduler API
            console.log('Windows scheduling not fully implemented - would use Task Scheduler');
          }
        }
        
        return {
          success: true,
          message: schedule && schedule.enabled ? 'Sync script generated and scheduled' : 'Sync script generated',
          scriptPath: scriptPath
        };
      } catch (error) {
        console.error('Error generating sync script:', error);
        return {
          success: false,
          message: `Failed to generate sync script: ${error.message}`,
          error: error.message
        };
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
        const cloudConfig = fs.readFileSync(cloudConfigPath, 'utf8');
        const pfConfig = fs.readFileSync(pfConfigPath, 'utf8');
        
        // Combine the configs
        fs.writeFileSync(combinedConfigPath, cloudConfig + '\n' + pfConfig);
        
        // Get list of cloud remotes
        const cloudRemotes = await this.configManager.listRemotes();
        
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
        
        // Test each cloud remote
        const results = [];
        let allSuccessful = true;
        
        for (const cloudRemote of cloudRemotes) {
          try {
            // Get metadata for the remote to check for subfolder
            const metadata = this.configManager.getRemoteMetadata(cloudRemote);
            const subfolder = metadata && metadata.subfolder ? metadata.subfolder : '';
            
            // Construct source path
            const sourcePath = subfolder ? `${cloudRemote}:${subfolder}` : `${cloudRemote}:`;
            
            // Construct destination path with cloud storage name
            const destPath = `${pfRemoteName}:${bucketName}/user/${pfRemoteName}/${cloudRemote}`;
            
            // Construct the command
            const command = `"${settings.rclonePath}" sync "${sourcePath}" "${destPath}" --dry-run -P --config "${combinedConfigPath}"`;
            console.log(`Executing test command: ${command}`);
            
            // Execute the command
            const output = await new Promise((resolve, reject) => {
              exec(command, (error, stdout, stderr) => {
                if (error) {
                  console.log(`Command failed: ${error.message}`);
                  allSuccessful = false;
                  resolve({
                    remote: cloudRemote,
                    command: command,
                    success: false,
                    output: stderr || error.message
                  });
                  return;
                }
                
                resolve({
                  remote: cloudRemote,
                  command: command,
                  success: true,
                  output: stdout
                });
              });
            });
            
            results.push(output);
          } catch (error) {
            console.error(`Error testing connection for ${cloudRemote}:`, error);
            allSuccessful = false;
            results.push({
              remote: cloudRemote,
              success: false,
              error: error.message
            });
          }
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
            
            // Removed duplicate 'generate-sync-script' handler to fix the error
            // Set the selected local path as the subfolder metadata
            const metadata = {
              type: 'subfolder',
              subfolder: localPath
            };
            this.configManager.saveRemoteMetadata(name, metadata);
            console.log(`Set subfolder metadata for ${name} to ${localPath}`);

            // Refresh remotes list with a slight delay
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
  } catch (error) {
        console.error("Error deleting remote:", error);
        event.reply("delete-status", {
          success: false,
          message: `Failed to delete remote: ${error.message}`
        });
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

    // Handle close request
    ipcMain.on("close-app", () => {
      app.quit();
    });
  }

  // Initialize the application
  init() {
    app.whenReady().then(() => {
      this.createWindow();
      
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
  }
}

// Start the application
const cloudConfigApp = new CloudConfigApp();
cloudConfigApp.init();