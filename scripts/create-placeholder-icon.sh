#!/bin/bash

# This script creates a placeholder icon for the application
# Requires ImageMagick to be installed: brew install imagemagick

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "Error: ImageMagick is not installed. Please install it first."
    echo "On macOS: brew install imagemagick"
    echo "On Ubuntu/Debian: sudo apt-get install imagemagick"
    echo "On Windows with Chocolatey: choco install imagemagick"
    exit 1
fi

# Create build directory if it doesn't exist
mkdir -p build

# Create a placeholder icon
echo "Creating placeholder icon..."
convert -size 1024x1024 xc:none \
  -fill "#007BFF" -draw "roundrectangle 0,0 1024,1024 100,100" \
  -fill white -pointsize 400 -gravity center -annotate 0 "PF" \
  build/icon.png

echo "Placeholder icon created at build/icon.png"
echo "You can now run scripts/generate-icons.sh to generate icons for different platforms"