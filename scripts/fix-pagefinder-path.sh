#!/bin/bash
# Fix PageFinder path script
# This script attempts to fix the "/Applications/PageFinder: No such file or directory" error

echo "===== FIX PAGEFINDER PATH SCRIPT ====="
echo "Current directory: $(pwd)"
echo "Script path: $0"

# Check if /Applications/PageFinder exists
echo "Checking if /Applications/PageFinder exists:"
if [ -d "/Applications/PageFinder" ]; then
  echo "Directory /Applications/PageFinder exists"
else
  echo "Directory /Applications/PageFinder does not exist"
fi

# Check if /Applications/PageFinder Configuration.app exists
echo "Checking if /Applications/PageFinder Configuration.app exists:"
if [ -d "/Applications/PageFinder Configuration.app" ]; then
  echo "Directory /Applications/PageFinder Configuration.app exists"
else
  echo "Directory /Applications/PageFinder Configuration.app does not exist"
fi

# Create a symbolic link from /Applications/PageFinder to /Applications/PageFinder Configuration.app
echo "Creating symbolic link from /Applications/PageFinder to /Applications/PageFinder Configuration.app"
if [ -d "/Applications/PageFinder Configuration.app" ]; then
  # Remove existing link if it exists
  if [ -L "/Applications/PageFinder" ]; then
    echo "Removing existing symbolic link"
    rm -f "/Applications/PageFinder"
  fi
  
  # Create the symbolic link
  echo "Creating symbolic link"
  ln -s "/Applications/PageFinder Configuration.app" "/Applications/PageFinder"
  
  # Check if the link was created successfully
  if [ -L "/Applications/PageFinder" ]; then
    echo "Symbolic link created successfully"
  else
    echo "Failed to create symbolic link"
  fi
else
  echo "Cannot create symbolic link because /Applications/PageFinder Configuration.app does not exist"
fi

echo "===== SCRIPT COMPLETED ====="