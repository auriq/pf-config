const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// Source and destination paths
const sourceConfigPath = path.join(process.cwd(), 'cloud.conf');
const destDir = path.join(os.tmpdir(), 'pf-config-temp');
const destConfigPath = path.join(destDir, 'cloud.conf');

// Ensure the destination directory exists
console.log(`Ensuring directory exists: ${destDir}`);
fs.ensureDirSync(destDir);

// Check if source file exists
if (fs.existsSync(sourceConfigPath)) {
  console.log(`Source config file found at: ${sourceConfigPath}`);
  
  // Copy the file
  try {
    fs.copyFileSync(sourceConfigPath, destConfigPath);
    console.log(`Successfully copied cloud.conf to: ${destConfigPath}`);
    
    // Verify the file was copied
    if (fs.existsSync(destConfigPath)) {
      const content = fs.readFileSync(destConfigPath, 'utf8');
      console.log(`Verified file exists with content length: ${content.length} bytes`);
      console.log(`File content: ${content}`);
    } else {
      console.error(`Failed to verify copied file at: ${destConfigPath}`);
    }
  } catch (error) {
    console.error(`Error copying file: ${error.message}`);
  }
} else {
  console.error(`Source config file not found at: ${sourceConfigPath}`);
}

// List all files in the destination directory
console.log(`\nListing files in ${destDir}:`);
try {
  const files = fs.readdirSync(destDir);
  files.forEach(file => {
    console.log(`- ${file}`);
  });
} catch (error) {
  console.error(`Error listing directory: ${error.message}`);
}