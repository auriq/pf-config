# PageFinder Configuration User Guide

This guide provides step-by-step instructions for using the PageFinder Configuration application.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Cloud Storage Configuration](#cloud-storage-configuration)
3. [PageFinder Configuration](#pagefinder-configuration)
4. [Testing Connections](#testing-connections)
5. [Scheduling Synchronization](#scheduling-synchronization)
6. [Managing Logs](#managing-logs)

## Getting Started

### Installation

1. Download the application package for your operating system
2. Install the application following the platform-specific instructions
3. Ensure rclone is installed on your system:
   - Windows: Download and install from [rclone.org](https://rclone.org/downloads/)
   - macOS: `brew install rclone`
   - Linux: `sudo apt install rclone` or equivalent for your distribution

### Initial Setup

Upon first launch, the application will:
1. Create necessary configuration directories
2. Prompt for rclone path if not found automatically
3. Display the main interface with the Cloud Configuration section active

## Cloud Storage Configuration

### Adding a New Cloud Storage Provider

1. Navigate to the "Cloud Configuration" section using the sidebar
2. Select a storage provider from the grid (Google Drive, OneDrive, Dropbox, Box, or Local)
3. Enter a name for the remote connection
4. For cloud providers:
   - Follow the OAuth authentication flow in the browser
   - Grant necessary permissions
5. For local storage:
   - Enter or browse for the local folder path
6. Click "Add" to create the remote

### Managing Cloud Storage

#### Testing a Remote

1. Click the check icon next to a remote in the list
2. View the connection status and details in the Remote Status panel
3. Use the "Use ls command" checkbox for detailed file listings

#### Setting Subfolder Restrictions

1. Click the folder icon next to a remote in the list
2. Enter the subfolder path in the dialog
3. Click "Confirm" to save the restriction

#### Deleting a Remote

1. Click the delete icon next to a remote in the list
2. Confirm the deletion when prompted
3. The remote will be removed from the list

## PageFinder Configuration

### Setting Up PageFinder

1. Navigate to the "PageFinder Configuration" section using the sidebar
2. If you have an existing PageFinder configuration file:
   - Click "Browse" to locate your PageFinder configuration file
   - Click "Validate" to import the configuration
3. If you need to create a new configuration:
   - Follow the instructions from your PageFinder administrator

### Testing PageFinder Connection

1. After configuring PageFinder, click "Check Connection"
2. View the connection status and details in the Connection Details panel
3. Use the "Use ls command" checkbox for detailed file listings

## Testing Connections

### Testing Cloud to PageFinder Connection

1. Navigate to the "Test Connection" section using the sidebar
2. Click "Run Test Connection" to test connectivity between cloud storage and PageFinder
3. View the test results in the Test Connection Details panel
4. If the test is successful, the "Sync Now" button will become available

### Running Synchronization

1. After a successful connection test, click "Sync Now" to perform a synchronization
2. View the synchronization results in the Test Connection Details panel
3. Check for any errors or warnings in the output

## Scheduling Synchronization

### Setting Up a Schedule

1. Navigate to the "Schedule" section using the sidebar
2. Enable scheduling by checking the "Enable Schedule" checkbox
3. Select the frequency (Daily or Weekly)
4. For Daily schedule:
   - Select the hour and minute
5. For Weekly schedule:
   - Select the day of the week
   - Select the hour and minute
6. Click "Save Schedule" to activate

### Managing Schedules

- To update a schedule, change the settings and click "Save Schedule"
- To disable scheduling, uncheck the "Enable Schedule" checkbox and click "Save Schedule"

## Managing Logs

### Viewing Logs

1. Navigate to the "Logs" section using the sidebar
2. Click "View Sync Log" to display the most recent synchronization log
3. Use the scroll bars to navigate through the log content

### Cleaning Logs

1. To clean old log files, click "Clean Logs"
2. Confirm the cleaning operation when prompted
3. Old log files will be removed, keeping only recent logs

## Troubleshooting

### Common Issues

#### Rclone Not Found

1. Navigate to the main Cloud Configuration section
2. Click "Configure Rclone Path" if available
3. Enter the path to your rclone executable
4. Click "Confirm" to save

#### Authentication Failures

1. Delete the problematic remote
2. Add the remote again, completing a fresh authentication process
3. Test the connection to verify proper authentication

#### Connection Test Failures

1. Check that both cloud storage and PageFinder configurations are valid
2. Verify network connectivity
3. Check the test output for specific error messages
4. Consult the [Troubleshooting Guide](troubleshooting.md) for specific errors

### Getting Help

If you encounter issues not covered in this guide, refer to:
- The [Troubleshooting Guide](troubleshooting.md)
- Contact your system administrator