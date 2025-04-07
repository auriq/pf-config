/**
 * Cross-platform placeholder icon generator
 * This script creates a simple placeholder icon for the application
 * It can be run on Windows, macOS, and Linux
 */

const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

// Configuration
const ICON_SIZE = 512;
const ICON_PATH = path.join(process.cwd(), 'build', 'icon.png');
const TEMP_DIR = os.tmpdir();

// Ensure build directory exists
fs.ensureDirSync(path.join(process.cwd(), 'build'));

/**
 * Create a placeholder icon using ImageMagick
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
async function createIconWithImageMagick() {
  console.log('Attempting to create icon with ImageMagick...');
  
  return new Promise((resolve) => {
    // Command to create a simple blue square with "PF" text
    const command = `convert -size ${ICON_SIZE}x${ICON_SIZE} xc:#0078D4 ` +
      `-gravity center -pointsize 200 -font Arial -fill white -annotate 0 "PF" ` +
      `"${ICON_PATH}"`;
    
    exec(command, (error) => {
      if (error) {
        console.error('ImageMagick error:', error.message);
        resolve(false);
      } else {
        console.log(`Icon created at: ${ICON_PATH}`);
        resolve(true);
      }
    });
  });
}

/**
 * Create a placeholder icon using Node.js (for Windows without ImageMagick)
 * This is a very simple implementation that creates a colored square
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
async function createSimpleIcon() {
  console.log('Creating simple placeholder icon...');
  
  try {
    // Create a simple 1x1 pixel blue PNG
    // This is just a minimal placeholder - in a real app, you'd want to use a proper image library
    const PNG_HEADER = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x02, 0x00,
      0x08, 0x02, 0x00, 0x00, 0x00, 0xFD, 0x5A, 0x5C, 0x35, 0x00, 0x00, 0x00,
      0x0C, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x5E, 0xF3, 0x2D, 0xC5, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
    
    fs.writeFileSync(ICON_PATH, PNG_HEADER);
    console.log(`Simple icon created at: ${ICON_PATH}`);
    return true;
  } catch (error) {
    console.error('Error creating simple icon:', error.message);
    return false;
  }
}

/**
 * Create a placeholder icon using PowerShell (Windows-specific)
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
async function createIconWithPowerShell() {
  if (process.platform !== 'win32') {
    return false;
  }
  
  console.log('Attempting to create icon with PowerShell...');
  
  // Create a temporary PowerShell script
  const scriptPath = path.join(TEMP_DIR, 'create_icon.ps1');
  const script = `
    Add-Type -AssemblyName System.Drawing
    $img = New-Object System.Drawing.Bitmap ${ICON_SIZE}, ${ICON_SIZE}
    $g = [System.Drawing.Graphics]::FromImage($img)
    $g.Clear([System.Drawing.Color]::FromArgb(0, 120, 212))
    $font = New-Object System.Drawing.Font('Arial', 200, [System.Drawing.FontStyle]::Bold)
    $brush = [System.Drawing.Brushes]::White
    $g.DrawString('PF', $font, $brush, 100, 100)
    $img.Save('${ICON_PATH.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
  `;
  
  fs.writeFileSync(scriptPath, script);
  
  return new Promise((resolve) => {
    exec(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`, (error) => {
      // Clean up the temporary script
      try {
        fs.unlinkSync(scriptPath);
      } catch (e) {
        // Ignore cleanup errors
      }
      
      if (error) {
        console.error('PowerShell error:', error.message);
        resolve(false);
      } else {
        console.log(`Icon created with PowerShell at: ${ICON_PATH}`);
        resolve(true);
      }
    });
  });
}

/**
 * Main function to create the icon using the best available method
 */
async function main() {
  console.log('Creating placeholder icon...');
  
  // Check if icon already exists
  if (fs.existsSync(ICON_PATH)) {
    console.log(`Icon already exists at: ${ICON_PATH}`);
    return;
  }
  
  // Try ImageMagick first
  if (await createIconWithImageMagick()) {
    return;
  }
  
  // On Windows, try PowerShell next
  if (process.platform === 'win32') {
    if (await createIconWithPowerShell()) {
      return;
    }
  }
  
  // Fallback to simple icon
  await createSimpleIcon();
}

// Run the main function
main().catch(error => {
  console.error('Error creating icon:', error);
  process.exit(1);
});