#!/bin/bash
# PageFinder Configuration - Synchronization Script
# This script synchronizes data between cloud storage and PageFinder
# It can be run in dry-run mode (default) or execution mode (-e flag)

# Add extensive debugging
echo "===== SYNC SCRIPT DEBUG INFO ====="
echo "Current directory: $(pwd)"
echo "Script path: $0"
echo "Script arguments: $@"
echo "BASH_SOURCE: ${BASH_SOURCE[0]}"
echo "Environment variables:"
env | sort

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

# Check if env-loader.sh exists
if [ -f "$SCRIPT_DIR/env-loader.sh" ]; then
    echo "Loading environment from: $SCRIPT_DIR/env-loader.sh"
    source "$SCRIPT_DIR/env-loader.sh"
else
    echo "Warning: env-loader.sh not found at $SCRIPT_DIR/env-loader.sh"
    # Set default values
    RCLONE_PATH=${RCLONE_PATH:-"/usr/local/bin/rclone"}
    WORKSPACE_DIR=${WORKSPACE_DIR:-"$HOME/.config/pf-config"}
    
    # If SCRIPTS_PATH is not set, try to set it based on the current script location
    if [ -z "$SCRIPTS_PATH" ]; then
        SCRIPTS_PATH="$SCRIPT_DIR"
        echo "Setting SCRIPTS_PATH to: $SCRIPTS_PATH"
    fi
    
    # Ensure workspace directory exists
    mkdir -p "$WORKSPACE_DIR"
    
    echo "Using default environment variables:"
    echo "RCLONE_PATH=$RCLONE_PATH"
    echo "WORKSPACE_DIR=$WORKSPACE_DIR"
fi

# Set the working directory from environment variable
WORKDIR="$WORKSPACE_DIR"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
LOGFILE="$WORKDIR/sync.log"

# Debug information to stdout
echo "Script started at $TIMESTAMP"
echo "Working directory: $WORKDIR"
echo "Log file: $LOGFILE"

# Ensure working directory exists
mkdir -p "$WORKDIR"

# Function to check log file size and truncate if necessary
check_log_size() {
    if [ -f "$LOGFILE" ]; then
        # Get log file size in bytes
        LOG_SIZE=$(stat -f%z "$LOGFILE" 2>/dev/null || stat -c%s "$LOGFILE" 2>/dev/null)
        
        # If log file size is greater than 1MB (1048576 bytes), truncate it
        if [ "$LOG_SIZE" -gt 1048576 ]; then
            log_message "Log file size exceeds 1MB, truncating..."
            
            # Keep approximately the last 500KB of the log file
            # This ensures we keep recent logs while staying well under 1MB
            KEEP_LINES=$(tail -c 512000 "$LOGFILE" | wc -l)
            
            # Create a temporary file with the last KEEP_LINES lines
            tail -n "$KEEP_LINES" "$LOGFILE" > "$WORKDIR/temp_log"
            
            # Replace the original log file with the truncated version
            mv "$WORKDIR/temp_log" "$LOGFILE"
            
            log_message "Log file truncated to last $KEEP_LINES lines"
        fi
    fi
}

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
        TEMP_FILE="$WORKDIR/temp_sync_log"
        echo "[$TIMESTAMP] $1" | cat - "$LOGFILE" > "$TEMP_FILE" && mv "$TEMP_FILE" "$LOGFILE"
    fi
    
    # Debug: verify log file exists and has content
    if [ ! -f "$LOGFILE" ]; then
        echo "WARNING: Log file does not exist after writing!"
    fi
}

# Initialize log file
log_message "Sync log initialized"

# Check and maintain log file size
check_log_size

log_message "----- Starting synchronization process -----"

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
RCLONE_CONF="$WORKDIR/rclone.conf"
METADATA_JSON="$WORKDIR/remote-meta.json"

# Create sample configuration files if they don't exist
if [ ! -f "$CLOUD_CONF" ]; then
    log_message "Creating sample cloud configuration file at $CLOUD_CONF"
    cat > "$CLOUD_CONF" << EOF
[gdrive]
type = drive
client_id = your-client-id
client_secret = your-client-secret
scope = drive

[onedrive]
type = onedrive
client_id = your-client-id
client_secret = your-client-secret
EOF
fi

if [ ! -f "$PF_CONF" ]; then
    log_message "Creating sample PageFinder configuration file at $PF_CONF"
    cat > "$PF_CONF" << EOF
[pagefinder]
type = s3
provider = AWS
access_key_id = your-access-key
secret_access_key = your-secret-key
region = us-west-2
bucket = pagefinder-bucket
prefix = data
EOF
fi

# Create sample metadata file if it doesn't exist
if [ ! -f "$METADATA_JSON" ]; then
    log_message "Creating sample metadata file at $METADATA_JSON"
    cat > "$METADATA_JSON" << EOF
{
  "gdrive": {
    "type": "drive",
    "subfolder": "testfiles"
  },
  "onedrive": {
    "type": "onedrive",
    "subfolder": "documents/work"
  }
}
EOF
fi

log_message "Combining configuration files to create rclone.conf"

