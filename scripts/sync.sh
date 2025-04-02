#!/bin/bash

# Sync script for PageFinder
# This script is generated automatically by the PageFinder Configuration tool
# Generated on: 2025-04-02T05:33:38.555Z

# Set UTF-8 locale to handle double-byte characters correctly
export LC_ALL=en_US.UTF-8
export LANG=en_US.UTF-8
export LANGUAGE=en_US.UTF-8

# Default options
DRY_RUN="--dry-run"
VERBOSE=""

# Parse command line options
while getopts "ev" opt; do
  case $opt in
    e) DRY_RUN="" ;; # Execute mode (no dry-run)
    v) VERBOSE="-v" ;; # Verbose mode
    *) echo "Usage: $0 [-e] [-v]" >&2
       echo "  -e: Execute mode (actually perform operations, not just dry-run)" >&2
       echo "  -v: Verbose mode" >&2
       exit 1 ;;
  esac
done

# Configuration
RCLONE_PATH="/usr/local/bin/rclone"
CONFIG_PATH="/Users/koi/.config/pf-config/rclone.conf"
LOG_DIR="/Users/koi/work/pf-config/logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="${LOG_DIR}/sync_detail.log"

# Create log directory if it doesn't exist
mkdir -p "${LOG_DIR}"

# Event log file for scheduled executions (append mode)
EVENT_LOG="${LOG_DIR}/sync_events.log"

# Log header (using UTF-8 encoding)
echo -e "\n===== PageFinder Sync Job Started at $(date) =====" >> "${LOG_FILE}"
echo -e "Using config file: ${CONFIG_PATH}" >> "${LOG_FILE}"
echo -e "Encoding: UTF-8" >> "${LOG_FILE}"
if [ -n "$DRY_RUN" ]; then
    echo -e "Mode: DRY RUN (no changes will be made)" >> "${LOG_FILE}"
else
    echo -e "Mode: EXECUTE (changes will be made)" >> "${LOG_FILE}"
fi
if [ -n "$VERBOSE" ]; then
    echo -e "Verbose: YES" >> "${LOG_FILE}"
else
    echo -e "Verbose: NO" >> "${LOG_FILE}"
fi
echo -e "" >> "${LOG_FILE}"

# Append to event log
if [ -n "$DRY_RUN" ]; then
    if [ -n "$VERBOSE" ]; then
        echo -e "[$(date +"%Y-%m-%d %H:%M:%S")] Sync job started. Mode: DRY-RUN Verbose: YES" >> "${EVENT_LOG}"
    else
        echo -e "[$(date +"%Y-%m-%d %H:%M:%S")] Sync job started. Mode: DRY-RUN Verbose: NO" >> "${EVENT_LOG}"
    fi
else
    if [ -n "$VERBOSE" ]; then
        echo -e "[$(date +"%Y-%m-%d %H:%M:%S")] Sync job started. Mode: EXECUTE Verbose: YES" >> "${EVENT_LOG}"
    else
        echo -e "[$(date +"%Y-%m-%d %H:%M:%S")] Sync job started. Mode: EXECUTE Verbose: NO" >> "${EVENT_LOG}"
    fi
fi

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

# Use environment variable for config if set
if [ -n "$RCLONE_CONFIG" ]; then
    CONFIG="$RCLONE_CONFIG"
else
    CONFIG="$CONFIG_PATH"
fi

# SECTION 1: PURGE OPERATIONS
# This section handles all purge operations to ensure they are completed before any sync operations

# Set up common variables
DEST_PATH="pf-user-2:asi-essentia-ai-new/user/pf-user-2"
CLOUD_REMOTES="ko2 box5"

# Function to purge a folder
purge_folder() {
    local folder=$1
    local path=$2
    
    log "Folder ${folder} does not exist in remotes list, deleting..."
    if [ -n "$DRY_RUN" ]; then
        log "DRY RUN: Would delete folder ${folder}"
        log "Executing command: \"${RCLONE_PATH}\" purge \"${path}\" --dry-run $VERBOSE --config \"${CONFIG}\""
        "${RCLONE_PATH}" purge "${path}" --dry-run $VERBOSE --config "${CONFIG}" 2>&1 | tee -a "${LOG_FILE}"
    else
        log "Executing command: \"${RCLONE_PATH}\" purge \"${path}\" $VERBOSE --config \"${CONFIG}\""
        "${RCLONE_PATH}" purge "${path}" $VERBOSE --config "${CONFIG}" 2>&1 | tee -a "${LOG_FILE}"
        if [ $? -eq 0 ]; then
            log "Folder ${folder} deleted successfully"
        else
            log "ERROR: Failed to delete folder ${folder}"
        fi
    fi
}

