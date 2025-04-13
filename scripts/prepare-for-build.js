/**
 * Script to prepare the application for building
 * This script ensures that all shell scripts are executable and properly included in the build
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

// Get the project root directory
const rootDir = path.resolve(__dirname, '..');
const scriptsDir = path.join(rootDir, 'scripts');
const buildResourcesDir = path.join(rootDir, 'build', 'scripts');

console.log('Preparing scripts for build...');

// Create the build/scripts directory if it doesn't exist
fs.ensureDirSync(buildResourcesDir);

// Copy all scripts to the build/scripts directory
fs.copySync(scriptsDir, buildResourcesDir, {
  filter: (src) => {
    // Skip the prepare-for-build.js script itself
    return !src.endsWith('prepare-for-build.js');
  }
});

console.log('Scripts copied to build/scripts directory');

// Make shell scripts executable on Unix-like systems
if (process.platform !== 'win32') {
  try {
    console.log('Making shell scripts executable...');
    
    // Find all .sh files in the build/scripts directory
    const shellScripts = fs.readdirSync(buildResourcesDir)
      .filter(file => file.endsWith('.sh'))
      .map(file => path.join(buildResourcesDir, file));
    
    // Make each shell script executable
    shellScripts.forEach(script => {
      execSync(`chmod +x "${script}"`);
      console.log(`Made executable: ${script}`);
    });
    
    console.log('All shell scripts are now executable');
  } catch (error) {
    console.error('Error making shell scripts executable:', error);
  }
}

// Create a .npmignore file in the scripts directory to ensure all scripts are included
const npmignorePath = path.join(scriptsDir, '.npmignore');
fs.writeFileSync(npmignorePath, '# Include all files in this directory\n');
console.log('Created .npmignore file to ensure all scripts are included');

// Update the extraResources in package.json if needed
try {
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageJson = require(packageJsonPath);
  
  // Ensure the build configuration has extraResources
  if (!packageJson.build) {
    packageJson.build = {};
  }
  
  if (!packageJson.build.extraResources) {
    packageJson.build.extraResources = [];
  }
  
  // Add the scripts directory to extraResources if not already present
  const scriptsResource = { from: 'build/scripts', to: 'scripts' };
  const hasScriptsResource = packageJson.build.extraResources.some(resource => 
    (typeof resource === 'object' && resource.from === scriptsResource.from && resource.to === scriptsResource.to) ||
    (typeof resource === 'string' && resource === 'build/scripts')
  );
  
  if (!hasScriptsResource) {
    packageJson.build.extraResources.push(scriptsResource);
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('Updated package.json to include scripts in extraResources');
  }
} catch (error) {
  console.error('Error updating package.json:', error);
}

console.log('Scripts preparation completed successfully');