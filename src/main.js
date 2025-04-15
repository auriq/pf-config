const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { spawn, exec } = require('child_process');
const { config, loadConfig, updateConfig } = require('./config');

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

// Keep track of all running processes
const runningProcesses = new Set();

// Log application mode
console.log(`Application mode: ${process.env.NODE_ENV || 'production'}`);
console.log(`Application is packaged: ${app.isPackaged}`);
console.log(`Current working directory: ${process.cwd()}`);
console.log(`App path: ${app.getAppPath()}`);
if (app.isPackaged) {
  console.log(`Resources path: ${process.resourcesPath}`);
}

// Load configuration
let appConfig = loadConfig();

// Log configuration
console.log('Loaded configuration:');
console.log(`  workspace_dir: ${appConfig.workspace_dir}`);
console.log(`  path_rclone: ${appConfig.path_rclone}`);
console.log(`  scripts_path: ${appConfig.scripts_path}`);

// Ensure workspace directory exists
try {
  fs.ensureDirSync(appConfig.workspace_dir);
  console.log(`Ensured workspace directory exists: ${appConfig.workspace_dir}`);
} catch (error) {
  console.error(`Error ensuring workspace directory exists: ${error.message}`);
}

// Save configuration
function saveConfig() {
  appConfig = updateConfig(appConfig);
}

// Create the main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Load the index.html file
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create window when Electron is ready
app.whenReady().then(() => {
  createWindow();

  // On macOS, recreate window when dock icon is clicked and no windows are open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Terminate all running processes before quitting
app.on('before-quit', () => {
  terminateAllProcesses();
  killAllRcloneProcesses();
});

// Terminate all running processes
function terminateAllProcesses() {
  console.log(`Terminating ${runningProcesses.size} running processes...`);
  
  // Terminate each process
  for (const process of runningProcesses) {
    try {
      // Check if process is still running
      if (process.exitCode === null) {
        // Kill the process
        process.kill();
        console.log(`Process ${process.pid} terminated.`);
      }
    } catch (error) {
      console.error(`Error terminating process ${process.pid}:`, error);
    }
  }
  
  // Clear the set
  runningProcesses.clear();
}

// Kill all rclone processes
function killAllRcloneProcesses() {
  return new Promise((resolve, reject) => {
    let command;
    
    // Platform-specific command to find and kill rclone processes
    if (process.platform === 'win32') {
      // Windows
      command = 'taskkill /F /IM rclone.exe';
    } else {
      // macOS and Linux
      command = "pkill -f 'rclone'";
    }
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        // Don't reject on error, as it might just mean no processes were found
        console.log('No rclone processes found to kill or error killing processes:', error.message);
      }
      
      if (stdout) {
        console.log('Killed rclone processes:', stdout);
      }
      
      resolve();
    });
  });
}

// IPC handlers for main process

// Get application configuration
ipcMain.handle('get-config', () => {
  return appConfig;
});

// Update application configuration
ipcMain.handle('update-config', (event, newConfig) => {
  appConfig = { ...appConfig, ...newConfig };
  saveConfig();
  return appConfig;
});

// Execute rclone command
ipcMain.handle('execute-rclone', async (event, command, args) => {
  return new Promise((resolve, reject) => {
    const rcloneProcess = spawn(appConfig.path_rclone, args);
    
    // Add to running processes
    runningProcesses.add(rcloneProcess);
    
    let stdout = '';
    let stderr = '';
    
    rcloneProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    rcloneProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    rcloneProcess.on('close', (code) => {
      // Remove from running processes
      runningProcesses.delete(rcloneProcess);
      
      if (code === 0) {
        resolve({ success: true, stdout, stderr });
      } else {
        resolve({ success: false, stdout, stderr, code });
      }
    });
    
    rcloneProcess.on('error', (error) => {
      // Remove from running processes
      runningProcesses.delete(rcloneProcess);
      
      reject({ success: false, error: error.message });
    });
  });
});

