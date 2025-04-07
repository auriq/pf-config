/**
 * Cross-platform icon generator
 * This script generates platform-specific icons from a base icon.png file
 * It can be run on Windows, macOS, and Linux
 */

const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

// Configuration
const SOURCE_ICON = path.join(process.cwd(), 'build', 'icon.png');
const BUILD_DIR = path.join(process.cwd(), 'build');
const TEMP_DIR = os.tmpdir();

// Platform-specific icon configurations
const ICON_CONFIGS = {
  // Windows icons
  win: [
    { name: 'icon.ico', sizes: [16, 24, 32, 48, 64, 128, 256] },
  ],
  // macOS icons
  mac: [
    { name: 'icon.icns', sizes: [16, 32, 64, 128, 256, 512, 1024] },
  ],
  // Linux icons
  linux: [
    { name: 'icon.png', size: 512 },
    { name: '16x16.png', size: 16 },
    { name: '32x32.png', size: 32 },
    { name: '48x48.png', size: 48 },
    { name: '64x64.png', size: 64 },
    { name: '128x128.png', size: 128 },
    { name: '256x256.png', size: 256 },
    { name: '512x512.png', size: 512 },
  ]
};

// Ensure build directory exists
fs.ensureDirSync(BUILD_DIR);

/**
 * Check if ImageMagick is installed
 * @returns {Promise<boolean>} True if ImageMagick is installed, false otherwise
 */
async function isImageMagickInstalled() {
  return new Promise((resolve) => {
    const command = process.platform === 'win32' ? 'where convert' : 'which convert';
    exec(command, (error) => {
      resolve(!error);
    });
  });
}

/**
 * Generate icons using ImageMagick
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
async function generateIconsWithImageMagick() {
  console.log('Generating icons with ImageMagick...');
  
  if (!fs.existsSync(SOURCE_ICON)) {
    console.error(`Source icon not found: ${SOURCE_ICON}`);
    return false;
  }
  
  try {
    // Generate Windows icons
    if (process.platform === 'win32' || process.env.GENERATE_ALL) {
      console.log('Generating Windows icons...');
      for (const config of ICON_CONFIGS.win) {
        const sizes = config.sizes.map(size => `${size}x${size}`).join(' ');
        const command = `convert "${SOURCE_ICON}" -resize ${sizes} "${path.join(BUILD_DIR, config.name)}"`;
        await execCommand(command);
      }
    }
    
    // Generate macOS icons
    if (process.platform === 'darwin' || process.env.GENERATE_ALL) {
      console.log('Generating macOS icons...');
      for (const config of ICON_CONFIGS.mac) {
        // For macOS, we need to create a temporary iconset directory
        const iconsetDir = path.join(TEMP_DIR, 'appicon.iconset');
        fs.ensureDirSync(iconsetDir);
        
        // Generate each size
        for (const size of config.sizes) {
          const command = `convert "${SOURCE_ICON}" -resize ${size}x${size} "${path.join(iconsetDir, `icon_${size}x${size}.png`)}"`;
          await execCommand(command);
        }
        
        // Use iconutil on macOS to create .icns file
        if (process.platform === 'darwin') {
          await execCommand(`iconutil -c icns -o "${path.join(BUILD_DIR, config.name)}" "${iconsetDir}"`);
        } else {
          console.log('Skipping .icns generation on non-macOS platform');
          // Copy the largest PNG as a fallback
          fs.copyFileSync(
            path.join(iconsetDir, `icon_${Math.max(...config.sizes)}x${Math.max(...config.sizes)}.png`),
            path.join(BUILD_DIR, 'icon.png')
          );
        }
        
        // Clean up
        fs.removeSync(iconsetDir);
      }
    }
    
    // Generate Linux icons
    if (process.platform === 'linux' || process.env.GENERATE_ALL) {
      console.log('Generating Linux icons...');
      for (const config of ICON_CONFIGS.linux) {
        const command = `convert "${SOURCE_ICON}" -resize ${config.size}x${config.size} "${path.join(BUILD_DIR, config.name)}"`;
        await execCommand(command);
      }
    }
    
    console.log('Icon generation completed successfully');
    return true;
  } catch (error) {
    console.error('Error generating icons:', error.message);
    return false;
  }
}

/**
 * Execute a command and return a promise
 * @param {string} command - The command to execute
 * @returns {Promise<string>} The command output
 */
function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Command failed: ${error.message}\n${stderr}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

/**
 * Generate a simple icon set without ImageMagick
 * Just copies the source icon to the expected locations
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
async function generateSimpleIcons() {
  console.log('Generating simple icon set...');
  
  if (!fs.existsSync(SOURCE_ICON)) {
    console.error(`Source icon not found: ${SOURCE_ICON}`);
    return false;
  }
  
  try {
    // For Windows, copy the PNG as icon.ico (not ideal but better than nothing)
    if (process.platform === 'win32' || process.env.GENERATE_ALL) {
      fs.copyFileSync(SOURCE_ICON, path.join(BUILD_DIR, 'icon.ico'));
    }
    
    // For macOS, copy the PNG as icon.icns (not ideal but better than nothing)
    if (process.platform === 'darwin' || process.env.GENERATE_ALL) {
      fs.copyFileSync(SOURCE_ICON, path.join(BUILD_DIR, 'icon.icns'));
    }
    
    // For Linux, copy the PNG to various sizes (all the same, but with correct names)
    if (process.platform === 'linux' || process.env.GENERATE_ALL) {
      for (const config of ICON_CONFIGS.linux) {
        fs.copyFileSync(SOURCE_ICON, path.join(BUILD_DIR, config.name));
      }
    }
    
    console.log('Simple icon generation completed');
    return true;
  } catch (error) {
    console.error('Error generating simple icons:', error.message);
    return false;
  }
}

/**
 * Main function to generate icons using the best available method
 */
async function main() {
  console.log('Starting icon generation...');
  
  // Check if source icon exists
  if (!fs.existsSync(SOURCE_ICON)) {
    console.error(`Source icon not found: ${SOURCE_ICON}`);
    process.exit(1);
  }
  
  // Try to use ImageMagick if available
  const hasImageMagick = await isImageMagickInstalled();
  if (hasImageMagick) {
    if (await generateIconsWithImageMagick()) {
      return;
    }
  } else {
    console.log('ImageMagick not found, using simple icon generation');
  }
  
  // Fallback to simple icon generation
  await generateSimpleIcons();
}

// Run the main function
main().catch(error => {
  console.error('Error in icon generation:', error);
  process.exit(1);
});