#!/bin/bash
# Fix permissions script for PageFinder Configuration
# This script fixes common permission issues on macOS

echo "=== PageFinder Configuration Permission Fix ==="
echo "This script will fix common permission issues on macOS."
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
  echo "This script is running with root privileges."
else
  echo "Warning: This script is not running with root privileges."
  echo "Some operations may fail. Consider running with sudo if you encounter errors."
fi

# Fix rclone permissions
fix_rclone_permissions() {
  echo "Checking for rclone installation..."
  
  # Common rclone paths on macOS
  RCLONE_PATHS=(
    "/usr/local/bin/rclone"
    "/usr/bin/rclone"
    "/opt/homebrew/bin/rclone"
    "/opt/local/bin/rclone"
    "$HOME/bin/rclone"
  )
  
  FOUND=false
  
  # Check each path and fix permissions if found
  for RCLONE_PATH in "${RCLONE_PATHS[@]}"; do
    if [ -f "$RCLONE_PATH" ]; then
      echo "Found rclone at $RCLONE_PATH, fixing permissions..."
      chmod +x "$RCLONE_PATH"
      echo "Fixed rclone permissions"
      FOUND=true
    fi
  done
  
  if [ "$FOUND" = false ]; then
    echo "Rclone not found in common paths"
    return 1
  fi
  
  return 0
}

# Create necessary directories
create_directories() {
  echo "Creating necessary directories..."
  
  # Create app config directory
  APP_CONFIG_DIR="$HOME/.config/pf-config"
  mkdir -p "$APP_CONFIG_DIR"
  echo "Created app config directory: $APP_CONFIG_DIR"
  
  # Create logs directory
  LOGS_DIR="$APP_CONFIG_DIR/logs"
  mkdir -p "$LOGS_DIR"
  echo "Created logs directory: $LOGS_DIR"
  
  # Create data directory
  DATA_DIR="$APP_CONFIG_DIR/data"
  mkdir -p "$DATA_DIR"
  echo "Created data directory: $DATA_DIR"
  
  # Create backup directory
  BACKUP_DIR="$APP_CONFIG_DIR/backup"
  mkdir -p "$BACKUP_DIR"
  echo "Created backup directory: $BACKUP_DIR"
  
  # Create scripts directory
  SCRIPTS_DIR="$APP_CONFIG_DIR/scripts"
  mkdir -p "$SCRIPTS_DIR"
  echo "Created scripts directory: $SCRIPTS_DIR"
  
  # Set permissions on the app config directory
  chmod -R 755 "$APP_CONFIG_DIR"
  echo "Set permissions on $APP_CONFIG_DIR"
  
  return 0
}

# Create empty config files if they don't exist
create_config_files() {
  echo "Creating config files if they don't exist..."
  
  APP_CONFIG_DIR="$HOME/.config/pf-config"
  
  # Create cloud.conf if it doesn't exist
  CLOUD_CONF_PATH="$APP_CONFIG_DIR/cloud.conf"
  if [ ! -f "$CLOUD_CONF_PATH" ]; then
    echo "# PageFinder Cloud Configuration" > "$CLOUD_CONF_PATH"
    echo "Created empty cloud.conf at $CLOUD_CONF_PATH"
  fi
  
  # Create settings.json if it doesn't exist
  SETTINGS_PATH="$APP_CONFIG_DIR/settings.json"
  if [ ! -f "$SETTINGS_PATH" ]; then
    echo '{
  "rclonePath": "/usr/local/bin/rclone"
}' > "$SETTINGS_PATH"
    echo "Created settings.json at $SETTINGS_PATH"
  fi
  
  # Create remotes-metadata.json if it doesn't exist
  METADATA_PATH="$APP_CONFIG_DIR/remotes-metadata.json"
  if [ ! -f "$METADATA_PATH" ]; then
    echo '{
  "remotes": {}
}' > "$METADATA_PATH"
    echo "Created remotes-metadata.json at $METADATA_PATH"
  fi
  
  return 0
}

# Fix app permissions
fix_app_permissions() {
  echo "Fixing app permissions..."
  
  # Find the app bundle
  APP_BUNDLE="/Applications/PageFinder Configuration.app"
  if [ -d "$APP_BUNDLE" ]; then
    echo "Found app bundle at $APP_BUNDLE"
    
    # Fix executable permissions
    chmod -R +x "$APP_BUNDLE/Contents/MacOS/"
    echo "Fixed executable permissions"
    
    return 0
  else
    echo "App bundle not found at $APP_BUNDLE"
    return 1
  fi
}

# Run all tasks
echo "Starting permission fixes..."

# Fix rclone permissions
fix_rclone_permissions
if [ $? -eq 0 ]; then
  echo "✅ Rclone permissions fixed successfully"
else
  echo "⚠️ Rclone permission fix failed or not needed"
fi

# Create directories
create_directories
if [ $? -eq 0 ]; then
  echo "✅ Directories created successfully"
else
  echo "⚠️ Directory creation failed"
fi

# Create config files
create_config_files
if [ $? -eq 0 ]; then
  echo "✅ Config files created successfully"
else
  echo "⚠️ Config file creation failed"
fi

# Fix app permissions
fix_app_permissions
if [ $? -eq 0 ]; then
  echo "✅ App permissions fixed successfully"
else
  echo "⚠️ App permission fix failed or not needed"
fi

echo ""
echo "Permission fixes completed."
echo "You can now try running the app again."
echo ""
echo "If you still encounter issues, please try running this script with sudo:"
echo "sudo $0"