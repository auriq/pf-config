/**
 * Fix macOS-specific issues
 *
 * This script addresses common issues with macOS builds:
 * 1. Ensures proper app activation
 * 2. Fixes window focus issues
 * 3. Adds protocol handler registration
 * 4. Fixes rclone execution permissions
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// Configuration
const APP_NAME = 'PageFinder Configuration';
const APP_BUNDLE_ID = 'com.pagefinder.config';

console.log('=== PageFinder Configuration macOS Fix Script ===');

// Check if running on macOS
if (process.platform !== 'darwin') {
  console.log('This script is intended to be run on macOS only.');
  console.log('Current platform:', process.platform);
  process.exit(0);
}

/**
 * Fix Info.plist to ensure proper app activation
 */
function fixInfoPlist() {
  try {
    console.log('Checking for built macOS app...');
    
    // Find the app in the dist directory
    const distDir = path.join(process.cwd(), 'dist');
    if (!fs.existsSync(distDir)) {
      console.log('dist directory not found. Build the app first.');
      return false;
    }
    
    // Look for .app bundle
    const appBundles = fs.readdirSync(distDir).filter(file => file.endsWith('.app'));
    if (appBundles.length === 0) {
      console.log('No .app bundle found in dist directory.');
      return false;
    }
    
    const appBundle = appBundles[0];
    console.log(`Found app bundle: ${appBundle}`);
    
    // Path to Info.plist
    const infoPlistPath = path.join(distDir, appBundle, 'Contents', 'Info.plist');
    if (!fs.existsSync(infoPlistPath)) {
      console.log(`Info.plist not found at ${infoPlistPath}`);
      return false;
    }
    
    console.log('Modifying Info.plist...');
    
    // Read current Info.plist
    let infoPlistContent = fs.readFileSync(infoPlistPath, 'utf8');
    
    // Check if LSUIElement is already set
    if (!infoPlistContent.includes('<key>LSUIElement</key>')) {
      // Find the closing </dict> tag
      const insertPosition = infoPlistContent.lastIndexOf('</dict>');
      if (insertPosition === -1) {
        console.log('Could not find closing </dict> tag in Info.plist');
        return false;
      }
      
      // Insert LSUIElement key (set to false to ensure dock icon appears)
      const lsuiElementEntry = `
  <key>LSUIElement</key>
  <false/>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSSupportsAutomaticGraphicsSwitching</key>
  <true/>`;
      
      infoPlistContent = infoPlistContent.slice(0, insertPosition) + lsuiElementEntry + infoPlistContent.slice(insertPosition);
      
      // Write updated Info.plist
      fs.writeFileSync(infoPlistPath, infoPlistContent);
      console.log('Added LSUIElement entry to Info.plist');
    } else {
      console.log('LSUIElement already exists in Info.plist');
    }
    
    // Add protocol handler if not already present
    if (!infoPlistContent.includes('CFBundleURLTypes')) {
      // Find the closing </dict> tag
      const insertPosition = infoPlistContent.lastIndexOf('</dict>');
      if (insertPosition === -1) {
        console.log('Could not find closing </dict> tag in Info.plist');
        return false;
      }
      
      // Insert URL scheme handler
      const urlSchemeEntry = `
  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleURLName</key>
      <string>${APP_BUNDLE_ID}</string>
      <key>CFBundleURLSchemes</key>
      <array>
        <string>pf-config</string>
      </array>
    </dict>
  </array>`;
      
      infoPlistContent = infoPlistContent.slice(0, insertPosition) + urlSchemeEntry + infoPlistContent.slice(insertPosition);
      
      // Write updated Info.plist
      fs.writeFileSync(infoPlistPath, infoPlistContent);
      console.log('Added URL scheme handler to Info.plist');
    } else {
      console.log('URL scheme handler already exists in Info.plist');
    }
    
    return true;
  } catch (error) {
    console.error('Error fixing Info.plist:', error.message);
    return false;
  }
}

/**
 * Fix app permissions
 */
function fixAppPermissions() {
  try {
    console.log('Fixing app permissions...');
    
    // Find the app in the dist directory
    const distDir = path.join(process.cwd(), 'dist');
    const appBundles = fs.readdirSync(distDir).filter(file => file.endsWith('.app'));
    if (appBundles.length === 0) {
      console.log('No .app bundle found in dist directory.');
      return false;
    }
    
    const appBundle = appBundles[0];
    const appPath = path.join(distDir, appBundle);
    
    // Fix permissions
    execSync(`chmod -R +x "${appPath}/Contents/MacOS/"`, { stdio: 'inherit' });
    console.log('Fixed executable permissions');
    
    return true;
  } catch (error) {
    console.error('Error fixing app permissions:', error.message);
    return false;
  }
}

/**
 * Fix rclone execution permissions
 */
function fixRclonePermissions() {
  try {
    console.log('Checking for rclone installation...');
    
    // Common rclone paths on macOS
    const rclonePaths = [
      '/usr/local/bin/rclone',
      '/usr/bin/rclone',
      '/opt/homebrew/bin/rclone',
      '/opt/local/bin/rclone',
      path.join(os.homedir(), 'bin', 'rclone')
    ];
    
    // Check each path and fix permissions if found
    for (const rclonePath of rclonePaths) {
      if (fs.existsSync(rclonePath)) {
        console.log(`Found rclone at ${rclonePath}, fixing permissions...`);
        execSync(`chmod +x "${rclonePath}"`, { stdio: 'inherit' });
        console.log('Fixed rclone permissions');
        return true;
      }
    }
    
    console.log('Rclone not found in common paths');
    return false;
  } catch (error) {
    console.error('Error fixing rclone permissions:', error.message);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('Starting macOS fixes...');
  
  // Fix Info.plist
  const plistFixed = fixInfoPlist();
  if (!plistFixed) {
    console.log('Info.plist fix failed or not needed.');
  }
  
  // Fix app permissions
  const permissionsFixed = fixAppPermissions();
  if (!permissionsFixed) {
    console.log('Permission fix failed or not needed.');
  }
  
  // Fix rclone permissions
  const rcloneFixed = fixRclonePermissions();
  if (rcloneFixed) {
    console.log('Rclone permissions fixed successfully.');
  }
  
  // Create user data directory if it doesn't exist
  try {
    const userDataDir = path.join(os.homedir(), '.config', 'pf-config');
    fs.ensureDirSync(userDataDir);
    console.log(`Ensured user data directory exists at: ${userDataDir}`);
    
    // Also ensure logs directory exists
    const logsDir = path.join(userDataDir, 'logs');
    fs.ensureDirSync(logsDir);
    console.log(`Ensured logs directory exists at: ${logsDir}`);
  } catch (error) {
    console.error('Error creating user data directories:', error.message);
  }
  
  console.log('macOS fixes completed.');
}

// Run the main function
main().catch(error => {
  console.error('Error in fix-mac-issues script:', error);
  process.exit(1);
});