#!/bin/bash
# PageFinder Configuration - Environment Loader
# This script loads environment variables from the .env file
# It should be sourced by other scripts, not executed directly

# Get the absolute path to the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

# Function to log messages
log_env_loader() {
    echo "[ENV LOADER] $1"
}

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    log_env_loader "Warning: .env file not found at $ENV_FILE"
    log_env_loader "Using default environment variables"
    
    # Set default values
    export RCLONE_PATH="/usr/local/bin/rclone"
    export WORKSPACE_DIR="/tmp/pf-config"
else
    log_env_loader "Loading environment variables from $ENV_FILE"
    
    # Read .env file and export variables
    while IFS= read -r line || [ -n "$line" ]; do
        # Skip comments and empty lines
        if [[ $line =~ ^#.*$ ]] || [[ -z $line ]]; then
            continue
        fi
        
        # Extract variable name and value
        if [[ $line =~ ^([A-Za-z0-9_]+)=(.*)$ ]]; then
            name="${BASH_REMATCH[1]}"
            value="${BASH_REMATCH[2]}"
            
            # Remove quotes if present
            value="${value%\"}"
            value="${value#\"}"
            value="${value%\'}"
            value="${value#\'}"
            
            # Export the variable
            export "$name"="$value"
            log_env_loader "Exported $name=$value"
        fi
    done < "$ENV_FILE"
fi

# Ensure RCLONE_PATH, WORKSPACE_DIR, and SCRIPTS_PATH are set
if [ -z "$RCLONE_PATH" ]; then
    log_env_loader "RCLONE_PATH not set, using default: /usr/local/bin/rclone"
    export RCLONE_PATH="/usr/local/bin/rclone"
fi

if [ -z "$WORKSPACE_DIR" ]; then
    log_env_loader "WORKSPACE_DIR not set, using default: /tmp/pf-config"
    export WORKSPACE_DIR="/tmp/pf-config"
fi

if [ -z "$SCRIPTS_PATH" ]; then
    log_env_loader "SCRIPTS_PATH not set, using default: scripts"
    export SCRIPTS_PATH="scripts"
fi

# Platform-specific adjustments
if [ "$(uname)" = "Windows_NT" ]; then
    # Windows
    if [ "$RCLONE_PATH" = "/usr/local/bin/rclone" ]; then
        export RCLONE_PATH="rclone.exe"
    fi
    
    if [ "$WORKSPACE_DIR" = "/tmp/pf-config" ]; then
        # Use %APPDATA% equivalent
        export WORKSPACE_DIR="$USERPROFILE/AppData/Roaming/pf-config"
    fi
elif [ "$(uname)" = "Darwin" ]; then
    # macOS
    if [ "$WORKSPACE_DIR" = "/tmp/pf-config" ]; then
        export WORKSPACE_DIR="$HOME/.config/pf-config"
    fi
fi

# Ensure workspace directory exists
mkdir -p "$WORKSPACE_DIR"
log_env_loader "Environment loaded successfully"
log_env_loader "RCLONE_PATH=$RCLONE_PATH"
log_env_loader "WORKSPACE_DIR=$WORKSPACE_DIR"
log_env_loader "SCRIPTS_PATH=$SCRIPTS_PATH"
log_env_loader "WORKSPACE_DIR=$WORKSPACE_DIR"