#!/bin/bash
# Script to fix permissions for PageFinder Configuration Utility on macOS

# Check if running on macOS
if [ "$(uname)" != "Darwin" ]; then
  echo "This script is only for macOS. Exiting."
  exit 1
fi

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR="$(dirname "$SCRIPT_DIR")"

# Load environment variables
source "$SCRIPT_DIR/env-loader.sh"

echo "PageFinder Configuration - Permission Fix Script"
echo "==============================================="
echo "App directory: $APP_DIR"

# Check if rclone is installed
RCLONE_PATH=$(which rclone)
if [ -z "$RCLONE_PATH" ]; then
  echo "Error: rclone not found in PATH"
  echo "Please install rclone first: https://rclone.org/install/"
  exit 1
fi

echo "Found rclone at: $RCLONE_PATH"

# Fix rclone permissions
echo "Fixing rclone permissions..."
chmod +x "$RCLONE_PATH"
echo "Done."

# Create configuration directory
# Use WORKSPACE_DIR from environment or set default if not available
WORKSPACE_DIR=${WORKSPACE_DIR:-"$HOME/.config/pf-config"}
echo "Creating configuration directory: $WORKSPACE_DIR"
mkdir -p "$WORKSPACE_DIR"
chmod 755 "$WORKSPACE_DIR"
echo "Done."

# Create default configuration files if they don't exist
if [ ! -f "$WORKSPACE_DIR/cloud.conf" ]; then
  echo "Creating default cloud.conf..."
  cat > "$WORKSPACE_DIR/cloud.conf" << EOF
# PageFinder Cloud Configuration
# Add your cloud storage configurations here
EOF
  chmod 644 "$WORKSPACE_DIR/cloud.conf"
  echo "Done."
fi

if [ ! -f "$WORKSPACE_DIR/pf.conf" ]; then
  echo "Creating default pf.conf..."
  cat > "$WORKSPACE_DIR/pf.conf" << EOF
# PageFinder S3 Configuration
# Add your PageFinder configuration here
EOF
  chmod 644 "$WORKSPACE_DIR/pf.conf"
  echo "Done."
fi

# Create app-config.json if it doesn't exist
if [ ! -f "$WORKSPACE_DIR/app-config.json" ]; then
  echo "Creating default app-config.json..."
  cat > "$WORKSPACE_DIR/app-config.json" << EOF
{
  "path_rclone": "$RCLONE_PATH",
  "workspace_dir": "$WORKSPACE_DIR"
}
EOF
  chmod 644 "$WORKSPACE_DIR/app-config.json"
  echo "Done."
fi

# Fix permissions for scripts
echo "Fixing permissions for scripts..."
chmod +x "$SCRIPT_DIR/purge-workspace.sh"
chmod +x "$SCRIPT_DIR/sync-workspace.sh"
echo "Done."

# Create scripts directory in workspace and copy scripts there
echo "Creating scripts directory in workspace..."
mkdir -p "$WORKSPACE_DIR/scripts"
chmod 755 "$WORKSPACE_DIR/scripts"

echo "Copying scripts to workspace..."
cp "$SCRIPT_DIR/purge-workspace.sh" "$WORKSPACE_DIR/scripts/"
cp "$SCRIPT_DIR/sync-workspace.sh" "$WORKSPACE_DIR/scripts/"
chmod +x "$WORKSPACE_DIR/scripts/purge-workspace.sh"
chmod +x "$WORKSPACE_DIR/scripts/sync-workspace.sh"
echo "Done."

echo "All permissions fixed successfully!"
echo "You can now run the PageFinder Configuration Utility."