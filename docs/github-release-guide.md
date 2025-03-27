# GitHub Release Guide for PageFinder Configuration

This guide explains how to create and publish releases of the PageFinder Configuration application on GitHub.

## Prerequisites

- A GitHub account
- Git installed on your computer
- Repository pushed to GitHub
- Node.js and npm installed

## Automated Release Process

We've set up an automated release process using GitHub Actions. When you push a tag to GitHub, it will automatically:

1. Build the application for all platforms (macOS, Windows, and Linux)
2. Create a draft release with all the built artifacts
3. Allow you to review and publish the release

## Creating a New Release

### Method 1: Using the Helper Script (Recommended)

We've created a helper script that guides you through the release process:

1. Open a terminal in the project directory
2. Run the release script:
   ```bash
   ./scripts/create-github-release.sh
   ```
3. Follow the prompts to:
   - Initialize a Git repository (if needed)
   - Add a remote repository (if needed)
   - Set the release version
   - Commit any changes
   - Create and push a tag

4. The script will provide links to monitor the build process and access the draft release

### Method 2: Manual Process

If you prefer to create releases manually:

1. Update the version in `package.json`:
   ```json
   {
     "version": "x.y.z",
     ...
   }
   ```

2. Commit your changes:
   ```bash
   git add .
   git commit -m "Prepare release x.y.z"
   ```

3. Create a tag:
   ```bash
   git tag -a vx.y.z -m "Release vx.y.z"
   ```

4. Push the tag to GitHub:
   ```bash
   git push origin vx.y.z
   ```

5. GitHub Actions will automatically start building the release

## Monitoring the Build Process

1. Go to your repository on GitHub
2. Click on the "Actions" tab
3. You should see a workflow running for your tag
4. Wait for the workflow to complete (this may take several minutes)

## Publishing the Release

Once the build is complete:

1. Go to your repository on GitHub
2. Click on the "Releases" tab
3. You should see a draft release for your tag
4. Click "Edit" on the draft release
5. Add release notes describing the changes in this version
6. Review the attached artifacts (they should include builds for all platforms)
7. Click "Publish release" when you're ready

## Release Artifacts

The release will include the following artifacts:

- For macOS:
  - DMG installer (for both Intel and Apple Silicon)
  - ZIP archive (for both Intel and Apple Silicon)

- For Windows:
  - EXE installer (NSIS)
  - Portable EXE

- For Linux:
  - AppImage
  - DEB package

## Versioning Guidelines

We follow [Semantic Versioning](https://semver.org/) for the PageFinder Configuration application:

- **Major version (x.0.0)**: Incompatible API changes or major UI overhauls
- **Minor version (0.x.0)**: New features in a backward-compatible manner
- **Patch version (0.0.x)**: Backward-compatible bug fixes

## Troubleshooting

### Build Failures

If the GitHub Actions workflow fails:

1. Go to the Actions tab and click on the failed workflow
2. Examine the logs to identify the issue
3. Fix the issue in your local repository
4. Create a new tag and push it again

### Missing Artifacts

If some artifacts are missing from the release:

1. Check the workflow logs to see if there were build errors
2. Ensure that the build scripts are correctly configured for all platforms
3. Try rebuilding the release by creating a new tag

## Getting Help

If you encounter any issues with the release process, please contact the development team or open an issue on GitHub.