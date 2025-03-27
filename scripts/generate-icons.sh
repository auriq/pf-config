#!/bin/bash

# This script generates icons for different platforms from a single source image
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
mkdir -p build/icons

# Source image (should be at least 1024x1024 pixels)
SOURCE_IMAGE="build/icon.png"

# Check if source image exists
if [ ! -f "$SOURCE_IMAGE" ]; then
    echo "Error: Source image not found at $SOURCE_IMAGE"
    echo "Please place a 1024x1024 PNG image at $SOURCE_IMAGE"
    exit 1
fi

echo "Generating icons for different platforms..."

# Generate icons for macOS
echo "Generating macOS icons..."
convert "$SOURCE_IMAGE" -resize 16x16 "build/icons/16x16.png"
convert "$SOURCE_IMAGE" -resize 32x32 "build/icons/32x32.png"
convert "$SOURCE_IMAGE" -resize 64x64 "build/icons/64x64.png"
convert "$SOURCE_IMAGE" -resize 128x128 "build/icons/128x128.png"
convert "$SOURCE_IMAGE" -resize 256x256 "build/icons/256x256.png"
convert "$SOURCE_IMAGE" -resize 512x512 "build/icons/512x512.png"
convert "$SOURCE_IMAGE" -resize 1024x1024 "build/icons/1024x1024.png"

# Generate icon for Windows
echo "Generating Windows icon..."
convert "$SOURCE_IMAGE" -resize 256x256 "build/icons/icon.ico"

# Generate icon for Linux
echo "Generating Linux icon..."
convert "$SOURCE_IMAGE" -resize 512x512 "build/icons/512x512.png"

echo "Icon generation complete!"