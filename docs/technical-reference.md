# PageFinder Configuration Utility - Technical Reference

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Application Structure](#2-application-structure)
3. [Main Process](#3-main-process)
4. [Renderer Process](#4-renderer-process)
5. [IPC Communication](#5-ipc-communication)
6. [Configuration Files](#6-configuration-files)
7. [rclone Integration](#7-rclone-integration)
8. [Shell Scripts](#8-shell-scripts)
9. [Build and Distribution](#9-build-and-distribution)
10. [Extending the Application](#10-extending-the-application)

## 1. Architecture Overview

The PageFinder Configuration Utility is built using Electron, a framework for creating native applications with web technologies. The application follows Electron's process model:

- **Main Process**: Handles system-level operations, file I/O, and spawns the renderer process
- **Renderer Process**: Manages the user interface and user interactions
- **Preload Scripts**: Securely expose APIs from the main process to the renderer process

### 1.1 Technology Stack

- **Framework**: Electron.js (v28.x)
- **Frontend**: HTML, CSS, JavaScript (vanilla)
- **Backend**: Node.js for file operations and process management
- **Build System**: electron-builder for packaging and distribution
- **Dependencies**:
  - `electron-log`: For application logging
  - `fs-extra`: Enhanced file system operations
  - `dotenv`: Environment variable management

### 1.2 Data Flow

1. User interacts with the UI in the renderer process
2. Renderer process sends requests to the main process via IPC
3. Main process executes rclone commands or shell scripts
4. Results are sent back to the renderer process for display
5. Configuration files are stored in the workspace directory

## 2. Application Structure

```
pf-config/
├── build/                  # Build resources
│   ├── icon.icns           # macOS app icon
│   ├── icon.png            # Source icon
│   ├── entitlements.mac.plist      # macOS entitlements
│   └── entitlements.mac.inherit.plist  # macOS inherited entitlements
├── dist/                   # Distribution output
├── docs/                   # Documentation
├── scripts/                # Shell scripts
│   ├── debug-config.js     # Debug configuration
│   ├── debug-production.sh # Debug production build
│   ├── env-loader.sh       # Environment loader
│   ├── fix-permissions.sh  # Fix script permissions
│   ├── generate-icons.js   # Generate app icons
│   ├── notarize.js         # macOS notarization
│   ├── prepare-for-build.js # Pre-build preparation
│   ├── purge-workspace.sh  # Purge orphaned folders
│   ├── setup-sync-cron.sh  # Setup cron job
│   └── sync-workspace.sh   # Synchronize files
├── src/                    # Source code
│   ├── config.js           # Configuration management
│   ├── main.js             # Main process entry point
│   ├── pflogo.png          # Application logo
│   ├── preload/            # Preload scripts
│   │   └── preload.js      # Preload script for IPC
│   └── renderer/           # Renderer process
│       ├── index.html      # Main HTML file
│       ├── index.js        # Renderer entry point
│       └── styles/         # CSS styles
│           └── main.css    # Main stylesheet
├── test/                   # Test files
├── .gitignore              # Git ignore file
├── LICENSE                 # License file
├── package.json            # Project configuration
└── README.md               # Project documentation
```

## 3. Main Process

The main process (`src/main.js`) is the entry point of the application and is responsible for:

- Creating and managing the application window
- Loading configuration from environment variables and config files
- Providing IPC handlers for the renderer process
- Executing rclone commands and shell scripts
- Managing file operations

### 3.1 Key Components

#### 3.1.1 Window Management

```javascript
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

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}
```

#### 3.1.2 Process Management

The application maintains a set of running processes and ensures they are properly terminated when the application exits:

```javascript
// Keep track of all running processes
const runningProcesses = new Set();

// Terminate all running processes
function terminateAllProcesses() {
  console.log(`Terminating ${runningProcesses.size} running processes...`);
  
  for (const process of runningProcesses) {
    try {
      if (process.exitCode === null) {
        process.kill();
      }
    } catch (error) {
      console.error(`Error terminating process ${process.pid}:`, error);
    }
  }
  
  runningProcesses.clear();
}
```

#### 3.1.3 rclone Process Management

The application provides a specific function for killing rclone processes:

```javascript
function killAllRcloneProcesses() {
  return new Promise((resolve, reject) => {
    let command;
    
    if (process.platform === 'win32') {
      command = 'taskkill /F /IM rclone.exe';
    } else {
      command = "pkill -f 'rclone'";
    }
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.log('No rclone processes found to kill or error killing processes:', error.message);
      }
      
      resolve();
    });
  });
}
```

### 3.2 IPC Handlers

The main process provides IPC handlers for various operations:

- `get-config`: Get application configuration
- `update-config`: Update application configuration
- `execute-rclone`: Execute rclone command
- `cleanup-rclone`: Clean up rclone processes
- `execute-script`: Execute shell script
- `open-file-dialog`: Open file dialog
- `read-log`: Read log file
- `read-config-file`: Read configuration file
- `write-config-file`: Write configuration file
- `copy-config-file`: Copy configuration file
- `read-remote-metadata`: Read remote metadata
- `update-remote-metadata`: Update remote metadata
- `delete-remote-metadata`: Delete remote metadata
- `exit-app`: Exit application

## 4. Renderer Process

The renderer process (`src/renderer/index.js`) is responsible for:

- Rendering the user interface
- Handling user interactions
- Communicating with the main process via IPC
- Displaying results and feedback to the user

### 4.1 Key Components

#### 4.1.1 Navigation

```javascript
navItems.forEach(item => {
  item.addEventListener('click', () => {
    // Remove active class from all items
    navItems.forEach(navItem => navItem.classList.remove('active'));

    // Add active class to clicked item
    item.classList.add('active');

    // Show corresponding content section
    const sectionId = item.getAttribute('data-section');
    contentSections.forEach(section => {
      section.classList.remove('active');
      if (section.id === sectionId) {
        section.classList.add('active');
      }
    });
  });
});
```

#### 4.1.2 Cloud Storage Management

The renderer process provides functions for managing cloud storage connections:

- `loadCloudList()`: Load the list of cloud storage connections
- `checkRemote()`: Test the connection to a cloud storage
- `deleteRemote()`: Delete a cloud storage connection
- `saveSubfolder()`: Save subfolder configuration for a remote

#### 4.1.3 Synchronization

The renderer process provides functions for synchronization:

- `testSync()`: Test synchronization without transferring files
- `executeSync()`: Execute synchronization and transfer files

#### 4.1.4 Notification System

The application includes a notification system for providing feedback to the user:

```javascript
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  notificationContainer.appendChild(notification);
  
  // Remove notification after 5 seconds
  setTimeout(() => {
    notification.style.animation = 'fadeOut 0.5s ease-out forwards';
    setTimeout(() => {
      notification.remove();
    }, 500);
  }, 5000);
}
```

## 5. IPC Communication

The application uses Electron's IPC (Inter-Process Communication) system to enable secure communication between the renderer process and the main process.

### 5.1 Preload Script

The preload script (`src/preload/preload.js`) exposes a secure API to the renderer process:

```javascript
contextBridge.exposeInMainWorld(
  'api', {
    // App configuration
    getConfig: () => ipcRenderer.invoke('get-config'),
    updateConfig: (config) => ipcRenderer.invoke('update-config', config),

    // App control
    exitApp: () => ipcRenderer.invoke('exit-app'),

    // rclone operations
    executeRclone: (command, args) => ipcRenderer.invoke('execute-rclone', command, args),
    cleanupRclone: () => ipcRenderer.invoke('cleanup-rclone'),

    // Script execution
    executeScript: (scriptPath, args) => ipcRenderer.invoke('execute-script', scriptPath, args),

    // File operations
    openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),
    readLog: (logName) => ipcRenderer.invoke('read-log', logName),
    readConfigFile: (configName) => ipcRenderer.invoke('read-config-file', configName),
    writeConfigFile: (configName, content) => ipcRenderer.invoke('write-config-file', configName, content),
    copyConfigFile: (sourcePath, configName) => ipcRenderer.invoke('copy-config-file', sourcePath, configName),

    // Remote metadata operations
    readRemoteMetadata: () => ipcRenderer.invoke('read-remote-metadata'),
    updateRemoteMetadata: (remoteName, metadata) => ipcRenderer.invoke('update-remote-metadata', remoteName, metadata),
    deleteRemoteMetadata: (remoteName) => ipcRenderer.invoke('delete-remote-metadata', remoteName),

    // Higher-level operations
    addCloud: async (remoteName, type) => { /* ... */ },
    listCloud: async () => { /* ... */ },
    checkRemote: async (remoteName, listFiles = false) => { /* ... */ },
    deleteRemote: async (remoteName) => { /* ... */ },
    testPageFinderConnection: async () => { /* ... */ },
    runPurgeTest: async () => { /* ... */ },
    runPurgeExec: async () => { /* ... */ },
    runSyncTest: async () => { /* ... */ },
    runSyncExec: async () => { /* ... */ },
    setupSchedule: async (time) => { /* ... */ }
  }
);
```

### 5.2 Renderer Process API Usage

The renderer process uses the exposed API to communicate with the main process:

```javascript
// Example: Get configuration
const config = await window.api.getConfig();

// Example: Execute rclone command
const result = await window.api.executeRclone('lsd', ['remote:', '--config', configPath]);

// Example: Update remote metadata
await window.api.updateRemoteMetadata(remoteName, { type: remoteType });
```

## 6. Configuration Files

The application uses several configuration files:

### 6.1 Application Configuration

The application configuration is stored in:
- `.env`: Environment variables
- `app-config.json`: Application settings

The configuration is managed by the `config.js` module:

```javascript
// Default configuration values
const defaultConfig = {
  path_rclone: process.platform === 'win32' ? 'rclone.exe' : '/usr/local/bin/rclone',
  workspace_dir: process.platform === 'win32' ? path.join(os.homedir(), 'AppData', 'Roaming', 'pf-config') : '/tmp/pf-workspace',
  scripts_path: path.join(process.cwd(), 'scripts')
};

// Load configuration from environment variables
const envConfig = {
  path_rclone: process.env.RCLONE_PATH,
  workspace_dir: process.env.WORKSPACE_DIR,
  scripts_path: process.env.SCRIPTS_PATH
};

// Merge default and environment configurations
let config = {
  ...defaultConfig,
  ...Object.fromEntries(
    Object.entries(envConfig).filter(([_, value]) => value !== undefined)
  )
};
```

### 6.2 rclone Configuration Files

The application manages two rclone configuration files:

- `cloud.conf`: Contains cloud storage configurations
- `pf.conf`: Contains PageFinder configuration

These files are stored in the workspace directory and are used by rclone commands.

### 6.3 Remote Metadata

The application stores metadata about remote connections in `remote-meta.json`:

```json
{
  "remote1": {
    "type": "drive",
    "subfolder": "/documents"
  },
  "remote2": {
    "type": "onedrive",
    "subfolder": "/photos"
  }
}
```

## 7. rclone Integration

The application integrates with rclone to manage cloud storage connections and file operations.

### 7.1 rclone Commands

The application uses various rclone commands:

- `rclone config create`: Create a new remote
- `rclone lsd`: List directories in a remote
- `rclone ls`: List files in a remote
- `rclone copy`: Copy files between remotes
- `rclone sync`: Synchronize files between remotes

### 7.2 Command Execution

The application executes rclone commands using Node.js child processes:

```javascript
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
```

## 8. Shell Scripts

The application uses several shell scripts for various operations:

### 8.1 Purge Script

The `purge-workspace.sh` script removes orphaned folders from PageFinder:

```bash
#!/bin/bash
# purge-workspace.sh
# Removes orphaned folders from PageFinder

# Load environment variables
source "$(dirname "$0")/env-loader.sh"

# Check if -e flag is provided for execution
EXECUTE=false
if [ "$1" = "-e" ]; then
  EXECUTE=true
fi

# ... script implementation ...
```

### 8.2 Sync Script

The `sync-workspace.sh` script synchronizes files between cloud storage and PageFinder:

```bash
#!/bin/bash
# sync-workspace.sh
# Synchronizes files between cloud storage and PageFinder

# Load environment variables
source "$(dirname "$0")/env-loader.sh"

# Check if -e flag is provided for execution
EXECUTE=false
if [ "$1" = "-e" ]; then
  EXECUTE=true
fi

# ... script implementation ...
```

### 8.3 Script Execution

The application executes shell scripts using Node.js child processes:

```javascript
ipcMain.handle('execute-script', async (event, scriptPath, args = []) => {
  return new Promise((resolve, reject) => {
    // Resolve the script path for development and production modes
    let resolvedScriptPath;
    
    if (app.isPackaged) {
      // In production, scripts are in the extraResources directory
      resolvedScriptPath = path.join(process.resourcesPath, 'scripts', scriptFilename);
    } else {
      // In development, scripts are in the scripts directory
      resolvedScriptPath = path.join(app.getAppPath(), 'scripts', scriptFilename);
    }
    
    // Set up environment variables
    const env = {
      ...process.env,
      WORKDIR: appConfig.workspace_dir,
      PATH_RCLONE: appConfig.path_rclone,
      PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'
    };
    
    // Construct the command
    let command;
    if (process.platform === 'darwin' && resolvedScriptPath.endsWith('.sh')) {
      command = `bash "${resolvedScriptPath}" ${args.join(' ')}`;
    } else if (process.platform === 'win32') {
      if (resolvedScriptPath.endsWith('.ps1')) {
        command = `powershell -ExecutionPolicy Bypass -File "${resolvedScriptPath}" ${args.join(' ')}`;
      } else if (resolvedScriptPath.endsWith('.bat')) {
        command = `"${resolvedScriptPath}" ${args.join(' ')}`;
      } else {
        command = `"${resolvedScriptPath}" ${args.join(' ')}`;
      }
    } else {
      command = `"${resolvedScriptPath}" ${args.join(' ')}`;
    }
    
    // Execute the command
    exec(command, { env }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: error.message, stderr });
        return;
      }
      
      resolve({ success: true, stdout, stderr });
    });
  });
});
```

## 9. Build and Distribution

The application uses electron-builder for building and distribution.

### 9.1 Build Configuration

The build configuration is defined in `package.json`:

```json
"build": {
  "appId": "com.pagefinder.config",
  "productName": "PageFinder Configuration",
  "artifactName": "${productName}-${version}-${os}-${arch}.${ext}",
  "asar": true,
  "asarUnpack": [
    "node_modules/fs-extra"
  ],
  "extraResources": [
    {
      "from": "scripts",
      "to": "scripts",
      "filter": ["**/*"]
    }
  ],
  "directories": {
    "buildResources": "build",
    "output": "dist"
  },
  "mac": {
    "category": "public.app-category.utilities",
    "target": [
      {
        "target": "dmg",
        "arch": ["arm64", "x64"]
      },
      {
        "target": "zip",
        "arch": ["arm64", "x64"]
      }
    ],
    "icon": "build/icon.icns",
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "entitlements": "build/entitlements.mac.plist",
    "entitlementsInherit": "build/entitlements.mac.inherit.plist"
  },
  "win": {
    "requestedExecutionLevel": "requireAdministrator",
    "target": [
      {
        "target": "nsis",
        "arch": ["x64"]
      },
      {
        "target": "portable",
        "arch": ["x64"]
      }
    ],
    "icon": "build/icon.ico"
  },
  "linux": {
    "target": [
      {
        "target": "AppImage",
        "arch": ["x64"]
      },
      {
        "target": "deb",
        "arch": ["x64"]
      }
    ],
    "icon": "build",
    "category": "Utility"
  },
  "afterSign": "scripts/notarize.js"
}
```

### 9.2 Build Scripts

The application provides several build scripts in `package.json`:

```json
"scripts": {
  "start": "electron .",
  "dev": "NODE_ENV=development electron .",
  "prepare-build": "node scripts/prepare-for-build.js",
  "pack": "npm run prepare-build && electron-builder --dir",
  "dist": "npm run prepare-build && electron-builder",
  "dist:mac": "npm run prepare-build && electron-builder --mac",
  "dist:win": "npm run prepare-build && electron-builder --win",
  "dist:linux": "npm run prepare-build && electron-builder --linux",
  "dist:all": "npm run prepare-build && electron-builder -mwl"
}
```

### 9.3 Notarization

The application supports notarization for macOS builds using the `scripts/notarize.js` script:

```javascript
const { notarize } = require('electron-notarize');
const { build } = require('../package.json');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;  
  
  // Only notarize macOS builds
  if (electronPlatformName !== 'darwin') {
    return;
  }

  // Skip notarization in development or if environment variables are not set
  if (process.env.NODE_ENV === 'development' || !process.env.APPLE_ID || !process.env.APPLE_ID_PASSWORD) {
    console.log('Skipping notarization: Development environment or missing credentials');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  try {
    await notarize({
      appBundleId: build.appId,
      appPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD,
      ascProvider: process.env.APPLE_TEAM_ID // Optional, only needed if you're part of multiple teams
    });
    
    console.log(`Successfully notarized ${appName}`);
  } catch (error) {
    console.error('Notarization failed:', error);
    throw error;
  }
};
```

## 10. Extending the Application

### 10.1 Adding New Cloud Storage Providers

To add support for a new cloud storage provider:

1. Update the remote type selection in `src/renderer/index.html`
2. Add any provider-specific logic in the `addCloud` function in `src/preload/preload.js`
3. Test the integration with the new provider

### 10.2 Adding New Features

To add new features to the application:

1. Add new UI elements in `src/renderer/index.html`
2. Add new styles in `src/renderer/styles/main.css`
3. Add new event handlers in `src/renderer/index.js`
4. Add new IPC handlers in `src/main.js` if needed
5. Expose new APIs in `src/preload/preload.js` if needed

### 10.3 Customizing the Build

To customize the build process:

1. Update the build configuration in `package.json`
2. Modify the `scripts/prepare-for-build.js` script if needed
3. Update the notarization script if needed