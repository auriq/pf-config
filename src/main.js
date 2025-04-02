/**
 * PageFinder Configuration Application
 * Main entry point
 */

const ConfigManager = require("./modules/config-manager");
const CloudConfigApp = require("./modules/app");
const { log } = require("./modules/utils");

// Check if we're running in Electron context
const isElectron = typeof process !== 'undefined' && 
                  process.versions && 
                  process.versions.electron;

/**
 * Main function to initialize and start the application
 * This is the entry point for the Electron application
 */
async function main() {
  try {
    log("Starting PageFinder Configuration application");
    
    // Initialize the configuration manager
    const configManager = new ConfigManager();
    log("Configuration manager initialized");
    
    // Initialize the application
    const cloudConfigApp = new CloudConfigApp(configManager);
    log("Application initialized");
    
    // Start the application
    cloudConfigApp.init();
    log("Application started");
    
    return true;
  } catch (error) {
    log(`Error starting application: ${error.message}`, 'error');
    console.error(error);
    
    // Show error dialog and exit if in Electron context
    if (isElectron) {
      const { app, dialog } = require("electron");
      if (app.isReady()) {
        dialog.showErrorBox(
          "Application Error",
          `An error occurred while starting the application: ${error.message}\n\nPlease check the logs for more details.`
        );
      }
      
      app.exit(1);
    }
    
    return false;
  }
}

// Execute the main function
main().catch(error => {
  console.error("Unhandled error in main function:", error);
  
  // Exit if in Electron context
  if (isElectron) {
    const { app } = require("electron");
    app.exit(1);
  } else {
    process.exit(1);
  }
});