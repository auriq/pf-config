# Detailed Specification: PageFinder Configuration Utility

## 1. Overview

The PageFinder Configuration Utility is a desktop application designed to simplify the management of cloud storage connections with PageFinder. It provides a user-friendly interface for configuring, testing, and synchronizing data between various cloud storage providers and PageFinder's S3 storage.

The application leverages rclone, a command-line program for managing files on cloud storage, to handle the actual data synchronization. The application provides a graphical interface to configure and manage rclone operations, making it accessible to users without command-line experience.

## 2. Requirements

### 2.1 System Requirements

- **Operating Systems**: 
  - macOS (Intel and Apple Silicon)
  - Windows 10 or later
  - Linux (optional)

- **Dependencies**:
  - rclone: The application requires rclone to be installed and available in the system PATH
  - Node.js: Required for development only

### 2.2 Environmental Parameters

The application requires two environmental parameters:
1. `path_rclone`: Path to the rclone executable (default: `/usr/local/bin/rclone`)
2. `workspace_dir`: Directory for storing configuration, metadata, and log files (default: `/tmp/pf-workspace`)

## 3. Architecture

### 3.1 Technology Stack

- **Framework**: Electron.js for cross-platform desktop application
- **Frontend**: HTML, CSS, JavaScript with a modern UI framework (React.js)
- **Backend**: Node.js for handling file operations and executing rclone commands
- **Build System**: electron-builder for packaging and distribution

### 3.2 Application Structure

```
pf-config/
├── build/                  # Build resources (icons, entitlements)
├── dist/                   # Distribution output
├── docs/                   # Documentation
├── scripts/                # Shell scripts for purge and sync operations
├── src/                    # Source code
│   ├── main/               # Main process code
│   │   ├── main.js         # Entry point for Electron main process
│   │   ├── ipc.js          # IPC handlers for main process
│   │   ├── rclone.js       # rclone command execution utilities
│   │   └── config.js       # Configuration management
│   ├── renderer/           # Renderer process code
│   │   ├── index.html      # Main HTML file
│   │   ├── index.js        # Entry point for renderer process
│   │   ├── components/     # React components
│   │   ├── styles/         # CSS styles
│   │   └── utils/          # Utility functions
│   └── preload/            # Preload scripts for secure IPC
├── package.json            # Project configuration
└── README.md               # Project documentation
```

### 3.3 Data Flow

1. User interacts with the UI in the renderer process
2. Renderer process sends requests to the main process via IPC
3. Main process executes rclone commands and file operations
4. Results are sent back to the renderer process for display
5. Configuration files are stored in the workspace directory

## 4. User Interface Design

### 4.1 Layout

The application will have a professional-looking sidebar navigation with the following main sections:

1. Cloud Config
2. PageFinder Config
3. Sync
4. Schedule
5. Settings (for environmental parameters)

### 4.2 Design Principles

- **Simplicity**: Clean, intuitive interface that doesn't overwhelm users
- **Feedback**: Clear feedback for all operations, especially long-running ones
- **Consistency**: Consistent design language throughout the application
- **Error Handling**: Graceful error handling with clear error messages

## 5. Features and Implementation Details

### 5.1 Cloud Config

#### 5.1.1 Add Cloud

- Provide a selection of cloud storage providers (Drive, Box, OneDrive, Local)
- Input field for remote name
- Button to invoke rclone configuration
- Implementation: Execute `rclone config create ${remotename} ${type} --config ${workspace_dir}/cloud.conf`
- Handle authentication flow for each provider type

#### 5.1.2 List Cloud

- Display a list of existing remotes defined in cloud.conf
- For each remote, provide:
  - Subfolder configuration: Text input to limit the scope of the remote
  - Check Remote: Button to test the connection by running `rclone lsd ${remotename}: --config ${workspace_dir}/cloud.conf`
  - Delete: Button to remove the remote from cloud.conf

