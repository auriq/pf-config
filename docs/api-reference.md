# API Reference

This document provides reference documentation for the PageFinder Configuration application's internal APIs, including classes, methods, and IPC (Inter-Process Communication) events.

## Main Process

### CloudConfigApp

The main application class that handles the Electron application lifecycle.

#### Methods

| Method | Description |
|--------|-------------|
| `constructor(configManager)` | Initializes the application with a ConfigManager instance |
| `createWindow()` | Creates the main application window |
| `init()` | Initializes the application and sets up handlers |
| `checkForZombieProcesses()` | Checks for and cleans up zombie rclone processes |
| `combinedRcloneConfig()` | Combines cloud.conf and pf.conf into rclone.conf |
| `setupIPC()` | Sets up IPC event handlers |
| `logCommandExecution()` | Logs command execution results |
| `executeCommand(command, options)` | Executes a shell command with options |
| `updateSyncScript()` | Updates the sync script with the current configuration |

### ConfigManager

Handles all interactions with rclone configuration and command execution.

#### Methods

| Method | Description |
|--------|-------------|
| `constructor()` | Initializes the ConfigManager with default paths |
| `getAppConfigDir()` | Gets the app config directory path |
| `getRcloneConfigPath()` | Gets the rclone config file path |
| `getSettingsPath()` | Gets the app settings file path |
| `getMetadataPath()` | Gets the remotes metadata file path |
| `initializeMetadata()` | Initializes the metadata file if needed |
| `getRemoteMetadata(remoteName)` | Gets metadata for a specific remote |
| `getAllRemotesMetadata()` | Gets metadata for all remotes |
| `saveRemoteMetadata(remoteName, metadata)` | Saves metadata for a remote |
| `deleteRemoteMetadata(remoteName)` | Deletes metadata for a remote |
| `getRemoteConfig(remoteName)` | Gets configuration for a specific remote |
| `ensureDirectories()` | Creates necessary directories |
| `getSettings()` | Gets application settings |
| `saveSettings(settings)` | Saves application settings |
| `validateRclonePath(rclonePath)` | Validates rclone installation path |
| `listRemotes()` | Lists configured remotes |
| `deleteRemote(remoteName)` | Deletes a remote configuration |
| `executeRclone(command, options)` | Executes an rclone command with options |
| `handleProviderPrompts(process, provider, event)` | Handles provider-specific prompts |
| `checkRemote(remoteName, options)` | Checks a remote's connection and content |

## Renderer Process

### UIController

The central controller for the renderer process UI.

#### Methods

| Method | Description |
|--------|-------------|
| `constructor()` | Initializes the UI controller and sub-modules |
| `showLoading(message)` | Shows the loading indicator with a message |
| `hideLoading()` | Hides the loading indicator |
| `initializeElements()` | Initializes all DOM element references |
| `showSection(section)` | Shows a specific section and hides others |
| `closeApplication()` | Closes the application |

### RemoteManager

Handles remote storage operations in the renderer process.

#### Methods

| Method | Description |
|--------|-------------|
| `constructor(controller)` | Initializes with a reference to the UIController |
| `getRemoteMetadata(remoteName)` | Gets metadata for a remote from the UI |
| `browseLocalFolder()` | Opens a dialog to browse for a local folder |
| `confirmSubfolderSetting()` | Confirms and saves the subfolder setting |
| `handleDefaultRclonePath()` | Uses the default rclone path |
| `saveRclonePath()` | Validates and saves the rclone path |
| `confirmRemoteCreation()` | Confirms creation of a new remote |
| `refreshRemotesList()` | Refreshes the list of remotes |
| `handleRemoteClick(remoteName)` | Handles remote selection |
| `updateRemotesList(data)` | Updates the remotes list in the UI |
| `displayRemoteStatus(result)` | Displays remote status information |
| `handleDeleteStatus(success, message)` | Handles remote deletion status |
| `updateConfigStatus(message)` | Updates the configuration status message |
| `disableProviderButtons(disabled)` | Disables or enables provider buttons |

### PageFinderManager

Handles PageFinder configuration operations.

#### Methods

