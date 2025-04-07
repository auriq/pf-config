# PageFinder Configuration Utility

This application helps configure cloud storage connections with PageFinder.

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or later)
- [Electron](https://www.electronjs.org/)
- [rclone](https://rclone.org/) (installed and available in your PATH)

## Development

```bash
# Install dependencies
npm install

# Start the application
npm start
```
## Building

This application can be built for macOS, Windows, and Linux platforms.

For detailed instructions on building for multiple platforms, see [Multi-Platform Build Guide](docs/multi-platform-build.md).
This application can be built for macOS, Windows, and Linux platforms.

### macOS

```bash
# Build for macOS
npm run dist:mac

# Build and sign for macOS
npm run dist:mac:signed
```

### Windows

```bash
# Build for Windows
npm run dist:win

# Or use the batch script
scripts\build-all.bat
```

### Linux

```bash
# Build for Linux
npm run dist:linux
```

### All Platforms

```bash
# Build for all platforms (macOS, Windows, Linux)
npm run dist:all

# Use the platform-specific build script (automatically detects platform)
npm run build

# Or use the shell script on macOS/Linux
npm run build:unix
# or
./scripts/build-all.sh

# Or use the batch script on Windows
npm run build:win
# or
scripts\build-all.bat
```

### Creating a GitHub Release

To create a GitHub release with all built artifacts:

```bash
# Build and create a GitHub release
npm run release
```

This script will:
1. Build the application for all platforms
2. Create a new tag based on the version in package.json
3. Push the tag to GitHub
4. Provide instructions for completing the release

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

This will run platform-specific tests to ensure compatibility.

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

This script will:
- Fix rclone executable permissions
- Create necessary configuration directories
- Set appropriate permissions on app files
- Create default configuration files if they don't exist

## License

MIT