# Check if RCLONE_FOLDERS_TO_DELETE is set (for test connection)
if [ -n "$RCLONE_FOLDERS_TO_DELETE" ]; then
    # Parse JSON array of folders to delete
    log "Processing folders to delete from environment variable..."
    
    # Process each folder to delete
    for FOLDER in $(echo "$RCLONE_FOLDERS_TO_DELETE" | tr -d '[]"' | tr ',' ' '); do
        if [ -n "$FOLDER" ]; then
            DELETE_PATH="${DEST_PATH}/${FOLDER}"
            purge_folder "${FOLDER}" "${DELETE_PATH}"
        fi
    done
elif [ -n "$RCLONE_DELETE" ]; then
    # Use environment variable for delete path
    DELETE_PATH="$RCLONE_DELETE"
    
    # Extract folder name from delete path
    FOLDER=$(basename "$DELETE_PATH")
    purge_folder "${FOLDER}" "${DELETE_PATH}"
else
    # Check for folders in the destination that don't exist in the remotes list
    log "Checking for folders to delete in destination..."

    # List folders in the destination
    log "Listing folders in destination: ${DEST_PATH}"
    log "Executing command: \"${RCLONE_PATH}\" lsd \"${DEST_PATH}\" --config \"${CONFIG}\""
    FOLDERS=$("${RCLONE_PATH}" lsd "${DEST_PATH}" --config "${CONFIG}" 2>&1 | tee -a "${LOG_FILE}" | awk '{print $NF}')

    # Check each folder
    for FOLDER in $FOLDERS; do
        # Check if the folder exists in the remotes list
        # Use word boundaries to avoid partial matches (e.g., "box" matching "box2")
        if ! echo " ${CLOUD_REMOTES} " | grep -q " ${FOLDER} "; then
            DELETE_PATH="${DEST_PATH}/${FOLDER}"
            purge_folder "${FOLDER}" "${DELETE_PATH}"
        fi
    done
fi

# Add a separator line in the log
log "----------------------------------------"
log "Purge operations completed. Starting sync operations."
log "----------------------------------------"

# SECTION 2: SYNC OPERATIONS
# This section handles all sync operations after purge operations are completed

