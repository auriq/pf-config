#!/bin/bash
# Debug script for production mode
# This script runs the application with additional debugging information

# Set environment variables for debugging
export DEBUG=electron-builder,electron-packager,electron-notarize
export NODE_ENV=production

# Print environment variables
echo "=== Environment Variables ==="
echo "DEBUG: $DEBUG"
echo "NODE_ENV: $NODE_ENV"
echo "WORKSPACE_DIR: $WORKSPACE_DIR"
echo "RCLONE_PATH: $RCLONE_PATH"
echo "SCRIPTS_PATH: $SCRIPTS_PATH"
echo "=========================="

# Run the application with debug logging
echo "Starting application in production debug mode..."
electron -r ./scripts/debug-config.js .