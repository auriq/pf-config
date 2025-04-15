#!/bin/bash
# Debug wrapper script to help diagnose the "/Applications/PageFinder: No such file or directory" error

echo "===== DEBUG WRAPPER SCRIPT ====="
echo "Current directory: $(pwd)"
echo "Script path: $0"
echo "Script arguments: $@"
echo "Environment variables:"
env | sort
# Load environment variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/env-loader.sh"

echo "===== CHECKING PATHS ====="
echo "Checking if /Applications/PageFinder exists:"
echo "Checking if /Applications/PageFinder exists:"
if [ -d "/Applications/PageFinder" ]; then
  echo "Directory /Applications/PageFinder exists"
else
  echo "Directory /Applications/PageFinder does not exist"
fi

echo "Checking if /Applications/PageFinder Configuration.app exists:"
if [ -d "/Applications/PageFinder Configuration.app" ]; then
  echo "Directory /Applications/PageFinder Configuration.app exists"
else
  echo "Directory /Applications/PageFinder Configuration.app does not exist"
fi

echo "Checking process information:"
ps -ef | grep PageFinder

echo "===== CHECKING SCRIPT LOCATIONS ====="
echo "Current script directory:"
echo "SCRIPT_DIR: $SCRIPT_DIR"

echo "Checking for sync-workspace.sh in various locations:"
for path in \
  "$SCRIPT_DIR/sync-workspace.sh" \
  "./sync-workspace.sh" \
  "./scripts/sync-workspace.sh" \
  "../scripts/sync-workspace.sh" \
  "/Applications/PageFinder Configuration.app/Contents/Resources/scripts/sync-workspace.sh" \
  "$(dirname "$SCRIPT_DIR")/scripts/sync-workspace.sh" \
  "$(dirname "$(dirname "$SCRIPT_DIR")")/scripts/sync-workspace.sh" \
  "$WORKSPACE_DIR/scripts/sync-workspace.sh"
do
  if [ -f "$path" ]; then
    echo "Found sync-workspace.sh at: $path"
    ls -la "$path"
  else
    echo "No sync-workspace.sh at: $path"
  fi
done

echo "===== ATTEMPTING TO EXECUTE SYNC-WORKSPACE.SH ====="
# Try to find and execute sync-workspace.sh
for path in \
  "$SCRIPT_DIR/sync-workspace.sh" \
  "./sync-workspace.sh" \
  "./scripts/sync-workspace.sh" \
  "../scripts/sync-workspace.sh" \
  "/Applications/PageFinder Configuration.app/Contents/Resources/scripts/sync-workspace.sh" \
  "$(dirname "$SCRIPT_DIR")/scripts/sync-workspace.sh" \
  "$(dirname "$(dirname "$SCRIPT_DIR")")/scripts/sync-workspace.sh" \
  "$WORKSPACE_DIR/scripts/sync-workspace.sh"
do
  if [ -f "$path" ]; then
    echo "Attempting to execute: $path"
    chmod +x "$path"
    "$path" "$@"
    exit_code=$?
    echo "Exit code: $exit_code"
    exit $exit_code
  fi
done

echo "Could not find sync-workspace.sh in any of the checked locations"
exit 1