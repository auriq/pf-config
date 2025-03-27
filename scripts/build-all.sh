#!/bin/bash

# This script builds the application for all platforms
# It will create a placeholder icon, generate icons for different platforms,
# and then build the application for macOS, Windows, and Linux

# Exit on error
set -e

echo "=== PageFinder Configuration Build Script ==="
echo "This script will build the application for all platforms."
echo ""

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "Warning: ImageMagick is not installed. Icon generation will be skipped."
    echo "On macOS: brew install imagemagick"
    echo "On Ubuntu/Debian: sudo apt-get install imagemagick"
    echo "On Windows with Chocolatey: choco install imagemagick"
    SKIP_ICON_GENERATION=true
else
    SKIP_ICON_GENERATION=false
fi

# Create placeholder icon if it doesn't exist and ImageMagick is installed
if [ ! -f "build/icon.png" ] && [ "$SKIP_ICON_GENERATION" = false ]; then
    echo "Creating placeholder icon..."
    ./scripts/create-placeholder-icon.sh
fi

# Generate icons for different platforms if ImageMagick is installed
if [ -f "build/icon.png" ] && [ "$SKIP_ICON_GENERATION" = false ]; then
    echo "Generating icons for different platforms..."
    ./scripts/generate-icons.sh
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Build for current platform
echo "Building for current platform..."
npm run dist

# Check if we can build for other platforms
if [ "$(uname)" = "Darwin" ]; then
    # On macOS, we can build for macOS, Windows, and Linux
    echo "Building for Windows..."
    npm run dist:win
    
    echo "Building for Linux..."
    npm run dist:linux
elif [ "$(uname)" = "Linux" ]; then
    # On Linux, we can build for Linux and Windows
    echo "Building for Windows..."
    npm run dist:win
else
    # On Windows, we can only build for Windows
    echo "On Windows, we can only build for Windows."
fi

echo ""
echo "Build complete! Check the 'dist' directory for the output."