| Method | Description |
|--------|-------------|
| `constructor(controller)` | Initializes with a reference to the UIController |
| `checkPFConfigExists()` | Checks if the PageFinder config file exists |
| `browsePFConfig()` | Opens a dialog to browse for a PageFinder config file |
| `validatePFConfig()` | Validates the PageFinder config file |
| `checkPFConnection()` | Checks the PageFinder connection |

### TestManager

Handles connection testing between cloud storage and PageFinder.

#### Methods

| Method | Description |
|--------|-------------|
| `constructor(controller)` | Initializes with a reference to the UIController |
| `testConnection()` | Tests connection between cloud storage and PageFinder |
| `runSync()` | Runs the sync.sh script to perform synchronization |
| `sanitizeOutput(output)` | Sanitizes output to remove sensitive information |
| `checkForTokenErrors(result)` | Checks for token expiration or authentication errors |

### LogScheduleManager

Handles log viewing and schedule management.

#### Methods

| Method | Description |
|--------|-------------|
| `constructor(controller)` | Initializes with a reference to the UIController |
| `viewSyncLog()` | Views the synchronization log |
| `cleanLogs()` | Cleans old log files |
| `loadCurrentSchedule()` | Loads the current schedule |
| `saveSchedule()` | Saves the schedule |
| `updateFrequencyOptions()` | Updates frequency-dependent options |

### DialogManager

Handles dialog UI management.

#### Methods

| Method | Description |
|--------|-------------|
| `constructor(controller)` | Initializes with a reference to the UIController |
| `showRemoteDialog(provider)` | Shows the remote creation dialog |
| `hideRemoteDialog()` | Hides the remote dialog |
| `showRcloneSetupDialog()` | Shows the rclone setup dialog |
| `hideRcloneSetupDialog()` | Hides the rclone setup dialog |
| `showSubfolderDialog(remoteName)` | Shows the subfolder dialog |
| `hideSubfolderDialog()` | Hides the subfolder dialog |

## IPC Events

### From Renderer to Main Process

| Event | Description | Parameters |
|-------|-------------|------------|
| `close-app` | Request to close the application | None |
| `list-remotes` | Request to list remotes | None |
| `check-remote` | Request to check a remote | `{remoteName, useLsCommand}` |
| `delete-remote` | Request to delete a remote | `remoteName` |
| `configure-remote` | Request to configure a remote | `{name, provider, localPath}` |
| `set-subfolder` | Request to set a subfolder for a remote | `{remoteName, subfolder}` |

### From Main Process to Renderer

| Event | Description | Data |
|-------|-------------|------|
| `remotes-list` | Response with list of remotes | `{remotes, metadata}` |
| `remote-status` | Response with remote status | `{name, status, ...}` |
| `delete-status` | Response with delete operation status | `{success, message}` |
| `config-status` | Status message about configuration | `message` |

## IPC Handlers

### Main Process Handlers

| Handler | Description | Parameters | Returns |
|---------|-------------|------------|---------|
| `get-rclone-path` | Get the rclone path from settings | None | Path string |
| `validate-rclone-path` | Validate a rclone path | Path string | Boolean |
| `browse-pf-config` | Browse for PageFinder config | None | File path |
| `validate-pf-config` | Validate PageFinder config | File path | `{success, message, path}` |
| `check-pf-connection` | Check PageFinder connection | `{useLsCommand}` | Connection result |
| `check-pf-config-exists` | Check if PF config exists | None | Boolean |
| `test-connection` | Test connection between storage and PF | None | Test result |
| `run-sync-with-exec` | Run sync operation | None | Sync result |

## File Formats

### Remote Metadata Format

```json
{
  "remotes": {
    "remoteName": {
      "subfolder": "path/to/subfolder",
      "lastChecked": "timestamp"
    }
  }
}
```

### Settings Format

```json
{
  "rclonePath": "/path/to/rclone"
}
```

### Schedule Format

```json
{
  "enabled": true,
  "frequency": "daily",
  "hour": 3,
  "minute": 30,
  "dayOfWeek": 1
}
```

## Error Handling

The application uses a consistent error handling pattern:

1. Try-catch blocks around operations
2. Detailed error logging to the console
3. User-friendly error messages in the UI
4. Status codes and messages for IPC responses

Example:
```javascript
try {
  // Perform operation
} catch (error) {
  console.error('Operation failed:', error);
  return { success: false, message: error.message };
}