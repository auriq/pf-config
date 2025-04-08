const { exec } = require("child_process");
const path = require("path");
const fs = require('fs-extra');
const { shell } = require("electron");

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
    // Use the environment module to get the app config directory
    try {
      const env = require('../config/environment');
      
      // Use the app config directory for config files
      // This ensures we use the same config files in development and production
      console.log(`[CONFIG_DEBUG] Using app config directory for config: ${env.PATHS.appConfig}`);
      
      // Log the environment mode
      console.log(`[CONFIG_DEBUG] Running in ${env.IS_DEV ? 'development' : 'production'} mode`);
      
      // Log the USER_DATA_DIR
      console.log(`[CONFIG_DEBUG] USER_DATA_DIR: ${env.USER_DATA_DIR}`);
      
      return env.PATHS.appConfig;
    } catch (error) {
      console.error('Failed to load environment module, using fallback path');
      const userHome = process.env.HOME || process.env.USERPROFILE;
      // On Windows, use AppData\Roaming instead of .config
      return process.platform === 'win32'
        ? path.join(userHome, 'AppData', 'Roaming', 'pf-config')
        : path.join(userHome, '.config', 'pf-config');
    }
  }
// Get the rclone config file path
getRcloneConfigPath() {
  const configPath = path.join(this.appConfigDir, 'cloud.conf');
  console.log(`[CONFIG_DEBUG] Using rclone config path: ${configPath}`);
  
  // Check if the file exists
  try {
    const fs = require('fs-extra');
    const exists = fs.existsSync(configPath);
    console.log(`[CONFIG_DEBUG] Config file exists: ${exists}`);
    
    if (exists) {
      // Try to read the file to make sure it's accessible
      try {
        const content = fs.readFileSync(configPath, 'utf8');
        console.log(`[CONFIG_DEBUG] Successfully read config file, content length: ${content.length} bytes`);
      } catch (readError) {
        console.error(`[CONFIG_DEBUG] Error reading config file: ${readError.message}`);
      }
    } else {
      // Log the directory contents
      try {
        console.log(`[CONFIG_DEBUG] Listing directory contents of: ${this.appConfigDir}`);
        const files = fs.readdirSync(this.appConfigDir);
        files.forEach(file => {
          console.log(`[CONFIG_DEBUG] - ${file}`);
        });
      } catch (dirError) {
        console.error(`[CONFIG_DEBUG] Error listing directory: ${dirError.message}`);
      }
    }
  } catch (error) {
    console.error(`[CONFIG_DEBUG] Error checking config file: ${error.message}`);
  }
  
  return configPath;
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
      console.error('Error getting remote metadata [Error details hidden]');
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
      console.error('Error getting all remotes metadata [Error details hidden]');
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
      console.error('Error saving remote metadata [Error details hidden]');
      return false;
    }
  }
  
  // Delete metadata for a specific remote
  deleteRemoteMetadata(remoteName) {
    try {
      const metadataPath = this.getMetadataPath();
      if (!fs.existsSync(metadataPath)) {
        console.log(`Metadata file does not exist at ${metadataPath}, no need to delete anything`);
        return true;
      }
      
      console.log(`Deleting metadata for ${remoteName} from ${metadataPath}`);
      
      const allMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      
      if (allMetadata.remotes && allMetadata.remotes[remoteName]) {
        console.log(`Found metadata for ${remoteName}, deleting it`);
        delete allMetadata.remotes[remoteName];
        fs.writeFileSync(metadataPath, JSON.stringify(allMetadata, null, 2));
        console.log(`Successfully deleted metadata for ${remoteName}`);
      } else {
        console.log(`No metadata found for ${remoteName} in ${metadataPath}`);
      }
      
      return true;
    } catch (error) {
      console.error(`Error deleting remote metadata for ${remoteName}: ${error.message}`);
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
          // Don't include sensitive information like tokens
          if (key === 'token') {
            config[key] = '[TOKEN HIDDEN]';
          } else {
            config[key] = value;
          }
        }
      });
      // Don't log config to avoid printing sensitive tokens
      console.log(`Config for ${remoteName}: [Config details hidden]`);
      return config;
    } catch (error) {
      console.error(`Error getting remote config for ${remoteName} [Error details hidden]`);
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
    // Get platform-specific default rclone path from environment module
    let DEFAULT_RCLONE_PATH;
    try {
      const env = require('../config/environment');
      const platformConfig = env.getPlatformConfig();
      DEFAULT_RCLONE_PATH = platformConfig.commonRclonePaths[0]; // Use first path as default
    } catch (error) {
      // Fallback if environment module is not available
      DEFAULT_RCLONE_PATH = process.platform === 'win32'
        ? 'C:\\Program Files\\rclone\\rclone.exe'
        : '/usr/local/bin/rclone';
    }
    
    if (fs.existsSync(this.settingsPath)) {
      return JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
    }
    
    // Try default path first based on platform
    if (fs.existsSync(DEFAULT_RCLONE_PATH)) {
      const settings = { rclonePath: DEFAULT_RCLONE_PATH };
      this.saveSettings(settings);
      return settings;
    }
    
    // Try additional common paths for Windows
    if (process.platform === 'win32') {
      const windowsPaths = [
        path.join(process.env.USERPROFILE, 'AppData', 'Local', 'rclone', 'rclone.exe'),
        path.join(process.env.ProgramFiles, 'rclone', 'rclone.exe'),
        path.join(process.env.ProgramFiles + ' (x86)', 'rclone', 'rclone.exe')
      ];
      
      for (const rcPath of windowsPaths) {
        if (fs.existsSync(rcPath)) {
          const settings = { rclonePath: rcPath };
          this.saveSettings(settings);
          return settings;
        }
      }
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
      console.log('[REMOTES_DEBUG] Starting listRemotes method');
      console.log(`[REMOTES_DEBUG] Config file path: ${this.configPath}`);
      
      // Check if config file exists and log its content
      if (fs.existsSync(this.configPath)) {
        const configContent = fs.readFileSync(this.configPath, 'utf8');
        console.log(`[REMOTES_DEBUG] Config file exists, content length: ${configContent.length} bytes`);
        console.log(`[REMOTES_DEBUG] Config file content: ${configContent}`);
      } else {
        console.log(`[REMOTES_DEBUG] Config file does not exist at: ${this.configPath}`);
      }
      
      const settings = this.getSettings();
      console.log(`[REMOTES_DEBUG] Settings: ${JSON.stringify(settings)}`);
      
      // Detailed validation and logging for rclone path
      if (!settings.rclonePath) {
        console.warn('[REMOTES_DEBUG] CRITICAL: Rclone path not configured in settings');
        return { remotes: [], error: 'Rclone path not configured in settings' };
      }
      
      console.log(`Using rclone path: ${settings.rclonePath}`);
      
      // Check if rclone executable exists and is accessible
      if (!fs.existsSync(settings.rclonePath)) {
        console.error(`CRITICAL: Rclone executable not found at path: ${settings.rclonePath}`);
        return { remotes: [], error: `Rclone executable not found at: ${settings.rclonePath}` };
      }
      
      // Check if executable has proper permissions
      try {
        fs.accessSync(settings.rclonePath, fs.constants.X_OK);
        console.log(`Rclone executable has proper execution permissions`);
      } catch (permError) {
        console.error(`CRITICAL: Rclone executable lacks execution permissions: ${permError.message}`);
        return { remotes: [], error: `Rclone executable lacks execution permissions` };
      }
      
      // Validate config file
      if (!fs.existsSync(this.configPath)) {
        console.warn(`CRITICAL: Config file not found at ${this.configPath}`);
        return { remotes: [], error: `Config file not found at ${this.configPath}` };
      }
      
      // Check if config file is readable
      try {
        const configContent = fs.readFileSync(this.configPath, 'utf8');
        if (!configContent.trim()) {
          console.warn(`CRITICAL: Config file is empty at ${this.configPath}`);
          return { remotes: [], error: `Config file is empty` };
        }
        console.log(`Config file exists and is readable`);
      } catch (readError) {
        console.error(`CRITICAL: Cannot read config file: ${readError.message}`);
        return { remotes: [], error: `Cannot read config file: ${readError.message}` };
      }
      
      // Use spawn instead of exec for better control and to avoid shell injection
      console.log(`Spawning rclone process to list remotes...`);
      
      const { spawn } = require('child_process');
      
      const output = await new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        
        // Use spawn with explicit arguments to avoid shell injection
        const rcloneProcess = spawn(settings.rclonePath, [
          '--config', this.configPath,
          'listremotes'
        ]);
        
        rcloneProcess.stdout.on('data', (data) => {
          stdout += data.toString();
          console.log(`Received stdout data from rclone: ${data.length} bytes`);
        });
        
        rcloneProcess.stderr.on('data', (data) => {
          stderr += data.toString();
          console.error(`Received stderr from rclone: ${data.toString()}`);
          
          // Check for OAuth URLs in stderr
          if (stderr.includes('http://127.0.0.1:') ||
              stderr.includes('https://accounts.google.com/o/oauth2/')) {
            console.error('CRITICAL: OAuth authentication URL detected - this requires user interaction');
          }
        });
        
        rcloneProcess.on('error', (err) => {
          console.error(`CRITICAL: Failed to start rclone process: ${err.message}`);
          resolve({ stdout: '', stderr: err.message, error: err });
        });
        
        rcloneProcess.on('close', (code) => {
          console.log(`Rclone process exited with code ${code}`);
          if (code !== 0) {
            console.error(`CRITICAL: Rclone process failed with code ${code}`);
            resolve({ stdout, stderr, error: `Process exited with code ${code}` });
          } else {
            resolve({ stdout, stderr });
          }
        });
      });
      
      // Handle potential errors from the process
      if (output.error) {
        console.error(`Error executing rclone: ${output.error}`);
        return { remotes: [], error: `Error executing rclone: ${output.error}` };
      }
      
      // Check for stderr output
      if (output.stderr && output.stderr.trim()) {
        console.warn(`Rclone produced stderr output: ${output.stderr}`);
        // If stderr contains OAuth URLs, this is likely the root cause
        if (output.stderr.includes('http://127.0.0.1:') ||
            output.stderr.includes('https://accounts.google.com/o/oauth2/')) {
          return {
            remotes: [],
            error: 'OAuth authentication required. Please run rclone config in terminal first to authenticate.'
          };
        }
      }
      
      // Parse the output
      const remotes = output.stdout && output.stdout.trim()
        ? output.stdout.trim().split('\n').map(remote => remote.replace(':', ''))
        : [];
      
      console.log(`Found ${remotes.length} remotes from rclone command`);
      
      // If no remotes were found using rclone command, try to parse the config file directly
      if (remotes.length === 0) {
        console.log(`[REMOTES_DEBUG] No remotes found using rclone command, trying to parse config file directly`);
        try {
          if (fs.existsSync(this.configPath)) {
            const configContent = fs.readFileSync(this.configPath, 'utf8');
            console.log(`[REMOTES_DEBUG] Config file content for direct parsing: ${configContent}`);
            
            // Use regex to find all remote sections in the config file
            const remoteSections = configContent.match(/\[([^\]]+)\]/g);
            if (remoteSections && remoteSections.length > 0) {
              const parsedRemotes = remoteSections.map(section => section.replace('[', '').replace(']', ''));
              console.log(`[REMOTES_DEBUG] Found ${parsedRemotes.length} remotes by direct parsing: ${parsedRemotes.join(', ')}`);
              return { remotes: parsedRemotes };
            } else {
              console.log(`[REMOTES_DEBUG] No remote sections found in config file by direct parsing`);
            }
          } else {
            console.log(`[REMOTES_DEBUG] Config file does not exist for direct parsing: ${this.configPath}`);
          }
        } catch (parseError) {
          console.error(`[REMOTES_DEBUG] Error parsing config file directly: ${parseError.message}`);
        }
      }
      
      return { remotes };
    } catch (error) {
      console.error(`CRITICAL: Unexpected error listing remotes: ${error.message}`);
      
      // Try to parse the config file directly as a fallback
      console.log(`[REMOTES_DEBUG] Error occurred, trying to parse config file directly as fallback`);
      try {
        if (fs.existsSync(this.configPath)) {
          const configContent = fs.readFileSync(this.configPath, 'utf8');
          console.log(`[REMOTES_DEBUG] Config file content for fallback parsing: ${configContent}`);
          
          // Use regex to find all remote sections in the config file
          const remoteSections = configContent.match(/\[([^\]]+)\]/g);
          if (remoteSections && remoteSections.length > 0) {
            const parsedRemotes = remoteSections.map(section => section.replace('[', '').replace(']', ''));
            console.log(`[REMOTES_DEBUG] Found ${parsedRemotes.length} remotes by fallback parsing: ${parsedRemotes.join(', ')}`);
            return { remotes: parsedRemotes };
          }
        }
      } catch (fallbackError) {
        console.error(`[REMOTES_DEBUG] Error in fallback parsing: ${fallbackError.message}`);
      }
      
      return { remotes: [], error: `Unexpected error: ${error.message}` };
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

      console.log(`Executing rclone command [Command details hidden]`);
      
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
          console.error(`Rclone error occurred [Error details hidden]`);
          console.error(`Stderr received [Details hidden]`);
          
          // Provider-specific error handling
          if (stderr.includes('oauth2: cannot fetch token')) {
            reject('Authentication failed. Please check your credentials and try again.');
          } else if (stderr.includes('quota')) {
            reject('Storage quota exceeded. Please free up space or upgrade your plan.');
          } else {
            reject(stderr || error.message);
          }
        } else {
          console.log(`Rclone command completed successfully`);
          resolve(stdout);
        }
      });

      rcloneProcess.stdout.on('data', (data) => {
        console.log(`Rclone stdout received data`);
        
        // Handle provider-specific interactive prompts
        if (data.includes('Enter a team drive ID')) {
          rcloneProcess.stdin.write('\n'); // Skip team drive selection
        }
      });

      rcloneProcess.stderr.on('data', (data) => {
        const output = data.toString();
        console.error(`Rclone stderr received data`);
        
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
            console.log(`Opening OAuth URL from executeRclone [URL hidden]`);
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
  async checkRemote(remoteName, options = {}) {
    try {
      console.log(`Checking remote: ${remoteName}`);
      // Check if there's a subfolder restriction in metadata
      const metadata = this.getRemoteMetadata(remoteName);
      console.log(`Remote metadata: [Metadata details hidden]`);
      
      // Use the sync-handler module for testing
      const syncHandler = require('./sync-handler');
      
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
      
      // Get total number of files
      console.log(`Executing size command...`);
      const listOutput = await this.executeRclone(`size ${pathPrefix}`);
      console.log(`Size command completed successfully`);
      
      // Get directories only using lsd command, or all files using ls command
      const useLsCommand = options.useLsCommand || false;
      const listCommand = useLsCommand ? 'ls' : 'lsd';
      console.log(`Executing ${listCommand} command...`);
      // lsd lists directories instead of files, which is more efficient than using --max-depth
      const recentDirs = await this.executeRclone(`${listCommand} ${pathPrefix}`);
      console.log(`List command result length: ${recentDirs ? recentDirs.length : 0} characters`);
      
      // Set header based on command type
      const header = options.useLsCommand
        ? "        Files\n" +
          "----------------------------------------\n"
        : "        Date       Time    Directory\n" +
          "----------------------------------------\n";
      // Process the directories/files list if we have data
      let topDirs = header;
      
      if (recentDirs && recentDirs.trim()) {
        const processedLines = recentDirs.split('\n')
          .filter(line => line.trim())
          .map(line => {
            if (options.useLsCommand) {
              // Format for ls: path/to/file
              return `           ${line}`;
            } else {
              // Format for lsd: -1 YYYY-MM-DD HH:MM:SS -1 dirname
              const match = line.match(/^-1\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})(?:\.\d+)?\s+-1\s+(.+?)$/);
              if (match) {
                const [_, date, time, dirname] = match;
                return `           ${date} ${time}  ${dirname}`;
              }
              return line;
            }
          })
          .slice(0, 100);
        
        // Get all lines and count them
        const allLines = recentDirs.split('\n').filter(line => line.trim());
        const totalDirsCount = allLines.length;
        
        // Process only the first 100 lines
        const processedLinesLimited = processedLines.slice(0, 100);
        
        if (processedLinesLimited.length > 0) {
          // Add header with count information
          const itemType = options.useLsCommand ? 'files' : 'directories';
          if (totalDirsCount > 100) {
            topDirs += `Showing top 100 of ${totalDirsCount} ${itemType}:\n\n`;
          } else {
            topDirs += `Showing all ${totalDirsCount} ${itemType}:\n\n`;
          }
          
          topDirs += processedLinesLimited.join('\n');
        } else {
          const itemType = options.useLsCommand ? 'files' : 'directories';
          topDirs += `No ${itemType} found`;
        }
      } else {
        const itemType = options.useLsCommand ? 'files' : 'directories';
        topDirs += `No ${itemType} found`;
      }
      
      console.log('Processed directory listing complete');
      
      // Get the PageFinder remote name and bucket name
      const pfConfigPath = path.join(this.appConfigDir, 'pf.conf');
      let pfRemoteName = '';
      
      if (fs.existsSync(pfConfigPath)) {
        const pfConfigContent = fs.readFileSync(pfConfigPath, 'utf8');
        const remoteMatch = pfConfigContent.match(/\[([^\]]+)\]/);
        if (remoteMatch) {
          pfRemoteName = remoteMatch[1];
        }
      }
      
      // Combine configs for testing
      const combinedConfigPath = path.join(this.appConfigDir, 'rclone.conf');
      const cloudConfigPath = this.configPath;
      
      if (fs.existsSync(cloudConfigPath) && fs.existsSync(pfConfigPath)) {
        const cloudConfig = fs.readFileSync(cloudConfigPath, 'utf8');
        const pfConfig = fs.readFileSync(pfConfigPath, 'utf8');
        fs.writeFileSync(combinedConfigPath, cloudConfig + '\n' + pfConfig);
      }
      
      // Get settings for rclone path
      const settings = this.getSettings();
      
      // We no longer check for orphan folders here as per user request
      // The check remote function should only deal with remote storage
      console.log('Skipping orphan folder check in checkRemote function');
      
      return {
        name: remoteName,
        metadata: metadata,
        type: remoteConfig ? remoteConfig.type : 'unknown',
        path: remoteConfig && remoteConfig.type === 'local' ? remoteConfig.path : null,
        summary: listOutput || "Could not retrieve size information",
        recentFiles: topDirs
      };
    } catch (error) {
      console.error('Error in checkRemote [Error details hidden]');
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

module.exports = ConfigManager;