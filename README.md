# Cloud Storage Configuration

A desktop application for managing cloud storage configurations using rclone.

## Overview

This application provides a user-friendly interface for managing cloud storage connections using [rclone](https://rclone.org), making it easy to connect to popular cloud storage providers:

- Google Drive
- Microsoft OneDrive
- Dropbox
- Box
- Local Storage

The app simplifies the process of setting up, managing, and testing cloud storage connections without having to use the command line.

## Prerequisites

Before using this application, you need to have rclone installed on your system:

- **macOS/Linux**: `/usr/local/bin/rclone` (default path)
- **Windows**: Install using the rclone installer from [rclone.org](https://rclone.org/install/)

## Installation

### From Source

1. Clone this repository
2. Install dependencies: `npm install`
3. Start the application: `npm start`

### Prebuilt Binaries

Download the appropriate installer for your operating system from the releases page:

- **macOS**: `Cloud-Storage-Config-App-{version}-mac-{arch}-installer.dmg`
- **Windows**: `Cloud-Storage-Config-App-{version}-win-x64-setup.exe`
- **Linux**: `Cloud-Storage-Config-App-{version}-linux-x64.AppImage`

## Features

- **Easy Configuration**: Connect to cloud storage providers through a simple UI
- **OAuth Authentication**: Simplified OAuth flow for supported providers
- **Remote Management**: List, check, and delete remote connections
- **File Browsing**: View files and file sizes in your cloud storage
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Usage

### First Launch

Upon first launch, you'll be prompted to set up the path to your rclone executable:

1. Enter the path where rclone is installed on your system
2. Alternatively, click "Use Default Path" if rclone is installed in the standard location

### Adding a New Remote

1. Click on the button for the cloud provider you want to connect to
2. Enter a name for this remote connection
3. Follow the authentication flow that opens in your browser
4. The remote will be added to your list of connections

### Managing Remotes

- **View Remotes**: All configured remotes are displayed in the main screen
- **Check Remote**: Click on a remote and then the check icon to verify the connection and see file information
- **Delete Remote**: Click on a remote and then the delete icon to remove the configuration

## Troubleshooting

### Common Issues

1. **"Rclone path not configured"**: 
   - Ensure rclone is installed and the correct path is set in the application

2. **Authentication Failed**:
   - Check your internet connection
   - Ensure your browser is not blocking popups
   - Try adding the remote again

3. **Application Hangs**:
   - If the application becomes unresponsive during configuration, use the included cleanup script:
     - Windows: Run `scripts/kill-app.bat`
     - macOS/Linux: Run `scripts/kill-app.sh`

## Configuration Files

The application stores its configuration in:

- **macOS/Linux**: `~/.config/pf-config/`
- **Windows**: `%USERPROFILE%\.config\pf-config\`

The directory contains:
- `rclone.conf`: The rclone configuration file
- `settings.json`: Application settings

## License

This project is licensed under the MIT License - see the LICENSE file for details.