#!/bin/bash

# This script removes the quarantine attribute from the PageFinder Configuration app
# This helps bypass the "app is damaged and can't be opened" error on macOS

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== PageFinder Configuration - Fix macOS Quarantine ===${NC}"
echo ""

# Check if app path is provided
if [ "$#" -eq 1 ]; then
    APP_PATH="$1"
else
    # Default locations to check
    LOCATIONS=(
        "/Applications/PageFinder Configuration.app"
        "$HOME/Applications/PageFinder Configuration.app"
        "$HOME/Downloads/PageFinder Configuration.app"
        "./PageFinder Configuration.app"
    )
    
    APP_PATH=""
    for loc in "${LOCATIONS[@]}"; do
        if [ -d "$loc" ]; then
            APP_PATH="$loc"
            break
        fi
    done
    
    if [ -z "$APP_PATH" ]; then
        echo -e "${YELLOW}Could not find PageFinder Configuration.app automatically.${NC}"
        echo -e "${YELLOW}Please enter the full path to the app:${NC}"
        read -r APP_PATH
    fi
fi

# Check if the app exists
if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}Error: Application not found at $APP_PATH${NC}"
    echo -e "${YELLOW}Please make sure the path is correct and try again.${NC}"
    exit 1
fi

echo -e "${BLUE}Removing quarantine attribute from: ${APP_PATH}${NC}"

# Remove the quarantine attribute
xattr -d com.apple.quarantine "$APP_PATH" 2>/dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Successfully removed quarantine attribute!${NC}"
    echo -e "${GREEN}You should now be able to open the application normally.${NC}"
else
    echo -e "${YELLOW}No quarantine attribute found or permission denied.${NC}"
    echo -e "${YELLOW}If you still can't open the app, try running:${NC}"
    echo -e "${BLUE}sudo xattr -d com.apple.quarantine \"$APP_PATH\"${NC}"
fi

echo ""
echo -e "${BLUE}Additional troubleshooting:${NC}"
echo -e "1. Right-click on the app and select 'Open'"
echo -e "2. Check Security & Privacy settings in System Preferences"
echo -e "3. If all else fails, try downloading the app again"