const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { spawn, exec } = require('child_process');
const { config, loadConfig, updateConfig } = require('./config');

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

// Keep track of all running processes
const runningProcesses = new Set();

// Load configuration
let appConfig = loadConfig();

// Ensure workspace directory exists
fs.ensureDirSync(appConfig.workspace_dir);

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
    const scriptProcess = spawn(scriptPath, args, {
      env: {
        ...process.env,
        WORKDIR: appConfig.workspace_dir,
        PATH_RCLONE: appConfig.path_rclone
      }
    });
    
    // Add to running processes
    runningProcesses.add(scriptProcess);
    
    let stdout = '';
    let stderr = '';
    
    scriptProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    scriptProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    scriptProcess.on('close', (code) => {
      // Remove from running processes
      runningProcesses.delete(scriptProcess);
      
      if (code === 0) {
        resolve({ success: true, stdout, stderr });
      } else {
        resolve({ success: false, stdout, stderr, code });
      }
    });
    
    scriptProcess.on('error', (error) => {
      // Remove from running processes
      runningProcesses.delete(scriptProcess);
      
      reject({ success: false, error: error.message });
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