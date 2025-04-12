#!/bin/bash
# PageFinder Configuration - Orphan Purge Script
# This script detects and purges orphaned directories in PageFinder
# It can be run in dry-run mode (default) or execution mode (-e flag)

# Set the working directory with absolute path
WORKDIR='/tmp/pf-config'
if [ -n "$WORKDIR" ]; then
  WORKDIR="$WORKDIR"
fi
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
LOGFILE="$WORKDIR/purge.log"

# Debug information to stdout
echo "Script started at $TIMESTAMP"
echo "Working directory: $WORKDIR"
echo "Log file: $LOGFILE"

# Ensure working directory exists
mkdir -p "$WORKDIR"

# Function to log messages
log_message() {
    # Print to terminal
    echo "[$TIMESTAMP] $1"
    
    # Log to file with absolute path
    if [ ! -f "$LOGFILE" ]; then
        echo "[$TIMESTAMP] $1" > "$LOGFILE"
        # Debug info
        echo "Created new log file: $LOGFILE"
    else
        # Use absolute paths for temp file
        TEMP_FILE="$WORKDIR/temp_purge_log"
        echo "[$TIMESTAMP] $1" | cat - "$LOGFILE" > "$TEMP_FILE" && mv "$TEMP_FILE" "$LOGFILE"
    fi
    
    # Debug: verify log file exists and has content
    if [ ! -f "$LOGFILE" ]; then
        echo "WARNING: Log file does not exist after writing!"
    fi
}

# Initialize log file
log_message "Purge log initialized"
log_message "----- Starting orphan detection and purge process -----"

# Check if execution mode is enabled
EXECUTE_MODE=false
if [ "$1" = "-e" ]; then
    EXECUTE_MODE=true
    log_message "Execution mode enabled"
else
    log_message "Dry-run mode enabled (use -e to execute)"
fi

# Paths to configuration files
CLOUD_CONF="$WORKDIR/cloud.conf"
PF_CONF="$WORKDIR/pf.conf"
METADATA_JSON="$WORKDIR/remote-meta.json"

# Check if configuration files exist
if [ ! -f "$CLOUD_CONF" ]; then
    log_message "ERROR: Cloud configuration file not found at $CLOUD_CONF"
    exit 1
fi

if [ ! -f "$PF_CONF" ]; then
    log_message "ERROR: PageFinder configuration file not found at $PF_CONF"
    exit 1
fi

# Extract PageFinder name, bucket, and prefix from pf.conf
# Format expected: [pfname]
#                  type = ...
#                  bucket = ...
#                  prefix = ...
PFNAME=$(grep -m 1 '^\[' "$PF_CONF" | tr -d '[]')
BUCKET=$(grep -m 1 'bucket' "$PF_CONF" | cut -d '=' -f 2 | tr -d ' ')
PREFIX=$(grep -m 1 'prefix' "$PF_CONF" | cut -d '=' -f 2 | tr -d ' ')

# Construct the base PageFinder path
if [ -z "$PREFIX" ]; then
    PF_BASE_PATH="$PFNAME:$BUCKET/$PFNAME"
else
    PF_BASE_PATH="$PFNAME:$BUCKET/$PREFIX/$PFNAME"
fi

log_message "PageFinder base path: $PF_BASE_PATH"

# Step 1: Find folders in destination
log_message "Finding folders in destination..."
DEST_FOLDERS_CMD="rclone lsd $PF_BASE_PATH --config $PF_CONF"
log_message "Executing: $DEST_FOLDERS_CMD"

DEST_FOLDERS_OUTPUT=$(eval "$DEST_FOLDERS_CMD" 2>&1)
DEST_FOLDERS_STATUS=$?

if [ $DEST_FOLDERS_STATUS -ne 0 ]; then
    log_message "ERROR: Failed to list folders in destination"
    log_message "Error output: $DEST_FOLDERS_OUTPUT"
    exit 1
fi

# Parse the output to get folder names
# rclone lsd output format: "          -1 2023-04-11 12:34:56        -1 folder_name"
log_message "Parsing destination folders output..."
log_message "Output: $DEST_FOLDERS_OUTPUT"

# Create a temporary file to store folder names
FOLDERS_FILE="$WORKDIR/folders.txt"
> "$FOLDERS_FILE"