# Combine cloud.conf and pf.conf to create rclone.conf
cat "$CLOUD_CONF" "$PF_CONF" > "$RCLONE_CONF"
log_message "Combined configuration created at $RCLONE_CONF"

# Extract PageFinder name, bucket, and prefix from pf.conf
# Format expected: [pfname]
#                  type = ...
#                  bucket = ...
#                  prefix = ...
PFNAME=$(grep -m 1 '^\[' "$PF_CONF" | tr -d '[]')
BUCKET=$(grep -m 1 'bucket' "$PF_CONF" | cut -d '=' -f 2 | tr -d ' ')
PREFIX=$(grep -m 1 'prefix' "$PF_CONF" | cut -d '=' -f 2 | tr -d ' ')

# Process each cloud storage configuration in cloud.conf
log_message "Processing cloud storage configurations"

# Get all cloud storage section names
CLOUD_SECTIONS=$(grep '^\[' "$CLOUD_CONF" | tr -d '[]')

# Process each cloud storage section
echo "$CLOUD_SECTIONS" | while read -r CLOUDNAME; do
    log_message "Processing cloud storage: $CLOUDNAME"
    # Get subfolder from metadata if available
    if [ -f "$METADATA_JSON" ]; then
        # Extract subfolder for this cloud storage from metadata.json using a proper JSON parsing approach
        # Try jq first, if not available fall back to Python, then to a simple grep approach
        if command -v jq &> /dev/null; then
            # Use jq to extract the subfolder
            SUBFOLDER=$(jq -r ".[\"$CLOUDNAME\"].subfolder // \"\"" "$METADATA_JSON")
        elif command -v python3 &> /dev/null; then
            # Use Python to extract the subfolder
            SUBFOLDER=$(python3 -c "
import json, sys
try:
    with open('$METADATA_JSON', 'r') as f:
        data = json.load(f)
    print(data.get('$CLOUDNAME', {}).get('subfolder', ''))
except Exception as e:
    print('', file=sys.stderr)
    exit(0)
")
        elif command -v python &> /dev/null; then
            # Try with python if python3 is not available
            SUBFOLDER=$(python -c "
import json, sys
try:
    with open('$METADATA_JSON', 'r') as f:
        data = json.load(f)
    print(data.get('$CLOUDNAME', {}).get('subfolder', ''))
except Exception as e:
    print('', file=sys.stderr)
    exit(0)
")
        else
            # Fallback to grep/sed approach if neither jq nor python is available
            log_message "Warning: Neither jq nor python is available for proper JSON parsing. Using fallback method."
            SUBFOLDER=$(grep -A 10 "\"$CLOUDNAME\":" "$METADATA_JSON" | grep "\"subfolder\":" | head -1 | sed -E 's/.*"subfolder"[[:space:]]*:[[:space:]]*"([^"]*).*/\1/')
        fi
        
        if [ -n "$SUBFOLDER" ]; then
            log_message "Found subfolder in metadata: $SUBFOLDER for $CLOUDNAME"
            CLOUD_PATH="$CLOUDNAME:$SUBFOLDER"
        else
            log_message "No subfolder found in metadata for $CLOUDNAME"
            CLOUD_PATH="$CLOUDNAME:"
        fi
    else
        log_message "No metadata file found, using root path for $CLOUDNAME"
        CLOUD_PATH="$CLOUDNAME:"
    fi
    
    
    # Construct the destination path
    if [ -z "$PREFIX" ]; then
        PF_PATH="$PFNAME:$BUCKET/$PFNAME/$CLOUDNAME"
    else
        PF_PATH="$PFNAME:$BUCKET/$PREFIX/$PFNAME/$CLOUDNAME"
    fi
    
    log_message "Cloud path: $CLOUD_PATH"
    log_message "PageFinder path: $PF_PATH"
    
    # Construct the rclone command
    if [ "$EXECUTE_MODE" = true ]; then
        RCLONE_CMD="$RCLONE_PATH sync $CLOUD_PATH $PF_PATH --config $RCLONE_CONF"
    else
        RCLONE_CMD="$RCLONE_PATH sync $CLOUD_PATH $PF_PATH --dry-run --config $RCLONE_CONF"
    fi
    
    log_message "Executing command: $RCLONE_CMD"
    
    # Execute the rclone command and capture output
    RCLONE_OUTPUT=$($RCLONE_CMD 2>&1)
    RCLONE_STATUS=$?
    # Log the output
    if [ -n "$RCLONE_OUTPUT" ]; then
        log_message "Command output for $CLOUDNAME:"
        echo "$RCLONE_OUTPUT" | while IFS= read -r line; do
            log_message "  $line"
        done
    else
        log_message "Command for $CLOUDNAME produced no output"
    fi
    
    # Log the result
    if [ $RCLONE_STATUS -eq 0 ]; then
        if [ "$EXECUTE_MODE" = true ]; then
            log_message "Synchronization for $CLOUDNAME completed successfully"
        else
            log_message "Dry run for $CLOUDNAME completed successfully"
        fi
    else
        log_message "ERROR: Command for $CLOUDNAME failed with exit code $RCLONE_STATUS"
        # Don't exit here, continue with other cloud storages
    fi
done

log_message "----- Synchronization process finished -----"
exit 0