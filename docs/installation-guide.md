# PageFinder Configuration Utility - Installation Guide

This guide provides detailed instructions for installing the PageFinder Configuration Utility on different platforms.

## Table of Contents

1. [System Requirements](#1-system-requirements)
2. [macOS Installation](#2-macos-installation)
3. [Windows Installation](#3-windows-installation)
4. [Linux Installation](#4-linux-installation)
5. [Verifying Installation](#5-verifying-installation)
6. [Troubleshooting](#6-troubleshooting)

## 1. System Requirements

Before installing the PageFinder Configuration Utility, ensure your system meets the following requirements:

### Hardware Requirements

- **Processor**: 1.6 GHz or faster processor
- **RAM**: 4 GB or more
- **Disk Space**: At least 200 MB of free disk space

### Software Requirements

- **Operating Systems**:
  - macOS 10.13 (High Sierra) or later
  - Windows 10 or later
  - Linux: Ubuntu 18.04+, Debian 10+, Fedora 30+, or other major distributions

- **Dependencies**:
  - rclone (automatically managed by the application)
  - Internet connection for cloud storage authentication

## 2. macOS Installation

### 2.1 Download the Installer

1. Download the appropriate installer for your Mac:
   - For Apple Silicon (M1/M2) Macs: `PageFinder Configuration-[version]-mac-arm64-installer.dmg`
   - For Intel Macs: `PageFinder Configuration-[version]-mac-x64-installer.dmg`

### 2.2 Install the Application

1. Open the downloaded DMG file by double-clicking it
2. Drag the PageFinder Configuration app to your Applications folder
3. Eject the DMG by dragging it to the Trash or right-clicking and selecting "Eject"

### 2.3 First Launch

1. Open the app from your Applications folder
   - Note: On first launch, macOS may display a security warning
   - If this happens, right-click (or Control-click) the app and select "Open"
   - Click "Open" in the dialog that appears

### 2.4 Gatekeeper Bypass (if needed)

If you encounter Gatekeeper issues:

1. Open System Preferences > Security & Privacy
2. Click the lock icon to make changes (enter your password)
3. Under "Allow apps downloaded from:", select "App Store and identified developers"
4. Look for a message about PageFinder Configuration being blocked
5. Click "Open Anyway" to allow the app to run

## 3. Windows Installation

### 3.1 Download the Installer

1. Download the Windows installer: `PageFinder Configuration-[version]-win-x64-setup.exe`

### 3.2 Install the Application

#### Standard Installation

1. Run the downloaded installer by double-clicking it
2. If a User Account Control (UAC) prompt appears, click "Yes"
3. Follow the on-screen instructions in the installer
4. Choose the installation location (default is recommended)
5. Select whether to create desktop and Start menu shortcuts
6. Click "Install" to begin the installation
7. Click "Finish" when the installation is complete

#### Portable Installation (Alternative)

If you prefer a portable installation:

1. Download the portable version: `PageFinder Configuration-[version]-win-x64-portable.exe`
2. Move the executable to your preferred location
3. Run the executable directly (no installation required)

### 3.3 First Launch

1. Launch the application from the Start menu, desktop shortcut, or installation location
2. Windows SmartScreen may display a warning on first launch
3. Click "More info" and then "Run anyway" to proceed

## 4. Linux Installation

### 4.1 Download the Package

Download the appropriate package for your distribution:
- AppImage: `PageFinder Configuration-[version]-linux-x86_64.AppImage`
- Debian/Ubuntu: `pagefinder-configuration_[version]_amd64.deb`

### 4.2 Install the Application

#### Using AppImage

1. Make the AppImage executable:
   ```bash
   chmod +x PageFinder\ Configuration-[version]-linux-x86_64.AppImage
   ```
2. Run the AppImage:
   ```bash
   ./PageFinder\ Configuration-[version]-linux-x86_64.AppImage
   ```

#### Using Debian/Ubuntu Package

1. Install the package:
   ```bash
   sudo dpkg -i pagefinder-configuration_[version]_amd64.deb
   ```
2. If there are dependency issues, resolve them:
   ```bash
   sudo apt-get install -f
   ```

### 4.3 First Launch

1. Launch the application from your applications menu or run it from the terminal
2. If the application doesn't start, check the terminal output for any error messages

## 5. Verifying Installation

After installation, verify that the application is working correctly:

1. Launch the application
2. Navigate to the Settings section
3. Verify that the rclone path is correct:
   - macOS/Linux: `/usr/local/bin/rclone` (default)
   - Windows: `rclone.exe` (assumed to be in PATH)
4. Verify that the workspace directory is correct:
   - macOS: `~/.config/pf-config` (default)
   - Windows: `%APPDATA%\pf-config` (default)
   - Linux: `~/.config/pf-config` (default)
5. Click "Save Settings" to save any changes

## 6. Troubleshooting

### 6.1 macOS Issues

#### "App is damaged and can't be opened" Error

1. Open Terminal
2. Run the following command:
   ```bash
   xattr -d com.apple.quarantine /Applications/PageFinder\ Configuration.app
   ```
3. Try launching the app again

#### "Unidentified Developer" Warning

1. Right-click (or Control-click) the app and select "Open"
2. Click "Open" in the dialog that appears

### 6.2 Windows Issues

#### Missing DLL Errors

1. Install the latest Visual C++ Redistributable:
   - Download from [Microsoft's website](https://support.microsoft.com/en-us/help/2977003/the-latest-supported-visual-c-downloads)
   - Run the installer and follow the instructions
2. Restart your computer
3. Try launching the app again

#### Permission Issues

1. Right-click the app and select "Run as administrator"
2. If this works, you may need to adjust the app's compatibility settings:
   - Right-click the app and select "Properties"
   - Go to the "Compatibility" tab
   - Check "Run this program as an administrator"
   - Click "Apply" and "OK"

### 6.3 Linux Issues

#### Missing Dependencies

1. Install required dependencies:
   ```bash
   sudo apt-get install libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 xdg-utils libatspi2.0-0 libuuid1 libsecret-1-0
   ```
2. Try launching the app again

#### AppImage Execution Issues

1. Ensure the AppImage has execute permissions:
   ```bash
   chmod +x PageFinder\ Configuration-[version]-linux-x86_64.AppImage
   ```
2. If you get "FUSE" related errors, install FUSE:
   ```bash
   sudo apt-get install fuse libfuse2
   ```
3. Try launching the app again

### 6.4 General Issues

#### rclone Not Found

1. Install rclone manually:
   - macOS: `brew install rclone`
   - Windows: Download from [rclone.org](https://rclone.org/downloads/)
   - Linux: `sudo apt-get install rclone` or equivalent for your distribution
2. Update the rclone path in the Settings section of the app

#### Workspace Directory Issues

1. Ensure the workspace directory exists and is writable
2. If you're using a custom workspace directory, ensure it's correctly specified in the Settings section
3. Try using the default workspace directory if you're experiencing issues

For additional help, refer to the [User Manual](user-manual.md) or contact support.