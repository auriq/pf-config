# PageFinder Configuration Architecture

This document provides a detailed overview of the PageFinder Configuration application's architecture, component structure, and data flow.

## Technology Stack

- **Framework**: Electron (Node.js + Chromium)
- **Languages**: JavaScript, HTML, CSS
- **External Dependencies**: rclone (command-line cloud storage manager)

## Application Structure

The application follows a modular architecture with clear separation of concerns between the main process and renderer process:

### Main Process

The main process is responsible for native operations, file system access, and executing rclone commands:

- **main.js**: Application entry point
- **modules/app.js**: Core application class
- **modules/config-manager.js**: Manages configuration files and rclone interaction
- **modules/terminal-output.js**: Handles console output and logging

### Renderer Process

The renderer process handles the UI and user interactions:

- **index.html**: Main application UI
- **renderer.js**: Initializes the UI components
- **modules/ui/UIController.js**: Central UI coordinator
- **modules/ui/**: Specialized UI managers for each functionality area

## Module Structure

```
src/
├── index.html                # Main application UI
├── main.js                   # Electron main process entry point
├── renderer.js               # Renderer process initializer
├── config/
│   └── environment.js        # Environment configuration
├── modules/
│   ├── app.js                # Core application module
│   ├── config-manager.js     # Configuration management
│   ├── terminal-output.js    # Console logging module
│   ├── utils.js              # Utility functions
│   ├── handlers/
│   │   ├── ConfigHandler.js  # Config-related handlers
│   │   ├── LogHandler.js     # Log-related handlers
│   │   ├── RemoteHandler.js  # Remote storage handlers
│   │   └── TestHandler.js    # Test-related handlers
│   └── ui/
│       ├── DialogManager.js  # Dialog UI management
│       ├── EventHandler.js   # UI event handling
│       ├── LogScheduleManager.js  # Log and schedule management
│       ├── PageFinderManager.js   # PageFinder config management
│       ├── RemoteManager.js       # Remote storage management
│       ├── TestManager.js         # Connection testing
│       └── UIController.js        # Main UI controller
```

## Core Components

### UIController

The UIController is the central coordinator for the renderer process. It:
- Initializes all UI managers
- Maintains references to UI elements
- Coordinates navigation between sections
- Provides common UI functions (loading indicators, etc.)

### ConfigManager

The ConfigManager handles all interactions with configuration files and rclone:
- Manages rclone configuration files
- Executes rclone commands
- Provides an abstraction layer for storage operations
- Handles remote metadata storage and retrieval

### RemoteManager

The RemoteManager provides functionality for handling cloud storage remotes:
- Lists and displays configured remotes
- Handles adding new remote connections
- Manages remote testing and subfolder settings
- Processes remote deletion

### PageFinderManager

The PageFinderManager handles PageFinder-specific functionality:
- Validates PageFinder configuration files
- Tests PageFinder connections
- Displays PageFinder connection details

### TestManager

The TestManager handles connection testing between cloud storage and PageFinder:
- Tests connectivity between configured systems
- Executes synchronization operations
- Displays test results and output
- Sanitizes sensitive information in output

### LogScheduleManager

The LogScheduleManager provides logging and scheduling functionality:
- Manages synchronization schedules
- Displays and manages log files
- Handles log cleanup operations

## Data Flow

1. **User Interaction**: User interacts with UI elements in the renderer process
2. **Event Processing**: EventHandler processes UI events and delegates to appropriate manager
3. **IPC Communication**: Managers communicate with main process via IPC (Inter-Process Communication)
4. **Main Process Operations**: Main process executes operations via ConfigManager
5. **External Command Execution**: ConfigManager interacts with rclone and file system
6. **Result Processing**: Results are sent back to renderer and processed by managers
7. **UI Update**: Managers update UI elements to display results to the user

## Configuration Storage

Application data is stored in a platform-specific location:
- **Windows**: `%USERPROFILE%\AppData\Roaming\pf-config\`
- **macOS/Linux**: `~/.config/pf-config/`

Key configuration files include:
- **cloud.conf**: Cloud storage configuration (rclone format)
- **pf.conf**: PageFinder configuration (rclone format)
- **rclone.conf**: Combined configuration for operations
- **settings.json**: Application settings
- **remotes-metadata.json**: Additional metadata about remotes

## Security Considerations

- OAuth tokens are handled securely
- Sensitive information is masked in logs and UI
- Token validation and refresh flows are implemented
- Output sanitization is performed to remove sensitive data