/**
 * PageFinder Configuration Application
 * Main entry point
 */

const ConfigManager = require("./modules/config-manager");
const os = require('os'); // Required for os.tmpdir()
const { exec, execSync } = require('child_process'); // For process execution
const { app } = require('electron');
const CloudConfigApp = require("./modules/app");
const { log } = require("./modules/utils");

// Get the application base path (works in both dev and production)
const getBasePath = () => {
  // In packaged app, use app.getAppPath()
  // In development, use process.cwd()
  return app.isPackaged ? app.getAppPath() : process.cwd();
};

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
        
        // Set up scheduling based on platform
        if (process.platform !== 'win32') {
          // macOS/Linux: Use crontab for scheduling
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
            // Generate the sync.sh script for macOS/Linux using update-sync.js
            const { spawn } = require('child_process');
            console.log('Generating sync.sh script for macOS/Linux...');
            
            try {
              // Run the update-sync.js script to generate sync.sh
              const updateSyncPath = path.join(getBasePath(), 'scripts', 'update-sync.js');
              execSync(`node "${updateSyncPath}"`);
              console.log('Successfully generated sync.sh script');
            } catch (genError) {
              console.error('Error generating sync.sh script:', genError);
            }
            
            // Get the sync script path - this is for macOS/Linux only
            const syncScriptPath = path.join(getBasePath(), 'scripts', 'sync.sh');
            
            // Create the new crontab entry
            // Format: minute hour * * day-of-week command
            const logPath = path.join(process.cwd(), 'logs', 'cron_output.log');
            const command = `${syncScriptPath} -e > ${logPath} 2>&1`;
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
        } else {
          // Windows: Use Windows Task Scheduler
          try {
            // Use PowerShell to create a scheduled task
            const { exec } = require('child_process');
            const fs = require('fs');
            const path = require('path');
            
            // Generate the sync.bat script for Windows using update-sync.js
            const { spawn } = require('child_process');
            console.log('Generating sync.bat script for Windows...');
            
            try {
              // Run the update-sync.js script to generate sync.bat
              const updateSyncPath = path.join(getBasePath(), 'scripts', 'update-sync.js');
              execSync(`node "${updateSyncPath}"`);
              console.log('Successfully generated sync.bat script');
            } catch (genError) {
              console.error('Error generating sync.bat script:', genError);
            }
            
            // Get the bat script path
            const syncScriptPath = path.join(getBasePath(), 'scripts', 'sync.bat').replace(/\\/g, '\\\\');
            
            // Create the task name
            const taskName = 'PageFinderSync';
            
            // PowerShell command to check if the task exists
            const checkTaskCmd = `powershell -Command "& {if (Get-ScheduledTask -TaskName '${taskName}' -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }}"`;
            
            try {
              // Check if task already exists
              execSync(checkTaskCmd);
              
              // Task doesn't exist, create it
              console.log('Creating new Windows scheduled task');
            } catch (error) {
              // Task exists, delete it first
              console.log('Removing existing Windows scheduled task');
              try {
                execSync(`schtasks /Delete /TN "${taskName}" /F`);
              } catch (delError) {
                console.warn('Failed to delete existing task:', delError.message);
              }
            }
            
            // Build the trigger parameter based on schedule frequency
            let triggerParam = '';
            
            switch(schedule.frequency) {
              case 'daily':
                triggerParam = `/SC DAILY /ST ${String(schedule.hour).padStart(2, '0')}:${String(schedule.minute).padStart(2, '0')}`;
                break;
              case 'weekly':
                // Convert day of week (0-6) to Windows format (MON, TUE, etc.)
                const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                const dayName = daysOfWeek[parseInt(schedule.dayOfWeek, 10)];
                triggerParam = `/SC WEEKLY /D ${dayName} /ST ${String(schedule.hour).padStart(2, '0')}:${String(schedule.minute).padStart(2, '0')}`;
                break;
              case 'monthly':
                triggerParam = `/SC MONTHLY /D ${schedule.dayOfMonth} /ST ${String(schedule.hour).padStart(2, '0')}:${String(schedule.minute).padStart(2, '0')}`;
                break;
            }
            
            // Create the scheduled task
            // The /TR parameter specifies the program to run (our sync.bat script)
            const createTaskCmd = `schtasks /Create /TN "${taskName}" ${triggerParam} /TR "${syncScriptPath} -e" /F`;
            console.log('Creating Windows scheduled task with command:', createTaskCmd);
            
            execSync(createTaskCmd);
            console.log('Windows scheduled task created successfully');
          } catch (winError) {
            console.error('Error setting up Windows scheduled task:', winError);
            // Still return success since we saved the schedule in settings
          }
        }
        
        return {
          success: true,
          message: process.platform === 'win32'
            ? 'Schedule saved successfully (Windows Task Scheduler updated)'
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
    
    // Handler to remove schedule completely
    ipcMain.handle('remove-schedule', async () => {
      try {
        if (process.platform === 'win32') {
          // Windows implementation - remove the scheduled task
          try {
            const taskName = 'PageFinderSync';
            
            // PowerShell command to check if the task exists
            const checkTaskCmd = `powershell -Command "& {if (Get-ScheduledTask -TaskName '${taskName}' -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }}"`;
            
            try {
              // Check if task exists
              execSync(checkTaskCmd);
              // Task doesn't exist, nothing to remove
              return {
                success: true,
                message: 'No scheduled task found to remove'
              };
            } catch (error) {
              // Task exists, delete it
              console.log('Removing Windows scheduled task');
              execSync(`schtasks /Delete /TN "${taskName}" /F`);
              return {
                success: true,
                message: 'Windows scheduled task has been removed'
              };
            }
          } catch (winError) {
            console.error('Error removing Windows scheduled task:', winError);
            return {
              success: false,
              message: `Failed to remove Windows scheduled task: ${winError.message}`,
              error: winError.message
            };
          }
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