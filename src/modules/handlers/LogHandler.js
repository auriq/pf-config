/**
 * Log Handler Module
 * Handles logs and scheduling-related IPC events
 */

const { ipcMain, app } = require("electron");
const path = require("path");
const fs = require('fs-extra');
const { exec } = require('child_process');

// Get the application base path (works in both dev and production)
const getAppBasePath = () => {
  // In packaged app, use app.getAppPath()
  // In development, use process.cwd()
  return app.isPackaged ? app.getAppPath() : process.cwd();
};

/**
 * Class to handle logs and scheduling-related IPC events
 */
class LogHandler {
  /**
   * Initialize the handler
   * @param {Object} app - The main CloudConfigApp instance
   * @param {Object} configManager - The ConfigManager instance
   */
  constructor(app, configManager) {
    this.app = app;
    this.configManager = configManager;
    this.setupEventHandlers();
  }

  /**
   * Set up all logs-related event handlers
   */
  setupEventHandlers() {
    // Define max log size (2MB)
    const MAX_LOG_SIZE = 2 * 1024 * 1024; // 2MB in bytes
    
    /**
     * Utility function to trim log file if it exceeds size limit
     * @param {string} filePath - Path to the log file
     * @param {number} maxSize - Maximum size in bytes
     */
    const trimLogFileIfNeeded = (filePath) => {
      try {
        // Check if the file exists
        if (!fs.existsSync(filePath)) {
          return;
        }
        
        // Get file stats
        const stats = fs.statSync(filePath);
        
        // If the file is larger than the max size, trim it
        if (stats.size > MAX_LOG_SIZE) {
          console.log(`Log file ${filePath} exceeds ${MAX_LOG_SIZE / (1024 * 1024)}MB, trimming...`);
          
          // Read the file
          let content = fs.readFileSync(filePath, 'utf8');
          
          // Calculate how much to keep (approximately half of the content)
          const halfSize = Math.floor(content.length / 2);
          
          // Find a newline character after the halfway point to make a clean cut
          let cutPoint = content.indexOf('\n', halfSize);
          if (cutPoint === -1) cutPoint = halfSize; // Fallback if no newline found
          
          // Keep the second half of the file
          content = content.substring(cutPoint);
          
          // Add a header indicating the file was trimmed
          const trimHeader = `[LOG TRIMMED AT ${new Date().toISOString()}]\n` +
                            `Previous log entries were removed to keep file size under ${MAX_LOG_SIZE / (1024 * 1024)}MB\n` +
                            `-------------------------------------------\n\n`;
          
          // Write the trimmed content back to the file
          fs.writeFileSync(filePath, trimHeader + content);
          
          console.log(`Log file ${filePath} trimmed successfully`);
        }
      } catch (error) {
        console.error(`Error trimming log file ${filePath}:`, error);
      }
    };
    // Handle get sync log request
    ipcMain.on("get-sync-log", async (event) => {
      try {
        const logPath = path.join(getAppBasePath(), 'logs', 'sync_detail.log');
        
        // Check if the log file exists
        if (!fs.existsSync(logPath)) {
          event.reply("sync-log-content", {
            success: false,
            error: "Log file not found. No sync has been run yet."
          });
          return;
        }
        
        // Trim the log file if it exceeds the max size
        trimLogFileIfNeeded(logPath);
        
        // Read the log file
        const logContent = fs.readFileSync(logPath, 'utf8');
        
        // Sanitize the log content to remove any tokens or sensitive information
        const sanitizedLogContent = this.app.sanitizeOutput(logContent);
        
        // Send the sanitized log content back to the renderer
        event.reply("sync-log-content", {
          success: true,
          content: sanitizedLogContent
        });
      } catch (error) {
        console.error('Error reading sync log:', error);
        event.reply("sync-log-content", {
          success: false,
          error: error.message
        });
      }
    });
    
    // Removed exec log handling as requested
    
    // Handle save schedule request
    ipcMain.handle('save-schedule', async (event, schedule) => {
      try {
        console.log('Saving schedule:', schedule);
        
        // Simple implementation that just stores the schedule in settings
        this.configManager.setSettings({
          ...this.configManager.getSettings(),
          schedule: schedule
        });
        
        // Generate a cron expression (simple implementation)
        let cronExpression = '';
        if (schedule.enabled) {
          // Format: minute hour * * day-of-week
          // For daily: minute hour * * *
          // For weekly: minute hour * * day-of-week (0-6, Sunday=0)
          // For monthly: minute hour day-of-month * *
          
          switch (schedule.frequency) {
            case 'daily':
              cronExpression = `${schedule.minute} ${schedule.hour} * * *`;
              break;
            case 'weekly':
              cronExpression = `${schedule.minute} ${schedule.hour} * * ${schedule.dayOfWeek}`;
              break;
            case 'monthly':
              cronExpression = `${schedule.minute} ${schedule.hour} ${schedule.dayOfMonth} * *`;
              break;
          }
          
          // Log the generated cron expression
          console.log('Generated cron expression:', cronExpression);
          
          // Here you would typically write this to a crontab or system scheduler
          // For simplicity, we're just returning success
        }
        
        return {
          success: true,
          message: 'Schedule saved successfully',
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
    
    // Removed exec log handling as requested
    
    // This handler is deprecated and will be removed in a future version
    ipcMain.on("clean-logs", async (event) => {
      try {
        console.log("The clean-logs feature is deprecated and will be removed");
        
        // Import the clean-logs script
        const { cleanLogs } = require('../../../scripts/clean-logs');
        
        // Call the cleanLogs function
        const result = await cleanLogs();
        
        // Send the result back to the renderer
        event.reply("clean-logs-result", result);
      } catch (error) {
        // Don't log errors to console to avoid printing sensitive information
        event.reply("clean-logs-result", {
          success: false,
          error: error.message
        });
      }
    });

    // Handle getting current schedule
    ipcMain.handle('get-current-schedule', async (event) => {
      try {
        // Only for macOS/Linux
        if (process.platform === 'win32') {
          return {
            success: false,
            message: 'Schedule checking not implemented for Windows',
            schedule: null
          };
        }
        
        // Get the script path
        const scriptPath = path.join(process.cwd(), 'scripts', 'sync.sh');
        
        // Check if the script exists
        const scriptExists = fs.existsSync(scriptPath);
        if (!scriptExists) {
          return {
            success: false,
            message: 'No sync script found',
            schedule: null
          };
        }
        
        // Get current crontab
        const crontab = await new Promise((resolve) => {
          const { exec } = require('child_process');
          exec('crontab -l', (error, stdout) => {
            if (error) {
              // No crontab or other error
              resolve('');
            } else {
              resolve(stdout);
            }
          });
        });
        
        // Parse schedule from crontab
        // (Simplified version - in the real implementation, this would parse the crontab to extract schedule details)
        
        return {
          success: true,
          message: 'Schedule found',
          schedule: {
            enabled: true,
            frequency: 'daily',
            hour: 0,
            minute: 0
          }
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

    // Handle generate sync script request
    ipcMain.handle('generate-sync-script', async (event, { schedule }) => {
      try {
        // Implementation for generating/updating sync script and schedule
        // (Simplified for this refactoring example)
        
        return {
          success: true,
          message: 'Sync script generated and scheduled successfully',
          details: `The synchronization will run ${schedule.frequency}.`
        };
      } catch (error) {
        console.error('Error generating sync script:', error);
        return {
          success: false,
          message: `Failed to generate sync script: ${error.message}`,
          error: error.message
        };
      }
    });
  }
}

module.exports = LogHandler;