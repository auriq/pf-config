# PageFinder Configuration

A desktop application for configuring cloud storage connections with PageFinder.

## Installation

For detailed installation instructions, please refer to the installation guides:

- [General Installation Guide](docs/installation-guide.md)
- [macOS Installation Guide](docs/installation-guide-macos.md)
- [Windows Installation Guide](docs/installation-guide-windows.md)
- [Linux Installation Guide](docs/installation-guide-linux.md)

## Releases

For information on creating and publishing releases:

- [GitHub Release Guide](docs/github-release-guide.md)

## Features

- Configure cloud storage providers (Google Drive, OneDrive, Box, Dropbox, Local Storage)
- Set up PageFinder configuration
- Test connections between cloud storage and PageFinder
- Schedule automatic synchronization

## Development

### Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)
- ImageMagick (for icon generation)

### Setup

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Start the application in development mode:

```bash
npm start
```

## Building Installation Packages

### Generate Application Icons

1. Create a placeholder icon (or replace with your own 1024x1024 PNG at `build/icon.png`):

```bash
./scripts/create-placeholder-icon.sh
```

2. Generate icons for different platforms:

```bash
./scripts/generate-icons.sh
```

### Build for Current Platform

To build the application for your current platform:

```bash
npm run dist
```

The output will be in the `dist` directory.

### Build for Specific Platforms

#### macOS

```bash
npm run dist:mac
```

This will generate:
- `.dmg` installer (for both Intel and Apple Silicon)
- `.zip` archive (for both Intel and Apple Silicon)

#### Windows

```bash
npm run dist:win
```

This will generate:
- `.exe` installer (NSIS)
- Portable `.exe` (no installation required)

#### Linux

```bash
npm run dist:linux
```

This will generate:
- `.AppImage` (portable Linux application)
- `.deb` package (for Debian-based distributions)

### Build for All Platforms

To build for all platforms (requires appropriate build environments):

```bash
npm run dist:all
```

## Cross-Platform Building

Building for platforms other than your current one may require additional setup:

### Building for Windows on macOS/Linux

Requires Wine and mono:
- macOS: `brew install --cask wine-stable` and `brew install mono`
- Linux: Install Wine and mono using your package manager

### Building for macOS on Windows/Linux

Not possible without a macOS machine due to Apple's restrictions.

### Building for Linux on macOS/Windows

No additional requirements.

## License

MIT