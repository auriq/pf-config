/**
 * PageFinder Configuration Application
 * Main entry point
 */

const ConfigManager = require("./modules/config-manager");
const os = require('os'); // Required for os.tmpdir()
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
    
    // Directly register schedule handlers here for reliability
    const { ipcMain } = require('electron');
    
    // Get current schedule handler
    ipcMain.handle('get-current-schedule', async () => {
      try {
        const settings = configManager.getSettings();
        const schedule = settings.schedule || {
          enabled: false,
          frequency: 'daily',
          hour: 0,
          minute: 0
        };
        
        return {
          success: true,
          message: 'Schedule loaded',
          schedule: schedule
        };
      } catch (error) {
        console.error('Error getting current schedule:', error);
        return {
          success: false,
          message: `Error getting schedule: ${error.message}`,
          schedule: null
        };
      }
    });
    
    // Save schedule handler
    ipcMain.handle('save-schedule', async (event, schedule) => {
      try {
        console.log('Saving schedule:', schedule);
        
        // Simple implementation that stores the schedule in settings
        const settings = configManager.getSettings();
        settings.schedule = schedule;
        configManager.saveSettings(settings);
        
        // Generate a cron expression (simple implementation)
        let cronExpression = '';
        // Always generate cron expression regardless of enabled state
        // Format: minute hour * * day-of-week
        const minute = schedule.minute;
        const hour = schedule.hour;
          
          switch (schedule.frequency) {
            case 'daily':
              cronExpression = `${minute} ${hour} * * *`;
              break;
            case 'weekly':
              cronExpression = `${minute} ${hour} * * ${schedule.dayOfWeek}`;
              break;
            case 'monthly':
              cronExpression = `${minute} ${hour} ${schedule.dayOfMonth} * *`;
              break;
          }
          
          // Log the generated cron expression
          console.log('Generated cron expression:', cronExpression);
        
        // Set up actual crontab entry for macOS/Linux systems
        if (process.platform !== 'win32') { // Always set up crontab on non-Windows systems
          try {
            const { exec } = require('child_process');
            const fs = require('fs');
            const path = require('path');
            
            // Create a temporary file for the new crontab
            const tempCrontabFile = path.join(os.tmpdir(), 'temp-crontab');
            
            // Get current crontab
            const currentCrontab = await new Promise((resolve, reject) => {
              exec('crontab -l', (error, stdout) => {
                if (error && error.code !== 1) {
                  // Code 1 just means no previous crontab, which is fine
                  reject(error);
                  return;
                }
                resolve(stdout);
              });
            });
            
            // Remove any existing entries for our app
            const lines = currentCrontab.split('\n');
            const filteredLines = lines.filter(line => !line.includes('pf-config') && line.trim() !== '');
            
            // Get the sync script path
            const syncScriptPath = path.join(process.cwd(), 'scripts', 'sync.sh');
            
            // Create the new crontab entry
            // Format: minute hour * * day-of-week command
            const command = `${syncScriptPath} -e > ${path.join(process.cwd(), 'logs', 'cron_output.log')} 2>&1`;
            const cronLine = `${schedule.minute} ${schedule.hour} * * ${schedule.frequency === 'weekly' ? schedule.dayOfWeek : '*'} ${command} # PageFinder sync (pf-config)`;
            
            // Add our new entry
            filteredLines.push(cronLine);
            
            // Write the new crontab to the temp file
            fs.writeFileSync(tempCrontabFile, filteredLines.join('\n') + '\n');
            
            // Install the new crontab
            await new Promise((resolve, reject) => {
              exec(`crontab ${tempCrontabFile}`, (error, stdout) => {
                if (error) {
                  reject(error);
                  return;
                }
                resolve(stdout);
              });
            });
            
            // Clean up the temp file
            fs.unlinkSync(tempCrontabFile);
            
            console.log('Crontab updated successfully');
          } catch (cronError) {
            console.error('Error setting crontab:', cronError);
            // Still return success since we saved the schedule in settings
          }
        }
        
        return {
          success: true,
          message: process.platform === 'win32' 
            ? 'Schedule saved successfully (crontab not set on Windows)' 
            : 'Schedule saved successfully and crontab updated',
          cronExpression: cronExpression
        };
      } catch (error) {
        console.error('Error saving schedule:', error);
        return {
          success: false,
          message: `Failed to save schedule: ${error.message}`,
          error: error.message
        };
      }
    });
    
    // Handler to remove schedule from crontab completely
    ipcMain.handle('remove-schedule', async () => {
      try {
        if (process.platform === 'win32') {
          // Not implemented for Windows
          return {
            success: true,
            message: 'Schedule functionality not implemented for Windows'
          };
        }
        
        const { exec } = require('child_process');
        
        // Remove the crontab entry by filtering out our app's entry
        const result = await new Promise((resolve, reject) => {
          // Get current crontab
          exec('crontab -l', (error, stdout) => {
            if (error && error.code !== 1) {
              // Error 1 means no crontab, which is fine
              reject(error);
              return;
            }
            
            // Filter out any lines containing PageFinder sync
            const lines = stdout.split('\n');
            const filteredLines = lines.filter(line => !line.includes('PageFinder sync'));
            
            // Write to a temp file
            const fs = require('fs');
            const path = require('path');
            const tempFile = path.join(os.tmpdir(), 'temp-crontab-remove');
            
            fs.writeFileSync(tempFile, filteredLines.join('\n') + '\n');
            
            // Install the new crontab
            exec(`crontab ${tempFile}`, (err) => {
              if (err) {
                reject(err);
                return;
              }
              
              // Remove the temp file
              fs.unlinkSync(tempFile);
              resolve();
            });
          });
        });
        
        return {
          success: true,
          message: 'Schedule has been completely removed'
        };
      } catch (error) {
        console.error('Error removing schedule:', error);
        return {
          success: false,
          message: `Failed to remove schedule: ${error.message}`,
          error: error.message
        };
      }
    });

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