# PageFinder Configuration Utility - Troubleshooting Guide

This guide provides solutions for common issues you might encounter when using the PageFinder Configuration Utility.

## Table of Contents

1. [Installation Issues](#1-installation-issues)
2. [Configuration Issues](#2-configuration-issues)
3. [Cloud Storage Connection Issues](#3-cloud-storage-connection-issues)
4. [PageFinder Connection Issues](#4-pagefinder-connection-issues)
5. [Synchronization Issues](#5-synchronization-issues)
6. [Scheduling Issues](#6-scheduling-issues)
7. [Performance Issues](#7-performance-issues)
8. [Log Files and Diagnostics](#8-log-files-and-diagnostics)

## 1. Installation Issues

### Application Won't Install

#### macOS

**Issue**: The DMG file won't open or the application can't be dragged to Applications.

**Solutions**:
- Verify that the DMG file was downloaded completely
- Check if you have sufficient permissions to install applications
- Try downloading the DMG file again
- If you see "App is damaged" message, try:
  ```bash
  xattr -d com.apple.quarantine /Applications/PageFinder\ Configuration.app
  ```

#### Windows

**Issue**: The installer fails to run or completes with errors.

**Solutions**:
- Run the installer as Administrator
- Temporarily disable antivirus software
- Ensure you have sufficient disk space
- Install the latest Visual C++ Redistributable
- Try the portable version instead

#### Linux

**Issue**: The AppImage won't run or the package won't install.

**Solutions**:
- For AppImage: Ensure it has execute permissions
  ```bash
  chmod +x PageFinder\ Configuration-[version]-linux-x86_64.AppImage
  ```
- For Debian package: Resolve dependencies
  ```bash
  sudo apt-get install -f
  ```
- Check if FUSE is installed (required for AppImage)
  ```bash
  sudo apt-get install fuse libfuse2
  ```

### Application Won't Start

**Issue**: The application installs but doesn't start.

**Solutions**:
- Check if your system meets the minimum requirements
- Verify that no other instance of the application is running
- Check system logs for error messages
- Try reinstalling the application
- On macOS, check if the application is quarantined

## 2. Configuration Issues

### rclone Path Not Found

**Issue**: The application can't find rclone.

**Solutions**:
- Verify that rclone is installed on your system
- Check the rclone path in the Settings section
- Install rclone manually:
  - macOS: `brew install rclone`
  - Windows: Download from [rclone.org](https://rclone.org/downloads/)
  - Linux: `sudo apt-get install rclone` or equivalent
- Ensure rclone is in your system PATH or specify the full path in Settings

### Workspace Directory Issues

**Issue**: The application can't access or create the workspace directory.

**Solutions**:
- Verify that the workspace directory exists
- Check if you have write permissions for the directory
- Try using the default workspace directory
- Create the directory manually if it doesn't exist
- Check for disk space issues

### Settings Not Saving

**Issue**: Changes to settings aren't being saved.

**Solutions**:
- Ensure you click "Save Settings" after making changes
- Check if the application has write permissions for the config file
- Try running the application as Administrator (Windows) or with sudo (Linux)
- Check if the disk is full or write-protected

## 3. Cloud Storage Connection Issues

### Authentication Failures

**Issue**: Can't authenticate with cloud storage providers.

**Solutions**:
- Verify your internet connection
- Check if your credentials are correct
- Ensure the cloud service is operational
- Try clearing browser cookies and cache
- Check if your account has two-factor authentication enabled
- For Google Drive, ensure you're using the correct account

### Remote Creation Fails

**Issue**: Can't create a new remote.

**Solutions**:
- Check if you've reached the maximum limit of 3 remotes
- Verify that the remote name doesn't contain spaces or special characters
- Ensure you have a stable internet connection
- Check if rclone is properly configured
- Try creating the remote manually using rclone command line

### Remote Check Fails

**Issue**: The "Check" button shows connection failure.

**Solutions**:
- Verify your internet connection
- Check if your authentication has expired
- Ensure the cloud service is operational
- Try removing and re-adding the remote
- Check if the subfolder path is correct
- Verify that you have access to the specified folder

## 4. PageFinder Connection Issues

### Configuration Import Fails

**Issue**: Can't import PageFinder configuration.

**Solutions**:
- Verify that the configuration file is valid
- Check if the file has the correct format
- Ensure you have read permissions for the file
- Try selecting a different configuration file

### Connection Test Fails

**Issue**: The "Test Connection" button shows failure.

**Solutions**:
- Verify your internet connection
- Check if your PageFinder credentials are valid
- Ensure the PageFinder service is operational
- Verify that the bucket and prefix in the configuration are correct
- Check if you have the necessary permissions to access the bucket

### Purge Operation Fails

**Issue**: The purge operation fails or shows errors.

**Solutions**:
- Check if you have the necessary permissions
- Verify that your PageFinder configuration is correct
- Ensure you have a stable internet connection
- Try running the purge test first to identify issues
- Check the purge log for specific error messages

## 5. Synchronization Issues

### Sync Test Fails

**Issue**: The sync test shows errors or warnings.

**Solutions**:
- Check both cloud storage and PageFinder connections
- Verify that you have the necessary permissions
- Ensure you have a stable internet connection
- Check if there are any file naming conflicts
- Review the sync log for specific error messages

### Sync Execution Fails

**Issue**: The sync execution fails or gets stuck.

**Solutions**:
- Check if you have sufficient disk space for temporary files
- Verify that you have a stable internet connection
- Ensure that both cloud storage and PageFinder are accessible
- Check if there are any large files that might be causing timeouts
- Try synchronizing with smaller batches of files
- Review the sync log for specific error messages

### Files Not Syncing

**Issue**: Some files aren't being synchronized.

**Solutions**:
- Check if the files are in the specified subfolder
- Verify that the files aren't excluded by rclone filters
- Check if the files have unsupported characters in their names
- Ensure the files aren't too large for synchronization
- Check if the files are being modified during synchronization

## 6. Scheduling Issues

### Schedule Setup Fails

**Issue**: Can't set up scheduled synchronization.

**Solutions**:
- Verify that you have the necessary permissions to create scheduled tasks
- Check if the time format is correct (HH:MM in 24-hour format)
- Ensure the application has the necessary permissions to run scripts
- Try setting up the schedule manually using cron (Linux/macOS) or Task Scheduler (Windows)

### Scheduled Sync Doesn't Run

**Issue**: The scheduled synchronization doesn't run at the specified time.

**Solutions**:
- Verify that your computer was on at the scheduled time
- Check if the scheduled task or cron job was created successfully
- Ensure the application has the necessary permissions
- Check system logs for any error messages
- Verify that the workspace directory is accessible
- Try running the sync manually to check for issues

## 7. Performance Issues

### Application Runs Slowly

**Issue**: The application is slow or unresponsive.

**Solutions**:
- Check if your system meets the recommended requirements
- Close other resource-intensive applications
- Verify that you have sufficient disk space
- Check if there are many files being processed
- Try restarting the application

### Synchronization Takes Too Long

**Issue**: Synchronization takes an excessive amount of time.

**Solutions**:
- Check your internet connection speed
- Verify that you're not synchronizing unnecessary files
- Use subfolder paths to limit the scope of synchronization
- Consider synchronizing during off-peak hours
- Check if there are many small files (which can slow down synchronization)
- Try breaking up the synchronization into smaller batches

## 8. Log Files and Diagnostics

### Accessing Log Files

The application stores log files in the workspace directory:

- `sync.log`: Contains logs from synchronization operations
- `purge.log`: Contains logs from purge operations
- `app-config.json`: Contains application configuration

To access these files:

1. Navigate to the workspace directory:
   - macOS: `~/.config/pf-config` (default)
   - Windows: `%APPDATA%\pf-config` (default)
   - Linux: `~/.config/pf-config` (default)
2. Open the log files with a text editor

### Understanding Log Messages

Log files contain valuable information for diagnosing issues:

- **Date and Time**: When the operation occurred
- **Operation**: What action was being performed
- **Status**: Success, warning, or error
- **Details**: Specific information about the operation

Common error messages and their meanings:

- `Failed to authenticate`: Authentication issues with cloud storage
- `Permission denied`: Insufficient permissions to access files or folders
- `Not found`: The specified file or folder doesn't exist
- `Network error`: Connection issues
- `Timeout`: The operation took too long to complete

### Reporting Issues

If you encounter an issue that you can't resolve using this guide:

1. Collect the relevant log files
2. Take screenshots of any error messages
3. Note the steps to reproduce the issue
4. Contact support with this information

## Additional Resources

- [User Manual](user-manual.md) - Comprehensive guide to using the application
- [Technical Reference](technical-reference.md) - Technical details about the application
- [Installation Guide](installation-guide.md) - Detailed installation instructions