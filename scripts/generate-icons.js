const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

// Check if ImageMagick is installed
function checkImageMagick() {
  try {
    execSync('convert -version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Generate Windows icon from PNG
function generateWindowsIcon() {
  const buildDir = path.join(__dirname, '..', 'build');
  const pngPath = path.join(buildDir, 'icon.png');
  const icoPath = path.join(buildDir, 'icon.ico');
  
  if (!fs.existsSync(pngPath)) {
    console.error('Error: icon.png not found in build directory');
    return false;
  }
  
  try {
    // Use ImageMagick to convert PNG to ICO
    execSync(`convert ${pngPath} -define icon:auto-resize=256,128,64,48,32,16 ${icoPath}`);
    console.log(`Successfully generated Windows icon at: ${icoPath}`);
    return true;
  } catch (error) {
    console.error('Error generating Windows icon:', error.message);
    return false;
  }
}

// Main function
function main() {
  console.log('PageFinder Configuration - Icon Generator');
  console.log('=========================================');
  
  // Check for ImageMagick
  if (!checkImageMagick()) {
    console.error('Error: ImageMagick is not installed or not in PATH');
    console.error('Please install ImageMagick: https://imagemagick.org/script/download.php');
    process.exit(1);
  }
  
  // Generate Windows icon
  if (generateWindowsIcon()) {
    console.log('Icon generation completed successfully!');
  } else {
    console.error('Icon generation failed.');
    process.exit(1);
  }
}

// Run the main function
main();