### 5.2 PageFinder Config

#### 5.2.1 Read Config File

- Provide a file browser to select a local PageFinder configuration file
- Validate the selected file for rclone compatibility
- If valid, copy to `${workspace_dir}/pf.conf`

#### 5.2.2 Test Connection

- Button to test the PageFinder connection
- Execute `rclone lsd ${pfname}:${bucket}/${prefix}/${pfname} --config ${workspace_dir}/pf.conf`
- Display the results in the UI

#### 5.2.3 Purge Orphan Folders

- Test: Button to run `scripts/purge.sh` and display the purge.log
- Execute: Button to run `scripts/purge.sh -e` with confirmation dialog
- Display the purge.log in the UI

### 5.3 Sync

- Test: Button to run `scripts/sync.sh` and display the sync.log
- Execute: Button to run `scripts/sync.sh -e` (only enabled if test was successful)
- Display the sync.log in the UI
- Progress indicator for long-running sync operations

### 5.4 Schedule

- Interface to set up a scheduled job for running `scripts/sync.sh -e`
- Platform-specific implementation:
  - macOS/Linux: Set up cron jobs
  - Windows: Set up Windows Task Scheduler tasks
- Display the sync.log from the most recent scheduled run

### 5.5 Settings

- Configure environmental parameters:
  - Path to rclone executable
  - Workspace directory
- Save settings to a configuration file

### 5.6 Exit

- Menu option to exit the application
- Ensure all related processes are terminated properly

## 6. Build and Deployment

### 6.1 Development Build

- `npm start`: Start the application in development mode
- Hot reloading for faster development

### 6.2 Production Build

- `npm run dist:mac`: Build for macOS
- `npm run dist:win`: Build for Windows
- `npm run dist:linux`: Build for Linux
- `npm run dist:all`: Build for all platforms

### 6.3 Distribution

- Generate installers for each platform
- Code signing for macOS and Windows
- Automatic updates (optional)

## 7. Testing

### 7.1 Unit Testing

- Test individual components and utilities
- Mock rclone commands for testing

### 7.2 Integration Testing

- Test the interaction between different parts of the application
- Test IPC communication

### 7.3 End-to-End Testing

- Test the complete application workflow
- Test on different platforms

## 8. Error Handling and Logging

### 8.1 Error Handling

- Graceful handling of rclone errors
- User-friendly error messages
- Recovery mechanisms for common errors

### 8.2 Logging

- Application logs for debugging
- User-visible logs for operations (sync.log, purge.log)
- Log rotation to prevent excessive disk usage

## 9. Security Considerations

### 9.1 Configuration Security

- Secure storage of credentials
- Proper permissions for configuration files

### 9.2 Process Security

- Sandboxed execution of rclone commands
- Validation of user inputs

## 10. Future Enhancements

### 10.1 Potential Features

- Dark mode support
- Advanced scheduling options
- Bandwidth limiting for sync operations
- Multiple PageFinder configurations
- Sync history and statistics

### 10.2 Performance Optimizations

- Caching of remote listings
- Parallel sync operations
- Incremental sync for large datasets

## 11. Implementation Plan

### 11.1 Phase 1: Core Functionality

1. Set up Electron project structure
2. Implement main process and IPC handlers
3. Create basic UI with navigation
4. Implement Cloud Config features
5. Implement PageFinder Config features

### 11.2 Phase 2: Advanced Features

1. Implement Sync functionality
2. Implement Schedule functionality
3. Add Settings page
4. Improve error handling and logging

### 11.3 Phase 3: Polish and Distribution

1. Refine UI/UX
2. Add comprehensive error handling
3. Set up build and distribution
4. Create documentation

## 12. Conclusion

This detailed specification provides a comprehensive plan for implementing the PageFinder Configuration Utility. By following this specification, we can build a robust, user-friendly application that simplifies the management of cloud storage connections with PageFinder.