# Process each line of the output
while IFS= read -r line; do
    # Skip empty lines
    if [ -z "$line" ]; then
        continue
    fi
    
    # Extract the folder name (last field)
    folder=$(echo "$line" | awk '{print $NF}')
    
    if [ -n "$folder" ]; then
        log_message "Found folder: $folder"
        echo "$folder" >> "$FOLDERS_FILE"
    fi
done <<< "$DEST_FOLDERS_OUTPUT"

# Read the folders from the file
DEST_FOLDERS=$(cat "$FOLDERS_FILE")

# Log the found folders
log_message "Destination folders found: $DEST_FOLDERS"

# Step 2: Find source remote names from cloud.conf
log_message "Finding source remote names from cloud.conf..."
SOURCE_REMOTES=$(grep '^\[' "$CLOUD_CONF" | tr -d '[]')

if [ -z "$SOURCE_REMOTES" ]; then
    log_message "No source remotes found in cloud.conf"
    exit 1
fi

# Create a temporary file to store source remote names
REMOTES_FILE="$WORKDIR/remotes.txt"
> "$REMOTES_FILE"

# Process each remote name
while IFS= read -r remote; do
    if [ -n "$remote" ]; then
        log_message "Found remote: $remote"
        echo "$remote" >> "$REMOTES_FILE"
    fi
done <<< "$SOURCE_REMOTES"

# Read the remotes from the file
SOURCE_REMOTES=$(cat "$REMOTES_FILE")

log_message "Source remotes found: $SOURCE_REMOTES"

# Step 3: Compare names to find orphans
log_message "Comparing names to find orphans..."

# Create a temporary file to store orphan names
ORPHANS_FILE="$WORKDIR/orphans.txt"
> "$ORPHANS_FILE"

# Process each destination folder
for folder in $DEST_FOLDERS; do
    # Skip empty lines
    if [ -z "$folder" ]; then
        continue
    fi
    
    # Check if this folder exists in source remotes
    found=false
    for remote in $SOURCE_REMOTES; do
        if [ "$folder" = "$remote" ]; then
            found=true
            break
        fi
    done
    
    if [ "$found" = false ]; then
        log_message "Found orphan: $folder"
        echo "$folder" >> "$ORPHANS_FILE"
    fi
done

# Read the orphans from the file
ORPHANS=$(cat "$ORPHANS_FILE")

# Log the found orphans
if [ -n "$ORPHANS" ]; then
    log_message "Orphans found: $ORPHANS"
else
    log_message "No orphans found"
fi

# Create a variable to store orphans with newlines
ORPHANS_LIST=""
for orphan in $ORPHANS; do
    ORPHANS_LIST="$ORPHANS_LIST$orphan
"
done

# Step 4 & 5: Construct and execute purge commands
if [ -z "$ORPHANS_LIST" ]; then
    log_message "No orphans found"
else
    log_message "Found orphans, proceeding with purge..."
    
    echo "$ORPHANS_LIST" | while read -r orphan; do
        # Skip empty lines
        if [ -z "$orphan" ]; then
            continue
        fi
        
        # Construct the purge command
        if [ "$EXECUTE_MODE" = true ]; then
            PURGE_CMD="rclone purge $PF_BASE_PATH/$orphan --config $PF_CONF"
        else
            PURGE_CMD="rclone purge $PF_BASE_PATH/$orphan --dry-run --config $PF_CONF"
        fi
        
        log_message "Executing: $PURGE_CMD"
        
        # Execute the purge command
        PURGE_OUTPUT=$(eval "$PURGE_CMD" 2>&1)
        PURGE_STATUS=$?
        
        # Log the output
        if [ -n "$PURGE_OUTPUT" ]; then
            log_message "Command output for $orphan:"
            echo "$PURGE_OUTPUT" | while IFS= read -r line; do
                log_message "  $line"
            done
        else
            log_message "Command for $orphan produced no output"
        fi
        
        # Log the result
        if [ $PURGE_STATUS -eq 0 ]; then
            if [ "$EXECUTE_MODE" = true ]; then
                log_message "Purge for $orphan completed successfully"
            else
                log_message "Dry run for $orphan completed successfully"
            fi
        else
            log_message "ERROR: Command for $orphan failed with exit code $PURGE_STATUS"
        fi
    done
fi

log_message "----- Orphan detection and purge process finished -----"
# Clean up temporary files
rm -f "$FOLDERS_FILE" "$REMOTES_FILE" "$ORPHANS_FILE"

exit 0