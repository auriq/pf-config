#!/bin/bash

# Sync script for PageFinder
# This script is generated automatically by the PageFinder Configuration tool
# Generated on: 2025-03-27T01:55:14.299Z

# Set UTF-8 locale to handle double-byte characters correctly
export LC_ALL=en_US.UTF-8
export LANG=en_US.UTF-8
export LANGUAGE=en_US.UTF-8

# Configuration
RCLONE_PATH="/usr/local/bin/rclone"
CONFIG_PATH="/Users/koi/.config/pf-config/rclone.conf"
LOG_DIR="/Users/koi/work/pf-config/logs"
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
log "Syncing g1 to PageFinder..."
"/usr/local/bin/rclone" sync "g1:" "pf-user-2:asi-essentia-ai-new/user/pf-user-2/g1" -P --config "/Users/koi/.config/pf-config/rclone.conf" >> "${LOG_FILE}" 2>&1
if [ $? -eq 0 ]; then
    log "Sync for g1 completed successfully"
else
    log "ERROR: Sync for g1 failed"
fi

log "Syncing box to PageFinder..."
"/usr/local/bin/rclone" sync "box:Poc_e250214" "pf-user-2:asi-essentia-ai-new/user/pf-user-2/box" -P --config "/Users/koi/.config/pf-config/rclone.conf" >> "${LOG_FILE}" 2>&1
if [ $? -eq 0 ]; then
    log "Sync for box completed successfully"
else
    log "ERROR: Sync for box failed"
fi

log "Syncing koi to PageFinder..."
"/usr/local/bin/rclone" sync "koi:/Users/koi/Desktop/sample/testdoc/jp/invoice" "pf-user-2:asi-essentia-ai-new/user/pf-user-2/koi" -P --config "/Users/koi/.config/pf-config/rclone.conf" >> "${LOG_FILE}" 2>&1
if [ $? -eq 0 ]; then
    log "Sync for koi completed successfully"
else
    log "ERROR: Sync for koi failed"
fi



log "===== PageFinder Sync Job Completed at $(date) ====="