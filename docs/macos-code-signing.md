# macOS Code Signing Guide

This document explains the options for handling macOS code signing for the PageFinder Configuration application.

## Background

macOS has security features that prevent users from running applications that aren't verified:

1. **Gatekeeper**: Blocks applications that aren't:
   - From the Mac App Store
   - Signed with an Apple Developer ID certificate
   - Notarized by Apple

2. **Quarantine Attribute**: macOS adds a quarantine attribute to files downloaded from the internet, which triggers additional security checks.

When users try to open an unsigned application, they might see:
- A warning message saying the app "cannot be opened because it is from an unidentified developer"
- An error message saying the app "is damaged and can't be opened. You should move it to the Trash."

## Options for Handling Code Signing

### Option 1: Use the ZIP Version and Remove Quarantine Attribute (Simplest for Users)

The ZIP version of the application can be easier for users to work with:

1. Users download the ZIP file
2. Extract it
3. Move the app to Applications folder
4. Remove the quarantine attribute using one of these methods:
   - Run our helper script: `scripts/fix-mac-quarantine.sh`
   - Use Terminal: `xattr -d com.apple.quarantine /Applications/PageFinder\ Configuration.app`
5. Open the application normally

This approach requires no code signing but does require users to take an extra step to remove the quarantine attribute.

We've included a helper script (`scripts/fix-mac-quarantine.sh`) that automates the process of removing the quarantine attribute. This script:
- Automatically finds the application
- Removes the quarantine attribute
- Provides troubleshooting guidance if needed

### Option 2: Self-Signing (Included in this Repository)

We've included a script (`scripts/sign-mac-app.sh`) that creates a self-signed certificate and uses it to sign the application. This doesn't eliminate the security warnings but can make them less severe in some cases.

To use self-signing:

```bash
npm run dist:mac:signed
```

This will:
1. Build the macOS application
2. Create a self-signed certificate (if one doesn't exist)
3. Sign the application with this certificate

Users will still need to right-click and select "Open" the first time they run the application.

### Option 3: Apple Developer ID Signing (Most Professional)

For a completely seamless experience, you need to:

1. Enroll in the Apple Developer Program ($99/year)
2. Create a Developer ID certificate
3. Sign the application with this certificate
4. Notarize the application with Apple

#### Steps for Developer ID Signing:

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/)
2. Create a Developer ID certificate in Xcode or the Apple Developer portal
3. Update the build configuration in `package.json`:

```json
"mac": {
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "entitlements": "build/entitlements.mac.plist",
  "entitlementsInherit": "build/entitlements.mac.plist",
  "identity": "Developer ID Application: Your Name (TEAM_ID)"
}
```

4. Create entitlements files:

```xml
<!-- build/entitlements.mac.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
  </dict>
</plist>
```

5. Build and notarize the application:

```bash
# Build the app
electron-builder --mac

# Notarize the app
xcrun notarytool submit dist/mac/*.dmg --apple-id "your.email@example.com" --password "app-specific-password" --team-id "TEAM_ID" --wait
```

## Recommendation

For now, we recommend:

1. Using the self-signing script for development and testing
2. Updating the installation guide to emphasize the ZIP version and include instructions for bypassing Gatekeeper
3. Consider enrolling in the Apple Developer Program for a more professional release

If you decide to pursue the Apple Developer ID signing route, we can provide more detailed instructions and scripts to automate the process.