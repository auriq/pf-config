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

# Or use the shell script on macOS/Linux
./scripts/build-all.sh
```

## Path Handling

This application is designed to work cross-platform. It handles paths differently based on the operating system:

- **macOS/Linux**: Uses `~/.config/pf-config/` for configuration files
- **Windows**: Uses `%USERPROFILE%\AppData\Roaming\pf-config\` for configuration files

## Scheduling

The application supports scheduled synchronization:

- **macOS/Linux**: Uses crontab for scheduling
- **Windows**: Uses Windows Task Scheduler

## Troubleshooting

If you encounter any issues:

1. Check that rclone is properly installed and available in your PATH
2. Verify that you have appropriate permissions for the configuration directory
3. On Windows, make sure you have permission to create scheduled tasks
4. On macOS, you may need to grant appropriate permissions for cron job creation

## License

MIT