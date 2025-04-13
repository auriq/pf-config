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
CONFIG_DIR="$HOME/.config/pf-config"
echo "Creating configuration directory: $CONFIG_DIR"
mkdir -p "$CONFIG_DIR"
chmod 755 "$CONFIG_DIR"
echo "Done."

# Create default configuration files if they don't exist
if [ ! -f "$CONFIG_DIR/cloud.conf" ]; then
  echo "Creating default cloud.conf..."
  cat > "$CONFIG_DIR/cloud.conf" << EOF
# PageFinder Cloud Configuration
# Add your cloud storage configurations here
EOF
  chmod 644 "$CONFIG_DIR/cloud.conf"
  echo "Done."
fi

if [ ! -f "$CONFIG_DIR/pf.conf" ]; then
  echo "Creating default pf.conf..."
  cat > "$CONFIG_DIR/pf.conf" << EOF
# PageFinder S3 Configuration
# Add your PageFinder configuration here
EOF
  chmod 644 "$CONFIG_DIR/pf.conf"
  echo "Done."
fi

# Create app-config.json if it doesn't exist
if [ ! -f "$CONFIG_DIR/app-config.json" ]; then
  echo "Creating default app-config.json..."
  cat > "$CONFIG_DIR/app-config.json" << EOF
{
  "path_rclone": "$RCLONE_PATH",
  "workspace_dir": "$CONFIG_DIR"
}
EOF
  chmod 644 "$CONFIG_DIR/app-config.json"
  echo "Done."
fi

# Fix permissions for scripts
echo "Fixing permissions for scripts..."
chmod +x "$SCRIPT_DIR/purge.sh"
chmod +x "$SCRIPT_DIR/sync.sh"
echo "Done."

echo "All permissions fixed successfully!"
echo "You can now run the PageFinder Configuration Utility."