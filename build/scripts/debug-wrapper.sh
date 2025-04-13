#!/bin/bash
# Debug wrapper script to help diagnose the "/Applications/PageFinder: No such file or directory" error

echo "===== DEBUG WRAPPER SCRIPT ====="
echo "Current directory: $(pwd)"
echo "Script path: $0"
echo "Script arguments: $@"
echo "Environment variables:"
env | sort

echo "===== CHECKING PATHS ====="
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
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "SCRIPT_DIR: $SCRIPT_DIR"

echo "Checking for sync.sh in various locations:"
for path in \
  "$SCRIPT_DIR/sync.sh" \
  "./sync.sh" \
  "./scripts/sync.sh" \
  "../scripts/sync.sh" \
  "/Applications/PageFinder Configuration.app/Contents/Resources/scripts/sync.sh" \
  "$(dirname "$SCRIPT_DIR")/scripts/sync.sh" \
  "$(dirname "$(dirname "$SCRIPT_DIR")")/scripts/sync.sh"
do
  if [ -f "$path" ]; then
    echo "Found sync.sh at: $path"
    ls -la "$path"
  else
    echo "No sync.sh at: $path"
  fi
done

echo "===== ATTEMPTING TO EXECUTE SYNC.SH ====="
# Try to find and execute sync.sh
for path in \
  "$SCRIPT_DIR/sync.sh" \
  "./sync.sh" \
  "./scripts/sync.sh" \
  "../scripts/sync.sh" \
  "/Applications/PageFinder Configuration.app/Contents/Resources/scripts/sync.sh" \
  "$(dirname "$SCRIPT_DIR")/scripts/sync.sh" \
  "$(dirname "$(dirname "$SCRIPT_DIR")")/scripts/sync.sh"
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

echo "Could not find sync.sh in any of the checked locations"
exit 1