@echo off
REM Debug script for production mode on Windows
REM This script runs the application with additional debugging information

REM Set environment variables for debugging
set DEBUG=electron-builder,electron-packager,electron-notarize
set NODE_ENV=production

REM Print environment variables
echo === Environment Variables ===
echo DEBUG: %DEBUG%
echo NODE_ENV: %NODE_ENV%
echo WORKSPACE_DIR: %WORKSPACE_DIR%
echo RCLONE_PATH: %RCLONE_PATH%
echo SCRIPTS_PATH: %SCRIPTS_PATH%
echo ==========================

REM Run the application with debug logging
echo Starting application in production debug mode...
electron -r ./scripts/debug-config.js .