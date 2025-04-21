# PageFinder Configuration Utility - Quick Start Guide

This guide provides a quick overview of how to get started with the PageFinder Configuration Utility.

## Installation

### macOS

1. Download the appropriate installer:
   - Apple Silicon (M1/M2) Macs: `PageFinder Configuration-[version]-mac-arm64-installer.dmg`
   - Intel Macs: `PageFinder Configuration-[version]-mac-x64-installer.dmg`
2. Open the DMG file and drag the app to your Applications folder
3. Launch the app from Applications

### Windows

1. Download the installer: `PageFinder Configuration-[version]-win-x64-setup.exe`
2. Run the installer and follow the on-screen instructions
3. Launch the app from the Start menu

### Linux

1. Download the appropriate package:
   - AppImage: `PageFinder Configuration-[version]-linux-x86_64.AppImage`
   - Debian/Ubuntu: `pagefinder-configuration_[version]_amd64.deb`
2. Install the package or make the AppImage executable
3. Launch the app

## Initial Setup

1. **Settings**: First, verify your settings:
   - Navigate to the Settings section using the sidebar
   - Verify the rclone path (default: `/usr/local/bin/rclone` on macOS/Linux, `rclone.exe` on Windows)
   - Verify the workspace directory (default: `~/.config/pf-config` on macOS/Linux, `%APPDATA%\pf-config` on Windows)
   - Click "Save Settings" if you made any changes

   ![Settings Section](images/settings_section.png)
   *The Settings section for configuring rclone path and workspace directory*

2. **Add Cloud Storage**:
   - Navigate to the Cloud Config section
   - Enter a name for your remote (e.g., "gdrive", "onedrive-work")
   - Select the type of cloud storage
   - Click "Add Cloud Storage"
   - Follow the authentication process

   ![Add Cloud Form](images/add_cloud_form.png)
   *The form for adding a new cloud storage connection*

3. **Import PageFinder Configuration**:
   - Navigate to the PageFinder Config section
   - Click "Browse" to select your PageFinder configuration file
   - Click "Import Configuration"
   - Click "Test Connection" to verify the connection

   ![Import Config](images/import_config.png)
   *Importing a PageFinder configuration file*

## Basic Operations

### Test Cloud Storage Connection

1. Navigate to the Cloud Config section
2. Find your cloud storage in the list
3. Click "Check" to test the connection
4. Toggle "List Files" to see a list of files in your cloud storage

![Cloud Check Result](images/cloud_check_result.png)
*The result of checking a cloud storage connection*

### Configure Subfolder

1. Navigate to the Cloud Config section
2. Find your cloud storage in the list
3. Enter a subfolder path in the text field
4. Click "Save" to save the subfolder configuration

![Subfolder Config](images/subfolder_config.png)
*Configuring a subfolder for a cloud storage connection*

### Synchronize Files

1. Navigate to the Sync section
2. Click "Test Sync" to perform a dry run
3. Review the sync log
4. If satisfied, click "Execute Sync" to transfer files

![Sync Section](images/sync_section.png)
*The Sync section showing the test and execute buttons*

### Schedule Automatic Synchronization

1. Navigate to the Schedule section
2. Enter the time for synchronization (HH:MM in 24-hour format)
3. Click "Set Up Schedule"

![Schedule Form](images/schedule_form.png)
*The form for setting up scheduled synchronization*

### Purge Orphaned Folders

1. Navigate to the PageFinder Config section
2. Click "Test Purge" to see which folders would be purged
3. Review the purge log
4. If satisfied, click "Execute Purge"

![Purge Test Result](images/purge_test_result.png)
*The result of testing a purge operation*

## Troubleshooting

If you encounter issues:

1. Check the application logs in the workspace directory
2. Verify your internet connection
3. Ensure your cloud storage credentials are valid
4. Check if rclone is installed and accessible

![Error Dialog](images/error_dialog.png)
*Error dialog showing a connection failure*

For more detailed information, refer to the [User Manual](user-manual.md) and [Troubleshooting Guide](troubleshooting-guide.md).