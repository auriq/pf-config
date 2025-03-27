#!/bin/bash

# Sync script for PageFinder
# This script is generated automatically by the PageFinder Configuration tool
# Generated on: {{DATE}}

# Set UTF-8 locale to handle double-byte characters correctly
export LC_ALL=en_US.UTF-8
export LANG=en_US.UTF-8
export LANGUAGE=en_US.UTF-8

# Configuration
RCLONE_PATH="{{RCLONE_PATH}}"
CONFIG_PATH="{{CONFIG_PATH}}"
LOG_DIR="{{LOG_DIR}}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="${LOG_DIR}/sync_${TIMESTAMP}.log"

# Create log directory if it doesn't exist
mkdir -p "${LOG_DIR}"

# Log header (using UTF-8 encoding)
echo -e "===== PageFinder Sync Job Started at $(date) =====" > "${LOG_FILE}"
echo -e "Using config file: ${CONFIG_PATH}" >> "${LOG_FILE}"
echo -e "Encoding: UTF-8" >> "${LOG_FILE}"
echo -e "" >> "${LOG_FILE}"

# Function to log messages (handles double-byte characters correctly)
log() {
    # Use printf with %b to interpret escape sequences and handle UTF-8 correctly
    printf "[%s] %b\n" "$(date +"%Y-%m-%d %H:%M:%S")" "$1" >> "${LOG_FILE}"
    printf "[%s] %b\n" "$(date +"%Y-%m-%d %H:%M:%S")" "$1"
}

# Check if rclone exists
if [ ! -f "${RCLONE_PATH}" ]; then
    log "ERROR: rclone not found at ${RCLONE_PATH}"
    exit 1
fi

# Run sync commands
{{SYNC_COMMANDS}}

log "===== PageFinder Sync Job Completed at $(date) ====="