# Check if RCLONE_REMOTES is set (for test connection)
if [ -n "$RCLONE_REMOTES" ]; then
    # Parse JSON array of remotes
    log "Processing remotes from environment variable..."
    
    # Process each remote
    echo "$RCLONE_REMOTES" | tr -d '[]{}' | tr ',' '\n' | while read -r REMOTE_LINE; do
        # Extract name, source, and dest from the line
        # Format is like: "name":"gd","source":"gd:","dest":"pf-user-2:asi-essentia-ai-new/user/pf-user-2/gd"
        REMOTE_NAME=$(echo "$REMOTE_LINE" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
        SOURCE=$(echo "$REMOTE_LINE" | grep -o '"source":"[^"]*"' | cut -d'"' -f4)
        DEST=$(echo "$REMOTE_LINE" | grep -o '"dest":"[^"]*"' | cut -d'"' -f4)
        
        if [ -n "$REMOTE_NAME" ] && [ -n "$SOURCE" ] && [ -n "$DEST" ]; then
            log "Syncing ${REMOTE_NAME} to PageFinder..."
            if [ -n "$DRY_RUN" ]; then
                log "DRY RUN: Would sync ${SOURCE} to ${DEST}"
                log "Executing command: \"${RCLONE_PATH}\" sync \"${SOURCE}\" \"${DEST}\" --dry-run $VERBOSE --config \"${CONFIG}\""
                "${RCLONE_PATH}" sync "${SOURCE}" "${DEST}" --dry-run $VERBOSE --config "${CONFIG}" 2>&1 | tee -a "${LOG_FILE}"
            else
                log "Executing command: \"${RCLONE_PATH}\" sync \"${SOURCE}\" \"${DEST}\" $VERBOSE --config \"${CONFIG}\""
                "${RCLONE_PATH}" sync "${SOURCE}" "${DEST}" $VERBOSE --config "${CONFIG}" 2>&1 | tee -a "${LOG_FILE}"
                if [ $? -eq 0 ]; then
                    log "Sync for ${REMOTE_NAME} completed successfully"
                else
                    log "ERROR: Sync for ${REMOTE_NAME} failed"
                fi
            fi
        fi
    done
elif [ -n "$RCLONE_SOURCE" ] && [ -n "$RCLONE_DEST" ]; then
    # Use environment variables for source and destination
    SOURCE="$RCLONE_SOURCE"
    DEST="$RCLONE_DEST"
    
    # Extract remote name from source
    REMOTE_NAME=$(echo "$SOURCE" | cut -d: -f1)
    
    log "Syncing ${REMOTE_NAME} to PageFinder..."
    if [ -n "$DRY_RUN" ]; then
        log "DRY RUN: Would sync ${SOURCE} to ${DEST}"
        log "Executing command: \"${RCLONE_PATH}\" sync \"${SOURCE}\" \"${DEST}\" --dry-run $VERBOSE --config \"${CONFIG}\""
        "${RCLONE_PATH}" sync "${SOURCE}" "${DEST}" --dry-run $VERBOSE --config "${CONFIG}" 2>&1 | tee -a "${LOG_FILE}"
    else
        log "Executing command: \"${RCLONE_PATH}\" sync \"${SOURCE}\" \"${DEST}\" $VERBOSE --config \"${CONFIG}\""
        "${RCLONE_PATH}" sync "${SOURCE}" "${DEST}" $VERBOSE --config "${CONFIG}" 2>&1 | tee -a "${LOG_FILE}"
        if [ $? -eq 0 ]; then
            log "Sync for ${REMOTE_NAME} completed successfully"
        else
            log "ERROR: Sync for ${REMOTE_NAME} failed"
        fi
    fi
else
    # Use configured sync commands for all remotes in CLOUD_REMOTES
    for REMOTE in $CLOUD_REMOTES; do
        # Get the remote type and path from the config file
        REMOTE_TYPE=$(grep -A10 "^\[${REMOTE}\]" "${CONFIG}" | grep "type" | head -1 | cut -d= -f2 | tr -d ' ')
        
        # Set source path based on remote type
        # Check if there's a subfolder path set for this remote
        # Extract the remote section from the config file
        REMOTE_SECTION=$(grep -A50 "^\[${REMOTE}\]" "${CONFIG}" | sed -n "/^\[${REMOTE}\]/,/^\[/p" | grep -v "^\[" | grep -v "^$" | tail -n +2)
        
        # Look for subfolder in the remote section only
        SUBFOLDER=$(echo "$REMOTE_SECTION" | grep "^subfolder" | cut -d= -f2 | tr -d ' ')
        
        if [ "$REMOTE_TYPE" = "local" ]; then
            # For local remotes, get the path from the config
            REMOTE_PATH=$(echo "$REMOTE_SECTION" | grep "^path" | cut -d= -f2 | tr -d ' ')
            SOURCE_PATH="${REMOTE_PATH}"
            log "Remote ${REMOTE} is local type with path: ${REMOTE_PATH}"
        else
            # For non-local remotes (like drive or box)
            if [ -n "$SUBFOLDER" ]; then
                # If subfolder is set, append it to the remote name
                SOURCE_PATH="${REMOTE}:${SUBFOLDER}"
                log "Remote ${REMOTE} is ${REMOTE_TYPE} type with subfolder: ${SUBFOLDER}, using ${SOURCE_PATH} as source"
            else
                # Otherwise, just use the remote name with colon
                SOURCE_PATH="${REMOTE}:"
                log "Remote ${REMOTE} is ${REMOTE_TYPE} type, using ${SOURCE_PATH} as source"
            fi
        fi
        
        # Set destination path
        DEST_PATH="pf-user-2:asi-essentia-ai-new/user/pf-user-2/${REMOTE}"
        
        log "Syncing ${REMOTE} to PageFinder..."
        if [ -n "$DRY_RUN" ]; then
            log "DRY RUN: Would sync ${SOURCE_PATH} to ${DEST_PATH}"
            log "Executing command: \"${RCLONE_PATH}\" sync \"${SOURCE_PATH}\" \"${DEST_PATH}\" --dry-run $VERBOSE --config \"${CONFIG}\""
            "${RCLONE_PATH}" sync "${SOURCE_PATH}" "${DEST_PATH}" --dry-run $VERBOSE --config "${CONFIG}" 2>&1 | tee -a "${LOG_FILE}"
        else
            log "Executing command: \"${RCLONE_PATH}\" sync \"${SOURCE_PATH}\" \"${DEST_PATH}\" $VERBOSE --config \"${CONFIG}\""
            "${RCLONE_PATH}" sync "${SOURCE_PATH}" "${DEST_PATH}" $VERBOSE --config "${CONFIG}" 2>&1 | tee -a "${LOG_FILE}"
            if [ $? -eq 0 ]; then
                log "Sync for ${REMOTE} completed successfully"
            else
                log "ERROR: Sync for ${REMOTE} failed"
            fi
        fi
    done
fi

# Log completion
log "===== PageFinder Sync Job Completed at $(date) ====="

# Append completion to event log
if [ -n "$DRY_RUN" ]; then
    if [ -n "$VERBOSE" ]; then
        echo -e "[$(date +"%Y-%m-%d %H:%M:%S")] Sync job completed. Mode: DRY-RUN Verbose: YES" >> "${EVENT_LOG}"
    else
        echo -e "[$(date +"%Y-%m-%d %H:%M:%S")] Sync job completed. Mode: DRY-RUN Verbose: NO" >> "${EVENT_LOG}"
    fi
else
    if [ -n "$VERBOSE" ]; then
        echo -e "[$(date +"%Y-%m-%d %H:%M:%S")] Sync job completed. Mode: EXECUTE Verbose: YES" >> "${EVENT_LOG}"
    else
        echo -e "[$(date +"%Y-%m-%d %H:%M:%S")] Sync job completed. Mode: EXECUTE Verbose: NO" >> "${EVENT_LOG}"
    fi
fi