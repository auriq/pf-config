#!/bin/bash

# This script creates a self-signed certificate and signs the macOS application
# Note: This doesn't replace Apple Developer ID signing, but can help with some security warnings

# Exit on error
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== PageFinder Configuration - Self-Signing for macOS ===${NC}"
echo ""

# Check if the app exists
APP_PATH="dist/mac/PageFinder Configuration.app"
if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}Error: Application not found at $APP_PATH${NC}"
    echo -e "${YELLOW}Please build the application first with 'npm run dist:mac'${NC}"
    exit 1
fi

# Create a self-signed certificate if it doesn't exist
CERT_NAME="PageFinderSelfSigned"
if ! security find-certificate -c "$CERT_NAME" -a login.keychain > /dev/null 2>&1; then
    echo -e "${BLUE}Creating self-signed certificate...${NC}"
    security create-keychain -p "password" build.keychain
    security default-keychain -s build.keychain
    security unlock-keychain -p "password" build.keychain
    
    # Create certificate
    openssl req -new -x509 -days 365 -nodes -out "$CERT_NAME.cer" -keyout "$CERT_NAME.key" \
        -subj "/CN=PageFinder Configuration/O=Your Organization/C=US"
    
    # Create p12 file
    openssl pkcs12 -export -out "$CERT_NAME.p12" -inkey "$CERT_NAME.key" -in "$CERT_NAME.cer" -password pass:password
    
    # Import certificate
    security import "$CERT_NAME.p12" -k build.keychain -P "password" -T /usr/bin/codesign
    security set-key-partition-list -S apple-tool:,apple: -s -k "password" build.keychain
    
    # Clean up
    rm "$CERT_NAME.cer" "$CERT_NAME.key" "$CERT_NAME.p12"
    
    echo -e "${GREEN}Self-signed certificate created.${NC}"
else
    echo -e "${GREEN}Certificate already exists.${NC}"
fi

# Sign the application
echo -e "${BLUE}Signing application...${NC}"
codesign --force --deep --sign "$CERT_NAME" "$APP_PATH"

echo -e "${GREEN}Application signed successfully!${NC}"
echo -e "${YELLOW}Note: This is a self-signed certificate and will still trigger Gatekeeper warnings.${NC}"
echo -e "${YELLOW}Users will need to right-click and select 'Open' the first time they run the application.${NC}"