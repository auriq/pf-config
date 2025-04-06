# Troubleshooting Guide

This guide provides solutions for common issues you might encounter while using the PageFinder Configuration application.

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Cloud Storage Configuration Issues](#cloud-storage-configuration-issues)
3. [PageFinder Configuration Issues](#pagefinder-configuration-issues)
4. [Connection Testing Issues](#connection-testing-issues)
5. [Synchronization Issues](#synchronization-issues)
6. [Scheduling Issues](#scheduling-issues)
7. [Diagnostic Tools](#diagnostic-tools)

## Installation Issues

### Application Fails to Start

**Symptoms:**
- Application crashes on startup
- Blank window appears
- Error dialog shows on startup

**Solutions:**
1. Check that your system meets the minimum requirements
2. Reinstall the application
3. Check for corrupted configuration files:
   ```
   # Windows
   del "%USERPROFILE%\AppData\Roaming\pf-config\settings.json"
   
   # macOS/Linux
   rm ~/.config/pf-config/settings.json
   ```
4. Start the application with the `--reset-config` flag (if supported)

### Rclone Not Found

**Symptoms:**
- Error message: "Rclone path not configured" or "Rclone not found"
- Unable to perform any cloud operations

**Solutions:**
1. Install rclone from [rclone.org](https://rclone.org/downloads/)
2. Manually set the rclone path in the application settings
3. Ensure rclone is in your system PATH
4. Check rclone works by running in terminal:
   ```
   rclone --version
   ```

## Cloud Storage Configuration Issues

### Authentication Failures

**Symptoms:**
- Error during OAuth flow
- "Failed to authenticate" messages
- Redirects fail during authentication

**Solutions:**
1. Check your internet connection
2. Ensure your system clock is accurate
3. Clear browser cookies and cache
4. Try a different browser for the OAuth flow
5. Check if you're behind a corporate firewall or VPN that might block OAuth

### Token Expiration

**Symptoms:**
- "Token has expired" errors
- Previously working remotes no longer connect
- Authentication failures after some time

**Solutions:**
1. Delete and recreate the remote connection
2. Check that your system clock is accurate
3. Ensure your account has not had permissions changed
4. Verify the OAuth application has not been revoked in your cloud provider settings

### Cannot Connect to Local Storage

**Symptoms:**
- "Cannot access path" errors
- Local storage tests fail
- Permission errors

**Solutions:**
1. Check that the path exists
2. Verify you have read/write permissions to the folder
3. Try a different folder location
4. Check for file locks or other processes using the folder

## PageFinder Configuration Issues

### Invalid Configuration File

**Symptoms:**
- "Not a valid rclone config file" error
- PageFinder validation fails
- Missing sections in the config file

**Solutions:**
1. Obtain a fresh copy of the correct configuration file
2. Check the file format matches rclone expectations
3. Verify the file contains all required sections and parameters
4. Check for syntax errors in the configuration

### Connection Failure

**Symptoms:**
- "Connection failed" when testing PageFinder
- Timeout errors
- Authentication errors

**Solutions:**
1. Check your internet connection
2. Verify your PageFinder credentials are correct
3. Ensure the endpoint URL is correct
4. Check if your account has the necessary permissions
5. Verify firewall rules allow connections to the PageFinder endpoints

## Connection Testing Issues

### Test Connection Fails

**Symptoms:**
- "Connection test failed" message
- Specific error messages in the test output
- Incomplete test results

**Solutions:**
1. Check both cloud storage and PageFinder configurations independently
2. Look for specific error messages in the test output
3. Verify network connectivity to both services
4. Check for token or authentication issues

### Synchronization Test Does Not Complete

**Symptoms:**
- Test hangs or times out
- Partial test results
- "Process terminated unexpectedly"

**Solutions:**
1. Check for large files that might cause timeouts
2. Verify network stability during the test
3. Check disk space for temporary files
4. Increase timeout settings if possible

## Synchronization Issues

### Files Not Synchronizing

**Symptoms:**
- Files missing after sync
- Sync reports success but files aren't transferred
- Partial file transfers

**Solutions:**
1. Check file permissions on both sources and destinations
2. Verify file patterns aren't excluding your files
3. Check for file name compatibility issues
4. Look for detailed error messages in the sync log

### Sync Conflicts

**Symptoms:**
- Duplicate files with conflict markers
- Error messages about conflicting changes
- Files overwritten unexpectedly

**Solutions:**
1. Ensure you're not modifying files in both locations simultaneously
2. Check timestamps on files
3. Use the sync log to identify specific conflict issues
4. Consider using rclone flags to handle conflicts (e.g., `--backup-dir`)

## Scheduling Issues

### Scheduled Syncs Not Running

**Symptoms:**
- No synchronization at scheduled times
- Missing log entries for scheduled runs
- Schedule status shows as inactive

**Solutions:**
1. Verify the schedule is enabled in the application
2. Check system power settings (sleep/hibernate might prevent execution)
3. Ensure the application is running or set to auto-start
4. Check for credential or token expiration issues

### Schedule Settings Not Saving

**Symptoms:**
- Schedule resets to default values
- "Failed to save schedule" errors
- Schedule appears saved but doesn't activate

**Solutions:**
1. Check write permissions to the configuration directory
2. Verify the format of schedule times
3. Try setting a different schedule time
4. Check for conflicting schedules

## Diagnostic Tools

### Log File Analysis

The application maintains several log files that can help diagnose issues:

1. **Application Logs**: Located in the logs directory, contain general application operations
2. **Sync Logs**: Specific logs for synchronization operations
3. **rclone Logs**: Detailed logs from rclone operations

To analyze these logs:
1. Open the Logs section in the application
2. Click "View Sync Log" to see the most recent sync log
3. Check the timestamps and error messages
4. Look for patterns in failures

### Command Line Testing

You can use rclone directly to test and diagnose issues:

```bash
# Test cloud storage
rclone --config /path/to/cloud.conf lsd remote:

# Test PageFinder
rclone --config /path/to/pf.conf lsd pagefinder:

# Test combined operation
rclone --config /path/to/rclone.conf copy remote:path pagefinder:path
```

### Network Diagnostics

For connectivity issues:
1. Check if you can reach the cloud provider and PageFinder endpoints
2. Verify your firewall allows the necessary connections
3. Test basic internet connectivity
4. Check for VPN or proxy issues that might affect authentication

### Reporting Issues

When reporting issues to support, include:
1. Application version
2. Operating system and version
3. Detailed error messages
4. Steps to reproduce the issue
5. Relevant log files (make sure to redact any sensitive information)
6. Information about your network environment

## Resetting the Application

As a last resort, you can reset the application to default settings:

1. Close the application
2. Backup your configuration directory
3. Remove or rename the configuration directory
4. Restart the application to create fresh configuration files
5. Reconfigure your remotes and PageFinder connection

**Windows:**
```
xcopy /E /I "%USERPROFILE%\AppData\Roaming\pf-config" "%USERPROFILE%\AppData\Roaming\pf-config-backup"
rmdir /S /Q "%USERPROFILE%\AppData\Roaming\pf-config"
```

**macOS/Linux:**
```
cp -r ~/.config/pf-config ~/.config/pf-config-backup
rm -rf ~/.config/pf-config
```

## Contact Support

If you've tried the troubleshooting steps above and still experience issues, contact support with:

1. Description of the issue
2. Steps taken to troubleshoot
3. Error messages and logs
4. System configuration details