# Multi-Platform Build Guide

This document provides instructions for building the PageFinder Configuration application for multiple platforms (Windows, macOS, and Linux).

## Prerequisites

Before building the application, ensure you have the following installed:

- **Node.js** (v14 or later)
- **npm** (v6 or later)
- **Git**

### Platform-Specific Requirements

#### Windows
- Windows 10 or later
- PowerShell 5.0 or later (for enhanced JSON parsing)
- Optional: ImageMagick (`choco install imagemagick`)

#### macOS
- macOS 10.15 (Catalina) or later
- Xcode Command Line Tools (`xcode-select --install`)
- Optional: ImageMagick (`brew install imagemagick`)

#### Linux
- A modern Linux distribution (Ubuntu 20.04+, Fedora 34+, etc.)
- Optional: ImageMagick (`sudo apt-get install imagemagick` or equivalent)

## Building the Application

### Quick Build

To build the application for your current platform, run:

```bash
npm run build
```

This will automatically detect your platform and run the appropriate build script.

### Platform-Specific Builds

#### Windows

```bash
npm run build:win
# or
scripts\build-all.bat
```

#### macOS/Linux

```bash
npm run build:unix
# or
./scripts/build-all.sh
```

### Building for Specific Platforms

You can build for specific platforms using the following npm scripts:

```bash
# Build for Windows
npm run dist:win

# Build for macOS
npm run dist:mac

# Build for Linux
npm run dist:linux

# Build for all platforms (requires appropriate build environment)
npm run dist:all
```

## Cross-Platform Building

### Building Windows from macOS/Linux

To build Windows applications from macOS or Linux, you need Wine installed:

#### macOS
```bash
brew install --cask wine-stable
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get install wine64
```

### Building macOS from Windows/Linux

Building for macOS from non-macOS platforms has limitations:

- Code signing is not possible
- Notarization is not possible
- DMG creation may have issues

It's recommended to build macOS applications on a macOS machine.

### Building Linux from Windows/macOS

Building Linux packages from non-Linux platforms generally works without additional requirements.

## Code Signing

### Windows Code Signing

To sign Windows builds, you need a code signing certificate. Set the following environment variables:

```
CSC_LINK=path/to/certificate.pfx
CSC_KEY_PASSWORD=your-certificate-password
```

### macOS Code Signing

To sign macOS builds, you need an Apple Developer certificate. Set the following environment variables:

```
CSC_NAME="Developer ID Application: Your Name (TEAMID)"
APPLE_ID=your.apple.id@example.com
APPLE_ID_PASSWORD=your-app-specific-password
TEAM_ID=your-team-id
```

For notarization, the application uses the `electron-notarize` package. Make sure the environment variables above are set.

#### Entitlements

The application uses two entitlements files:
- `build/entitlements.mac.plist` - Used for the app bundle
- `build/entitlements.mac.inherit.plist` - Used for child processes

These files grant the necessary permissions for the app to function properly on macOS, including:
- JIT compilation
- Network access
- File access
- System events

To build with these entitlements:

```bash
npm run dist:mac:signed
```

## Testing

To verify that the application works correctly on your platform, run:

```bash
npm test
```

This will run the platform-specific tests to ensure compatibility.
## Troubleshooting

### macOS-Specific Issues

#### App doesn't launch on first attempt
This is addressed by our `fix-mac-issues.js` script which modifies the Info.plist file. The script is automatically run when using `npm run dist:mac`. If you need to manually apply the fix, run:
```bash
npm run fix:mac
```

#### Window doesn't focus properly
Fixed in main.js with improved window activation code. Ensures proper window focus when the app is activated.

#### Duplicate processes
Fixed with single instance lock in main.js. Prevents multiple instances of the app from running.

#### Manual Fixes
If you need to manually apply the macOS fixes to an existing build:
```bash
npm run fix:mac
```

### Common Issues
### Common Issues

#### "Error: Cannot find module 'electron'"
Run `npm install` to install all dependencies.

#### Icon Generation Fails
If ImageMagick is not installed, the build will use fallback methods for icon generation. Install ImageMagick for better icon quality.

#### Windows Build Fails with "PowerShell is not recognized"
Ensure PowerShell is installed and in your PATH.

#### macOS Notarization Fails
Ensure you have set all required environment variables (APPLE_ID, APPLE_ID_PASSWORD, TEAM_ID).

#### macOS App Hangs or Doesn't Launch
If the app hangs when loading remotes or doesn't launch properly, it may be due to permission issues. Fix them by running:

```bash
# Run the permission fix script
npm run fix:permissions

# If that doesn't work, try with sudo
sudo ./scripts/fix-permissions.sh
```

This script will:
- Fix rclone executable permissions
- Create necessary configuration directories
- Set appropriate permissions on app files
- Create default configuration files if they don't exist

The app also includes a post-installation script that runs automatically on first launch to fix common permission issues.

#### Linux Build Fails with "Error: Unrecognized platform"
Ensure you're using a supported Linux distribution and have all required dependencies installed.
## Creating GitHub Releases

To create a GitHub release with all built artifacts:

```bash
# Build and create a GitHub release
npm run release
```

This script will:
1. Build the application for all platforms
2. Create a new tag based on the version in package.json
3. Push the tag to GitHub
4. Provide instructions for completing the release

### Manual Release Process

If you prefer to create releases manually:

1. Build the application for all platforms:
   ```bash
   npm run dist:all
   ```

2. Create a new tag and push it to GitHub:
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```

3. Go to GitHub and create a new release from the tag
4. Upload the built artifacts from the `dist` directory
5. Add release notes
6. Publish the release

## Additional Resources

- [Electron Builder Documentation](https://www.electron.build/)
- [Electron Documentation](https://www.electronjs.org/docs)
- [Node.js Documentation](https://nodejs.org/en/docs/)
- [Node.js Documentation](https://nodejs.org/en/docs/)