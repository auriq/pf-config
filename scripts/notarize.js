/**
 * macOS Notarization Script
 * 
 * This script is used by electron-builder to notarize the macOS app bundle
 * after it has been signed. Notarization is required for macOS Catalina and later.
 * 
 * To use this script:
 * 1. Set the environment variables:
 *    - APPLE_ID: Your Apple ID email
 *    - APPLE_ID_PASSWORD: An app-specific password for your Apple ID
 *    - TEAM_ID: Your Apple Developer Team ID
 * 
 * 2. Make sure this script is referenced in package.json:
 *    "build": {
 *      "afterSign": "scripts/notarize.js"
 *    }
 */

const { notarize } = require('electron-notarize');
const path = require('path');
const fs = require('fs');

// Read package.json to get app info
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const appBundleId = packageJson.build.appId;
const appName = packageJson.build.productName;

module.exports = async function (params) {
  // Only notarize the app on macOS
  if (process.platform !== 'darwin') {
    console.log('Skipping notarization: not macOS');
    return;
  }

  // Check if we're running in CI or if notarization is explicitly disabled
  if (process.env.SKIP_NOTARIZATION === 'true') {
    console.log('Skipping notarization: SKIP_NOTARIZATION is set');
    return;
  }

  // Check for required environment variables
  const { APPLE_ID, APPLE_ID_PASSWORD, TEAM_ID } = process.env;
  
  if (!APPLE_ID || !APPLE_ID_PASSWORD || !TEAM_ID) {
    console.log('Skipping notarization: Required environment variables are missing');
    console.log('Required: APPLE_ID, APPLE_ID_PASSWORD, TEAM_ID');
    return;
  }

  console.log(`Notarizing ${appName} (${appBundleId})...`);
  console.log(`Using Apple ID: ${APPLE_ID}`);

  // Get the path to the app
  const appPath = path.join(
    params.appOutDir,
    `${appName}.app`
  );

  if (!fs.existsSync(appPath)) {
    console.error(`App not found at: ${appPath}`);
    return;
  }

  try {
    // Notarize the app
    await notarize({
      appBundleId,
      appPath,
      appleId: APPLE_ID,
      appleIdPassword: APPLE_ID_PASSWORD,
      teamId: TEAM_ID,
    });

    console.log(`Notarization completed for ${appName}`);
  } catch (error) {
    console.error(`Notarization failed: ${error.message}`);
    throw error;
  }
};