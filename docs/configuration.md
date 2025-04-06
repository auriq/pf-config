# Configuration Reference

This document provides detailed information about configuration files, settings, and environment-specific configurations used by the PageFinder Configuration application.

## Table of Contents

1. [Configuration Directory](#configuration-directory)
2. [Configuration Files](#configuration-files)
3. [Environment Configuration](#environment-configuration)
4. [Development and Production Consistency](#development-and-production-consistency)
5. [Platform-Specific Settings](#platform-specific-settings)
6. [Path Management](#path-management)
7. [Settings Reference](#settings-reference)
8. [Configuration Management](#configuration-management)
9. [Environment Module API](#environment-module-api)
10. [Advanced Configuration](#advanced-configuration)

## Configuration Directory

The application stores configuration files in a platform-specific location determined by Electron's standard user data directory:

- **Windows**: `%APPDATA%\pf-config`
- **macOS**: `~/Library/Application Support/pf-config`
- **Linux**: `~/.config/pf-config`

In development mode (npm start), the same paths are used to ensure consistency between development and production environments.

## Configuration Files

### cloud.conf

This file stores cloud storage provider configurations in rclone format. Each remote connection is defined as a section with parameters.

Example:
```
[gdrive1]
type = drive
client_id = client_id_value
client_secret = client_secret_value
token = {"access_token":"...","token_type":"Bearer","refresh_token":"...","expiry":"..."}

[onedrive1]
type = onedrive
token = {"access_token":"...","token_type":"Bearer","refresh_token":"...","expiry":"..."}

[local1]
type = local
path = /path/to/local/folder
```

### pf.conf

This file stores PageFinder-specific configuration in rclone format. It defines the connection to the PageFinder storage backend.

Example:
```
[pagefinder_username]
type = s3
provider = Wasabi
access_key_id = your_access_key
secret_access_key = your_secret_key
region = us-east-1
endpoint = s3.wasabisys.com
acl = private
```

### rclone.conf

This is a temporary combined configuration file used during operations. It combines both cloud.conf and pf.conf to enable seamless connection testing and synchronization.

### settings.json

This file stores application settings in JSON format.

Example:
```json
{
  "rclonePath": "/usr/local/bin/rclone",
  "lastBackupDate": "2023-04-01T12:00:00Z"
}
```

### remotes-metadata.json

This file stores additional metadata about remote connections that isn't part of the standard rclone configuration.

Example:
```json
{
  "remotes": {
    "gdrive1": {
      "subfolder": "documents/work",
      "lastChecked": "2023-04-01T12:00:00Z"
    },
    "onedrive1": {
      "subfolder": "pagefinder",
      "lastChecked": "2023-04-01T14:30:00Z"
    }
  }
}
```

## Environment Configuration

The environment configuration module (`src/config/environment.js`) centralizes all platform-specific configurations and paths. It focuses solely on defining parameters rather than implementing functionality. This ensures that the application behaves consistently across different operating systems while respecting platform conventions.

### Platform Detection

The module detects the current operating system and provides constants for platform detection:

```javascript
const PLATFORM = process.platform;
const IS_WINDOWS = PLATFORM === 'win32';
const IS_MAC = PLATFORM === 'darwin';
const IS_LINUX = PLATFORM === 'linux';
const HOME_DIR = os.homedir();
const IS_DEV = isDevelopmentMode();
```

## Development and Production Consistency

One of the most critical aspects of the configuration system is ensuring that both development mode (`npm start`) and production mode (installed application) use the same configuration files and paths. The environment module handles this by:

### Using Electron's User Data Directory

The key to consistency is using Electron's standard user data directory for all user-specific files:

```javascript
function determineUserDataDir() {
  try {
    // Use Electron's user data directory when available
    if (app && app.getPath) {
      const userDataPath = app.getPath('userData');
      console.log(`Using Electron userData directory: ${userDataPath}`);
      return userDataPath;
    }
  } catch (error) {
    console.log('Electron app.getPath not available, using platform-specific paths');
  }
  
  // Fall back to platform-specific locations
  if (IS_WINDOWS) {
    return path.join(HOME_DIR, 'AppData', 'Roaming', 'pf-config');
  } else {
    return path.join(HOME_DIR, '.config', 'pf-config');
  }
}

const USER_DATA_DIR = determineUserDataDir();
```

This approach ensures that:

1. In production (packaged app), files are stored in Electron's standard user data location
2. In development, the same path structure is used
3. If Electron APIs aren't available, it falls back to consistent platform-specific paths

### Storing All User Files in User Data Directory

All user-specific files are stored under this directory to ensure consistency:

```javascript
const PATHS = {
  // Application base directory (determined at runtime)
  appBase: determineAppBaseDir(),
  
  // USER DATA PATHS - these must be consistent between dev and prod
  appConfig: USER_DATA_DIR,
  logs: path.join(USER_DATA_DIR, 'logs'),
  data: path.join(USER_DATA_DIR, 'data'),
  scripts: path.join(USER_DATA_DIR, 'scripts'),
  backup: path.join(USER_DATA_DIR, 'backup'),
  
  // Other platform-specific paths...
};
```

### Explicit Helper for Configuration Files

A dedicated helper function ensures configuration files are always accessed from the consistent location:

```javascript
function getConfigFilePath(configName) {
  return path.join(PATHS.appConfig, configName);
}
```

### Debugging with Console Output

The module includes strategic console logging to make path usage transparent:

```javascript
console.log(`Running in ${IS_DEV ? 'development' : 'production'} mode`);
console.log(`User data directory: ${USER_DATA_DIR}`);

// Also logs all paths during directory initialization
Object.entries(PATHS).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`);
});
```

## Platform-Specific Settings

Each supported platform has specific settings and configurations that the application uses to maintain consistent behavior across different operating systems.

### Integrated Platform-Specific Configurations

All platform-specific settings, including paths, are defined in a way that isolates them by platform:

```javascript
// Windows paths are defined only when running on Windows
...(IS_WINDOWS && {
  rcloneDefault: 'C:\\Program Files\\rclone\\rclone.exe',
  documents: path.join(HOME_DIR, 'Documents'),
  desktop: path.join(HOME_DIR, 'Desktop'),
  temp: process.env.TEMP || path.join(HOME_DIR, 'AppData', 'Local', 'Temp')
}),

// macOS paths are defined only when running on macOS
...(IS_MAC && {
  rcloneDefault: '/usr/local/bin/rclone',
  documents: path.join(HOME_DIR, 'Documents'),
  desktop: path.join(HOME_DIR, 'Desktop'),
  temp: '/tmp'
}),

// Linux paths are defined only when running on Linux
...(IS_LINUX && {
  rcloneDefault: '/usr/bin/rclone',
  documents: path.join(HOME_DIR, 'Documents'),
  desktop: path.join(HOME_DIR, 'Desktop'),
  temp: '/tmp'
})
```

This structure ensures that only the correct paths for the current platform are defined, eliminating any potential for cross-platform inconsistencies.

### Platform-Specific Behavior Configurations

Each platform also has specific behavior settings defined in the `PLATFORM_CONFIG` object:

```javascript
// Windows-specific configuration
windows: {
  name: 'Windows',
  pathSeparator: '\\',
  shell: process.env.COMSPEC || 'cmd.exe',
  shellArgs: ['/c'],
  rcloneConfigExtension: '.conf',
  commonRclonePaths: [
    'C:\\Program Files\\rclone\\rclone.exe',
    'C:\\Program Files (x86)\\rclone\\rclone.exe',
    // Additional paths...
  ],
  rcloneWhichCommand: 'where rclone',
  syncScript: 'sync.bat',
  fileBrowser: 'explorer',
  fileDialogFilters: [
    { name: 'Configuration Files', extensions: ['conf'] },
    { name: 'All Files', extensions: ['*'] }
  ]
}
```

Similar configurations exist for macOS and Linux, ensuring that platform-specific behaviors are well-defined and isolated.

## Path Management

### Application Base Directory

The application base directory is determined at runtime based on the environment:

```javascript
function determineAppBaseDir() {
  try {
    // For packaged app
    if (!IS_DEV && app && app.getAppPath) {
      const appPath = app.getAppPath();
      console.log(`Production app directory: ${appPath}`);
      return appPath;
    }
  } catch (error) {
    console.log('Electron app object not available, using __dirname');
  }
  
  // For development or non-Electron environment
  const devPath = path.resolve(__dirname, '..', '..');
  console.log(`Development app directory: ${devPath}`);
  return devPath;
}
```

This is then integrated into the paths configuration:

```javascript
const PATHS = {
  // Application base directory (determined at runtime)
  appBase: determineAppBaseDir(),
  
  // User data paths...
};
```

### Standard Path Locations

These are the standard path locations defined for each platform:

| Path | Description | Source | Location |
|------|-------------|--------|----------|
| appBase | Application installation directory | Runtime | varies between dev/prod |
| appConfig | Application configuration directory | User Data Dir | Electron standard location |
| logs | Log file directory | User Data Dir | Electron standard location + /logs |
| data | Application data directory | User Data Dir | Electron standard location + /data |
| scripts | Scripts directory | User Data Dir | Electron standard location + /scripts |
| backup | Backup directory | User Data Dir | Electron standard location + /backup |
| rcloneDefault | Default rclone executable location | Platform-specific | Standard installation location |
| documents | User documents folder | Platform-specific | User's Documents folder |
| desktop | User desktop folder | Platform-specific | User's Desktop folder |
| temp | Temporary directory | Platform-specific | System temp directory |

### Path Helper Functions

The module provides helper functions to work with paths consistently:

```javascript
// Get a path to a file in the application directory
getAppFilePath(relativePath)

// Get a path for storing application data files
getDataFilePath(fileName, subDirectory)

// Get a path for a log file
getLogFilePath(logName)

// Get a path for a configuration file
getConfigFilePath(configName)
```

### Path Usage Guidelines

To ensure consistent file access across environments:

1. **Always use the dedicated helper functions** for specific file types:
   - `env.getConfigFilePath('cloud.conf')` for configuration files
   - `env.getDataFilePath('cache.json')` for data files  
   - `env.getLogFilePath('sync.log')` for log files
   - `env.getAppFilePath('assets/icon.png')` for application files

2. **Never use `process.cwd()`** - This is unreliable as it depends on where the app is launched from

3. **Never use relative paths** like `./logs` - These are ambiguous and unpredictable

4. **Use environment constants** for standard directories:
   - `env.PATHS.appConfig` for the configuration directory
   - `env.PATHS.logs` for the logs directory

## Settings Reference

### Application Settings

| Setting | Description | Default |
|---------|-------------|---------|
| rclonePath | Path to rclone executable | Platform specific |
| lastBackupDate | Timestamp of last settings backup | none |

### Remote Metadata Settings

| Setting | Description | Default |
|---------|-------------|---------|
| subfolder | Subfolder path restriction for the remote | none |
| lastChecked | Timestamp when remote was last tested | none |

### Schedule Settings

Schedule settings are stored in a schedule configuration file.

| Setting | Description | Default |
|---------|-------------|---------|
| enabled | Whether scheduling is enabled | false |
| frequency | Schedule frequency (daily, weekly) | daily |
| hour | Hour for scheduled operation (0-23) | 0 |
| minute | Minute for scheduled operation (0-59) | 0 |
| dayOfWeek | Day of week for weekly schedule (0-6, 0=Sunday) | 0 |

## Configuration Management

### How Configurations Are Used

1. **Cloud Storage**: The application reads and updates cloud.conf to manage cloud storage remotes
2. **PageFinder**: The application reads and updates pf.conf for PageFinder configuration
3. **Combined Operations**: For testing and synchronization, the app combines both into rclone.conf
4. **Settings**: Application settings are read and updated in settings.json
5. **Metadata**: Additional remote information is stored in remotes-metadata.json

### Manual Configuration

While the application provides a UI for configuration management, advanced users can manually edit configuration files with these guidelines:

1. Follow the rclone configuration format for cloud.conf and pf.conf
2. Use valid JSON for settings.json and remotes-metadata.json
3. Restart the application after manual edits
4. Be careful with sensitive information like tokens and keys

### Backup and Recovery

The application does not automatically backup configuration files. It's recommended to:

1. Backup the entire configuration directory regularly
2. Export important remote configurations using rclone
3. Document authentication steps for cloud providers
4. Keep a copy of essential PageFinder connection details

## Environment Module API

The environment module provides essential constants and functions for handling platform-specific parameters.

### Directory Management

```javascript
ensureDirectories()
```

Creates all required application directories if they don't exist:
- Application configuration directory
- Logs directory
- Backup directory
- Data directory
- Scripts directory
- Temporary directory (if not a system directory)

Returns: `true` if all directories were created successfully, `false` otherwise.

### Platform Configuration

```javascript
getPlatformConfig()
```

Returns the platform-specific configuration object for the current operating system.

Returns: Configuration object with platform-specific settings.

### Path Management Functions

```javascript
getAppFilePath(relativePath)
```

Gets the absolute path to a file in the application directory.

Parameters:
- `relativePath`: Path relative to the application root

Returns: Absolute path to the file.

```javascript
getDataFilePath(fileName, subDirectory)
```

Gets the path for storing application data files.

Parameters:
- `fileName`: Name of the file to store
- `subDirectory`: Optional subdirectory within the data directory

Returns: Absolute path to the file.

```javascript
getLogFilePath(logName)
```

Gets the path for a log file.

Parameters:
- `logName`: Name of the log file

Returns: Absolute path to the log file.

```javascript
getConfigFilePath(configName)
```

Gets the path for a configuration file.

Parameters:
- `configName`: Name of the configuration file

Returns: Absolute path to the configuration file.

### Development Mode Detection

```javascript
isDevelopmentMode()
```

Determines if the application is running in development or production mode.

Returns: `true` if running in development mode, `false` otherwise.

### Helper Functions

```javascript
pathExists(path)
```

Checks if a file or directory exists at the specified path.

```javascript
resolveHome(filepath)
```

Resolves paths that start with `~` to the user's home directory.

```javascript
pathSeparator
```

Returns the path separator for the current platform (`\` on Windows, `/` on macOS/Linux).

```javascript
getTempDir()
```

Returns the system temporary directory.

```javascript
getScriptExtension()
```

Returns the appropriate script extension for the current platform (`.bat` on Windows, `.sh` on macOS/Linux).

## Advanced Configuration

### Environment Variables

The application respects these environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| HOME or USERPROFILE | User's home directory | System-defined |
| PF_CONFIG_DIR | Override default config directory | none |
| RCLONE_CONFIG_PATH | Override rclone configuration path | none |

### Command Line Arguments

The Electron application accepts standard Electron arguments plus:

| Argument | Description | Example |
|----------|-------------|---------|
| --config-dir | Override config directory | --config-dir=/path/to/config |
| --rclone-path | Override rclone path | --rclone-path=/usr/bin/rclone |
| --debug | Enable debug logging | --debug |

### Usage in Application

The environment module is typically imported and used as follows:

```javascript
const env = require('./config/environment');

// Use platform detection
if (env.IS_WINDOWS) {
  // Windows-specific code
} else if (env.IS_MAC) {
  // macOS-specific code
} else {
  // Linux-specific code
}

// Check if in development or production mode
if (env.IS_DEV) {
  console.log('Running in development mode');
} else {
  console.log('Running in production mode');
}

// Use stable paths
const configDir = env.PATHS.appConfig;
const logsDir = env.PATHS.logs;

// Get paths to specific files
const configFile = env.getConfigFilePath('cloud.conf');
const dataFile = env.getDataFilePath('settings.json');
const logFile = env.getLogFilePath('sync.log');
const appResFile = env.getAppFilePath('resources/default.conf');

// Get platform configuration
const platformConfig = env.getPlatformConfig();
console.log(`Running on ${platformConfig.name}`);
```

### Customization

To add custom configuration settings or extend platform support:

1. Update the environment.js file with new platform-specific settings
2. Ensure settings are defined for all supported platforms
3. Add new helper functions as needed
4. Update application code to use the new settings