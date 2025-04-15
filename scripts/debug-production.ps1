# Debug script for production mode on Windows
# This script runs the application with additional debugging information

# Set environment variables for debugging
$env:DEBUG = "electron-builder,electron-packager,electron-notarize"
$env:NODE_ENV = "production"

# Print environment variables
Write-Host "=== Environment Variables ==="
Write-Host "DEBUG: $env:DEBUG"
Write-Host "NODE_ENV: $env:NODE_ENV"
Write-Host "WORKSPACE_DIR: $env:WORKSPACE_DIR"
Write-Host "RCLONE_PATH: $env:RCLONE_PATH"
Write-Host "SCRIPTS_PATH: $env:SCRIPTS_PATH"
Write-Host "=========================="

# Run the application with debug logging
Write-Host "Starting application in production debug mode..."
electron -r ./scripts/debug-config.js .