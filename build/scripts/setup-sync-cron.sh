#!/bin/bash
# PageFinder Configuration - Crontab Setup Script
# This script sets up a crontab entry to run sync.sh at a specified time
# Usage: ./setup-sync-cron.sh HH:MM

# Add debugging information
echo "===== SETUP-SYNC-CRON SCRIPT DEBUG INFO ====="
echo "Current directory: $(pwd)"
echo "Script path: $0"
echo "Script arguments: $@"
echo "Environment variables:"
env | sort
echo "===== END DEBUG INFO ====="

# Avoid using BASH_SOURCE which might cause issues
# Instead, use the SCRIPTS_PATH environment variable if available
if [ -n "$SCRIPTS_PATH" ]; then
    SCRIPT_DIR="$SCRIPTS_PATH"
    echo "Using SCRIPTS_PATH from environment: $SCRIPT_DIR"
else
    # Fallback to relative path resolution
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    echo "Using relative path resolution: $SCRIPT_DIR"
fi

# Load environment variables from .env file
if [ -f "$SCRIPT_DIR/env-loader.sh" ]; then
    echo "Loading environment from: $SCRIPT_DIR/env-loader.sh"
    source "$SCRIPT_DIR/env-loader.sh"
else
    echo "Warning: env-loader.sh not found at $SCRIPT_DIR/env-loader.sh"
fi

# Function to display usage information
usage() {
    echo "Usage: $0 HH:MM"
    echo "  HH:MM - Time to run sync.sh in 24-hour format (e.g., 14:30 for 2:30 PM)"
    exit 1
}

# Function to validate time format
validate_time() {
    local time_pattern="^([0-1][0-9]|2[0-3]):([0-5][0-9])$"
    if [[ ! $1 =~ $time_pattern ]]; then
        echo "Error: Invalid time format. Please use HH:MM in 24-hour format."
        usage
    fi
}

# Check if a time argument was provided
if [ $# -ne 1 ]; then
    echo "Error: Missing time argument."
    usage
fi

# Validate the time format
validate_time "$1"

# Extract hours and minutes
HOURS=$(echo "$1" | cut -d':' -f1)
MINUTES=$(echo "$1" | cut -d':' -f2)

# Get the absolute path to sync.sh
# Use the already determined SCRIPT_DIR
SYNC_SCRIPT="$SCRIPT_DIR/sync.sh"

# In production builds, use the SCRIPTS_PATH from environment if available
if [ -n "$SCRIPTS_PATH" ]; then
    echo "Using SCRIPTS_PATH from environment: $SCRIPTS_PATH"
    SYNC_SCRIPT="$SCRIPTS_PATH/sync.sh"
    echo "Using sync script at: $SYNC_SCRIPT"
fi

# If we're in an app bundle, log it but don't use the app executable path
if [[ "$SCRIPT_DIR" == *"/Resources/scripts" ]]; then
    echo "Running from within an app bundle, but using direct script path for reliability"
    
    # Check if we're in the PageFinder Configuration.app bundle
    if [[ "$SCRIPT_DIR" == *"/PageFinder Configuration.app/Contents/Resources/scripts" ]]; then
        echo "Detected PageFinder Configuration.app bundle"
    fi
    
    # Check if /Applications/PageFinder Configuration.app exists
    if [ -d "/Applications/PageFinder Configuration.app" ]; then
        echo "Found application at: /Applications/PageFinder Configuration.app"
        # Set SCRIPTS_PATH to the scripts directory in the application bundle
        SCRIPTS_PATH="/Applications/PageFinder Configuration.app/Contents/Resources/scripts"
        echo "Setting SCRIPTS_PATH to: $SCRIPTS_PATH"
        # Update SYNC_SCRIPT to use this path
        SYNC_SCRIPT="$SCRIPTS_PATH/sync.sh"
        echo "Updated SYNC_SCRIPT to: $SYNC_SCRIPT"
    fi
fi

# Check if sync.sh exists
if [ ! -f "$SYNC_SCRIPT" ]; then
    echo "Error: sync.sh not found at $SYNC_SCRIPT"
    exit 1
fi

# Make sure sync.sh is executable
chmod +x "$SYNC_SCRIPT"

# Create the crontab entry with a comment for identification and environment variables
# Include SCRIPTS_PATH in the environment variables
CRON_ENTRY="$MINUTES $HOURS * * * RCLONE_PATH='$RCLONE_PATH' WORKSPACE_DIR='$WORKSPACE_DIR' SCRIPTS_PATH='$SCRIPTS_PATH' $SYNC_SCRIPT -e # PageFinder Daily Sync"

# Check if our specific entry already exists in crontab
if crontab -l 2>/dev/null | grep -q "# PageFinder Daily Sync"; then
    echo "A PageFinder Daily Sync crontab entry already exists. Updating it..."
    # Remove existing entry and add the new one
    (crontab -l 2>/dev/null | grep -v "# PageFinder Daily Sync"; echo "$CRON_ENTRY") | crontab -
else
    # Add the new entry to crontab
    # Ensure there's a newline at the end of existing entries
    (crontab -l 2>/dev/null | sed -e '$a\' ; echo "$CRON_ENTRY") | crontab -
fi

# Verify the crontab entry was added
if crontab -l 2>/dev/null | grep -q "# PageFinder Daily Sync"; then
    echo "Success: Crontab entry added to run sync.sh at $1 daily."
    echo "Current crontab entries:"
    crontab -l
else
    echo "Error: Failed to add crontab entry."
    exit 1
fi

exit 0