// Clean up rclone processes
ipcMain.handle('cleanup-rclone', async () => {
  try {
    await killAllRcloneProcesses();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Execute shell script
ipcMain.handle('execute-script', async (event, scriptPath, args = []) => {
  return new Promise((resolve, reject) => {
    console.log(`===== EXECUTE SCRIPT DEBUG INFO =====`);
    console.log(`Original script path: ${scriptPath}`);
    console.log(`Arguments: ${args.join(' ')}`);
    console.log(`App is packaged: ${app.isPackaged}`);
    console.log(`Process resourcesPath: ${process.resourcesPath}`);
    console.log(`Current directory: ${process.cwd()}`);
    console.log(`__dirname: ${__dirname}`);
    
    // Get the script filename
    const scriptFilename = path.basename(scriptPath);
    console.log(`Script filename: ${scriptFilename}`);
    
    // Resolve the script path for development and production modes
    let resolvedScriptPath;
    let scriptFound = false;
    
    // First, check if the script exists in the WORKSPACE_DIR
    const workspaceScriptPath = path.join(appConfig.workspace_dir, 'scripts', scriptFilename);
    console.log(`Checking for script in workspace: ${workspaceScriptPath}`);
    
    if (fs.existsSync(workspaceScriptPath)) {
      resolvedScriptPath = workspaceScriptPath;
      scriptFound = true;
      console.log(`Found script in workspace: ${resolvedScriptPath}`);
    } else {
      console.log(`Script not found in workspace, checking application directories`);
      
      // Check if we're in development or production
      if (app.isPackaged) {
        // In production, scripts are in the extraResources directory
        resolvedScriptPath = path.join(process.resourcesPath, 'scripts', scriptFilename);
        console.log(`Production mode: Resolved script path to ${resolvedScriptPath}`);
      } else {
        // In development, scripts are in the scripts directory
        resolvedScriptPath = path.join(app.getAppPath(), 'scripts', scriptFilename);
        console.log(`Development mode: Resolved script path to ${resolvedScriptPath}`);
      }
    }
    
    // Check if script exists (if we haven't already confirmed it)
    try {
      if (!scriptFound && !fs.existsSync(resolvedScriptPath)) {
        console.error(`Script does not exist: ${resolvedScriptPath}`);
        return reject({ success: false, error: `Script not found: ${resolvedScriptPath}` });
      }
      
      console.log(`Script exists: ${resolvedScriptPath}`);
      
      // Make sure script is executable
      try {
        fs.chmodSync(resolvedScriptPath, '755');
        console.log(`Made script executable: ${resolvedScriptPath}`);
      } catch (chmodErr) {
        console.warn(`Warning: Could not set executable permissions on script: ${chmodErr.message}`);
      }
    } catch (error) {
      console.error(`Error checking script: ${error.message}`);
      return reject({ success: false, error: `Error checking script: ${error.message}` });
    }
    
    // Set up environment variables
    const env = {
      ...process.env,
      WORKDIR: appConfig.workspace_dir,
      PATH_RCLONE: appConfig.path_rclone,
      // Add PATH to ensure system commands are available
      PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'
    };
    
    // Add SCRIPTS_PATH if it exists in appConfig
    if (appConfig.scripts_path) {
      env.SCRIPTS_PATH = appConfig.scripts_path;
      console.log(`Added SCRIPTS_PATH to environment: ${env.SCRIPTS_PATH}`);
    }
    
    console.log(`Environment variables for script execution:`);
    console.log(`WORKDIR: ${env.WORKDIR}`);
    console.log(`PATH_RCLONE: ${env.PATH_RCLONE}`);
    if (env.SCRIPTS_PATH) console.log(`SCRIPTS_PATH: ${env.SCRIPTS_PATH}`);
    
    // Execute the script using exec instead of spawn
    console.log(`Executing script: ${resolvedScriptPath} with args: ${args.join(' ')}`);
    
    // Construct the command
    let command;
    if (process.platform === 'darwin' && resolvedScriptPath.endsWith('.sh')) {
      command = `bash "${resolvedScriptPath}" ${args.join(' ')}`;
    } else if (process.platform === 'win32' && resolvedScriptPath.endsWith('.ps1')) {
      command = `powershell -ExecutionPolicy Bypass -File "${resolvedScriptPath}" ${args.join(' ')}`;
    } else {
      command = `"${resolvedScriptPath}" ${args.join(' ')}`;
    }
    
    console.log(`Executing command: ${command}`);
    
    // Execute the command
    exec(command, { env }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing script: ${error.message}`);
        console.error(`stderr: ${stderr}`);
        resolve({ success: false, error: error.message, stderr });
        return;
      }
      
      console.log(`Script executed successfully`);
      console.log(`stdout: ${stdout}`);
      resolve({ success: true, stdout, stderr });
    });
  });
});

// Open file dialog
ipcMain.handle('open-file-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

// Read log file
ipcMain.handle('read-log', async (event, logName) => {
  const logPath = path.join(appConfig.workspace_dir, `${logName}.log`);
  
  if (!fs.existsSync(logPath)) {
    return { success: false, error: 'Log file does not exist' };
  }
  
  try {
    const content = await fs.readFile(logPath, 'utf8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Read configuration file
ipcMain.handle('read-config-file', async (event, configName) => {
  const configPath = path.join(appConfig.workspace_dir, `${configName}.conf`);
  
  if (!fs.existsSync(configPath)) {
    return { success: false, error: 'Configuration file does not exist' };
  }
  
  try {
    const content = await fs.readFile(configPath, 'utf8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Write configuration file
ipcMain.handle('write-config-file', async (event, configName, content) => {
  const configPath = path.join(appConfig.workspace_dir, `${configName}.conf`);
  
  try {
    await fs.writeFile(configPath, content, 'utf8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Copy configuration file
ipcMain.handle('copy-config-file', async (event, sourcePath, configName) => {
  const destPath = path.join(appConfig.workspace_dir, `${configName}.conf`);
  
  try {
    await fs.copy(sourcePath, destPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Read remote metadata
ipcMain.handle('read-remote-metadata', async () => {
  const metadataPath = path.join(appConfig.workspace_dir, 'remote-meta.json');
  
  try {
    if (fs.existsSync(metadataPath)) {
      const metadata = await fs.readJson(metadataPath);
      return { success: true, metadata };
    } else {
      // Create empty metadata file if it doesn't exist
      await fs.writeJson(metadataPath, {}, { spaces: 2 });
      return { success: true, metadata: {} };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Update remote metadata
ipcMain.handle('update-remote-metadata', async (event, remoteName, metadata) => {
  const metadataPath = path.join(appConfig.workspace_dir, 'remote-meta.json');
  
  try {
    let allMetadata = {};
    
    // Read existing metadata if file exists
    if (fs.existsSync(metadataPath)) {
      allMetadata = await fs.readJson(metadataPath);
    }
    
    // Update metadata for the specified remote
    allMetadata[remoteName] = metadata;
    
    // Write updated metadata back to file
    await fs.writeJson(metadataPath, allMetadata, { spaces: 2 });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Delete remote metadata
ipcMain.handle('delete-remote-metadata', async (event, remoteName) => {
  const metadataPath = path.join(appConfig.workspace_dir, 'remote-meta.json');
  
  try {
    if (fs.existsSync(metadataPath)) {
      const allMetadata = await fs.readJson(metadataPath);
      
      // Delete metadata for the specified remote
      if (allMetadata[remoteName]) {
        delete allMetadata[remoteName];
        
        // Write updated metadata back to file
        await fs.writeJson(metadataPath, allMetadata, { spaces: 2 });
      }
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Exit application
ipcMain.handle('exit-app', () => {
  terminateAllProcesses();
  killAllRcloneProcesses();
  app.quit();
});