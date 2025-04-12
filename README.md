# PageFinder Configuration Utility

This application helps configure cloud storage connections with PageFinder, providing a user-friendly interface for managing rclone configurations.

## Features

- **Cloud Configuration**: Add, list, check, and delete cloud storage connections
- **PageFinder Configuration**: Import and test PageFinder configuration files
- **Synchronization**: Sync files between cloud storage and PageFinder
- **Scheduling**: Set up automated synchronization jobs
- **Purge**: Remove orphaned folders from PageFinder

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or later)
- [Electron](https://www.electronjs.org/)
- [rclone](https://rclone.org/) (installed and available in your PATH)

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/pagefinder/pf-config.git
   cd pf-config
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application:
   ```bash
   npm start
   ```

## Usage

### Cloud Configuration

1. **Add Cloud Storage**:
   - Enter a name for the remote
   - Select the cloud storage type (Google Drive, OneDrive, Box, Local)
   - Click "Add Cloud Storage"
   - Follow the authentication prompts if required

2. **Manage Cloud Storage**:
   - View a list of configured cloud storage connections
   - Set subfolder paths to limit the scope of synchronization
   - Check connections to verify they're working
   - Delete connections that are no longer needed

### PageFinder Configuration

1. **Import Configuration**:
   - Click "Browse" to select a PageFinder configuration file
   - Click "Import Configuration" to import the file

2. **Test Connection**:
   - Click "Test Connection" to verify the connection to PageFinder

3. **Purge Orphan Folders**:
   - Click "Test Purge" to perform a dry run of the purge operation
   - If the test is successful, click "Execute Purge" to remove orphaned folders

### Synchronization

1. **Test Sync**:
   - Click "Test Sync" to perform a dry run of the synchronization
   - Review the results to ensure everything looks correct

2. **Execute Sync**:
   - If the test is successful, click "Execute Sync" to perform the actual synchronization

### Scheduling

1. **Set Up Schedule**:
   - Select the desired sync interval (hourly, daily, weekly, monthly)
   - Click "Set Up Schedule" to create a scheduled job

## Development

### Development Mode

```bash
# Start the application in development mode
npm run dev
```

### Building

This application can be built for macOS, Windows, and Linux platforms.

#### macOS

```bash
# Build for macOS
npm run dist:mac
```

#### Windows

```bash
# Build for Windows
npm run dist:win
```

#### Linux

```bash
# Build for Linux
npm run dist:linux
```

#### All Platforms

```bash
# Build for all platforms (macOS, Windows, Linux)
npm run dist:all
```

## Path Handling

This application is designed to work cross-platform. It handles paths differently based on the operating system:

- **macOS/Linux**: Uses `~/.config/pf-config/` for configuration files
- **Windows**: Uses `%USERPROFILE%\AppData\Roaming\pf-config\` for configuration files

## Scheduling

The application supports scheduled synchronization:

- **macOS/Linux**: Uses crontab for scheduling
- **Windows**: Uses Windows Task Scheduler

## Testing

To verify that the application works correctly on your platform, run:

```bash
npm test
```

## Troubleshooting

If you encounter any issues:

1. Check that rclone is properly installed and available in your PATH
2. Verify that you have appropriate permissions for the configuration directory
3. On Windows, make sure you have permission to create scheduled tasks
4. On macOS, you may need to grant appropriate permissions for cron job creation

### macOS Permission Issues

If you encounter permission issues on macOS (app not launching or hanging when loading remotes), you can fix them by running:

```bash
# Run the permission fix script
npm run fix:permissions

# If that doesn't work, try with sudo
sudo ./scripts/fix-permissions.sh
```

## License

MIT