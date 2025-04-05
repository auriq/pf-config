/**
 * Log and Schedule Manager Module
 * Handles log viewing and schedule management
 */

const { ipcRenderer } = require("electron");

class LogScheduleManager {
  /**
   * Initialize the log and schedule manager
   * @param {Object} controller - Reference to the main UIController
   */
  constructor(controller) {
    this.controller = controller;
    
    // Set up event listeners for log operations
    this.setupEventListeners();
    
    // Max log size in bytes (2MB)
    this.MAX_LOG_SIZE = 2 * 1024 * 1024;
  }
  
  /**
   * Set up event listeners for IPC communication
   */
  setupEventListeners() {
    // Listen for sync log content
    ipcRenderer.on("sync-log-content", (event, result) => {
      if (result.success) {
        this.displaySyncLog(result.content);
      } else {
        this.displaySyncLogError(result.error);
      }
    });
  }

  /**
   * Update schedule options based on selected frequency
   */
  updateScheduleOptions() {
    const {
      scheduleFrequencySelect,
      dailyOptions,
      weeklyOptions
    } = this.controller;
    
    if (!scheduleFrequencySelect) return;
    
    const frequency = scheduleFrequencySelect.value;
    
    // Hide all frequency-specific options first
    if (dailyOptions) dailyOptions.style.display = 'none';
    if (weeklyOptions) weeklyOptions.style.display = 'none';
    
    // Show options based on selected frequency
    switch (frequency) {
      case 'daily':
        if (dailyOptions) dailyOptions.style.display = 'block';
        break;
      case 'weekly':
        if (dailyOptions) dailyOptions.style.display = 'block';
        if (weeklyOptions) weeklyOptions.style.display = 'block';
        break;
    }
  }

  /**
   * Load and display the current schedule
   */
  async loadCurrentSchedule() {
    try {
      const {
        scheduleFrequencySelect,
        scheduleHourSelect,
        scheduleMinuteSelect,
        scheduleDayOfWeekSelect,
        scheduleDetailsElement
      } = this.controller;
      
      // Get the current schedule from the main process
      const result = await ipcRenderer.invoke('get-current-schedule');
      
      if (result.success && result.schedule) {
        // Update UI with the current schedule
        if (scheduleFrequencySelect) {
          scheduleFrequencySelect.value = result.schedule.frequency;
        }
        
        // Set time values
        if (result.schedule.hour !== undefined && scheduleHourSelect) {
          scheduleHourSelect.value = result.schedule.hour.toString();
        }
        
        if (result.schedule.minute !== undefined && scheduleMinuteSelect) {
          scheduleMinuteSelect.value = result.schedule.minute.toString();
        }
        
        // Set frequency-specific values
        if (result.schedule.frequency === 'weekly' && result.schedule.dayOfWeek !== null && scheduleDayOfWeekSelect) {
          scheduleDayOfWeekSelect.value = result.schedule.dayOfWeek.toString();
        }
        
        // Update the display of options based on frequency
        this.updateScheduleOptions();
        
        // Show schedule details
        const detailsOutput = this.formatScheduleDetails(result.schedule);
        
        if (scheduleDetailsElement) {
          scheduleDetailsElement.textContent = detailsOutput;
        }
      } else {
        if (scheduleDetailsElement) {
          scheduleDetailsElement.textContent = "No schedule has been set up yet.";
        }
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
      
      const {
        scheduleDetailsElement
      } = this.controller;
      
      if (scheduleDetailsElement) {
        scheduleDetailsElement.textContent = "Failed to load schedule due to an error.";
      }
    }
  }

  /**
   * Format schedule details for display
   * @param {Object} schedule - The schedule object
   * @returns {string} - Formatted schedule details
   */
  formatScheduleDetails(schedule) {
    let detailsOutput = "Current Schedule:\n\n";
    detailsOutput += `Status: ${schedule.enabled ? 'Enabled' : 'Disabled'}\n`;
    detailsOutput += `Frequency: ${schedule.frequency.charAt(0).toUpperCase() + schedule.frequency.slice(1)}\n`;
    
    // Format time
    const hour12 = schedule.hour % 12 || 12;
    const ampm = schedule.hour < 12 ? 'AM' : 'PM';
    const minute = schedule.minute.toString().padStart(2, '0');
    detailsOutput += `Time: ${hour12}:${minute} ${ampm}\n`;
    
    // Add frequency-specific details
    if (schedule.frequency === 'weekly' && schedule.dayOfWeek !== null) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      detailsOutput += `Day of Week: ${days[schedule.dayOfWeek]}\n`;
    }
    
    // Add cron expression if available
    if (schedule.cronExpression) {
      detailsOutput += `\nCron Expression: ${schedule.cronExpression}\n`;
      detailsOutput += `(This is the schedule format used by the system's task scheduler)\n\n`;
    }
    
    return detailsOutput;
  }

  /**
   * Save the schedule
   */
  async saveSchedule() {
    try {
      const {
        scheduleFrequencySelect,
        scheduleHourSelect,
        scheduleMinuteSelect,
        scheduleDayOfWeekSelect,
        saveScheduleButton,
        scheduleDetailsElement
      } = this.controller;
      
      if (saveScheduleButton) {
        saveScheduleButton.disabled = true;
      }
      
      // Set the context for schedule operations
      this.controller.currentProvider = 'schedule';
      
      // Show loading indicator by calling directly on the controller
      this.controller.showLoading("Saving schedule...");
      
      // Build schedule object - always enabled
      const schedule = {
        enabled: true, // Always enabled now, ignoring the checkbox that was removed
        frequency: scheduleFrequencySelect ? scheduleFrequencySelect.value : 'daily',
        hour: scheduleHourSelect ? parseInt(scheduleHourSelect.value) : 0,
        minute: scheduleMinuteSelect ? parseInt(scheduleMinuteSelect.value) : 0
      };
      
      // Add frequency-specific values
      if (schedule.frequency === 'weekly') {
        schedule.dayOfWeek = scheduleDayOfWeekSelect ? parseInt(scheduleDayOfWeekSelect.value) : 0;
      }
      
      // Save the schedule
      const result = await ipcRenderer.invoke('save-schedule', schedule);
      
      // Hide loading indicator and reset currentProvider
      this.controller.hideLoading();
      this.controller.currentProvider = null;
      
      if (saveScheduleButton) {
        saveScheduleButton.disabled = false;
      }
      
      if (result.success) {
        // Update schedule details
        if (scheduleDetailsElement) {
          let detailsOutput = this.formatScheduleDetails(schedule);
          
          // Add cron expression if available
          if (result.cronExpression) {
            detailsOutput += `\nCron Expression: ${result.cronExpression}\n`;
            detailsOutput += `(This is the schedule format used by the system's task scheduler)\n\n`;
          }
          
          detailsOutput += "The sync script will run automatically according to this schedule.\n";
          detailsOutput += "You can also run it manually at any time by executing the script directly.\n";
          detailsOutput += "Logs will be saved to the 'logs' directory.";
          
          scheduleDetailsElement.textContent = detailsOutput;
        }
        
        // Verify that the schedule was set correctly
        setTimeout(async () => {
          // Get the current schedule from the system
          const verifyResult = await ipcRenderer.invoke('get-current-schedule');
          
          if (verifyResult.success && verifyResult.schedule) {
            // Add verification details to the output
            let verificationOutput = scheduleDetailsElement.textContent;
            verificationOutput += "\n\n===== VERIFICATION RESULTS =====\n";
            verificationOutput += "Schedule was successfully set in the system's crontab.\n";
            verificationOutput += `Verified cron expression: ${verifyResult.schedule.cronExpression}\n`;
            
            if (scheduleDetailsElement) {
              scheduleDetailsElement.textContent = verificationOutput;
            }
          } else {
            // Add verification failure details
            let verificationOutput = scheduleDetailsElement.textContent;
            verificationOutput += "\n\n===== VERIFICATION RESULTS =====\n";
            verificationOutput += "WARNING: Could not verify if the schedule was set correctly.\n";
            verificationOutput += `Reason: ${verifyResult.message || "Unknown error"}\n`;
            verificationOutput += "The script was generated but the schedule may not be active.";
            
            if (scheduleDetailsElement) {
              scheduleDetailsElement.textContent = verificationOutput;
            }
          }
        }, 1000); // Wait a second to ensure crontab has been updated
      } else {
        if (scheduleDetailsElement) {
          scheduleDetailsElement.textContent = "Failed to generate sync script: " + result.error;
        }
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      
      const {
        scheduleDetailsElement,
        saveScheduleButton
      } = this.controller;
      
      if (saveScheduleButton) {
        saveScheduleButton.disabled = false;
      }
      
      // Reset the currentProvider and hide the loading indicator
      this.controller.currentProvider = null;
      this.controller.hideLoading();
      
      if (scheduleDetailsElement) {
        scheduleDetailsElement.textContent = "Failed to save schedule: " + error.message;
      }
    }
  }

  /**
   * Check the sync log file
   */
  async checkSyncLog() {
    try {
      const { logStatusElement } = this.controller;
      
      if (logStatusElement) {
        logStatusElement.textContent = "Loading sync log...";
        logStatusElement.className = "status-message";
      }
      
      // Set the context for log operations
      this.controller.currentProvider = 'logs';
      
      // Call showLoading directly on the controller
      this.controller.showLoading("Loading sync log...");
      
      // Request the log content from the main process
      ipcRenderer.send("get-sync-log");
    } catch (error) {
      console.error('Error checking sync log:', error);
      
      const { logStatusElement } = this.controller;
      
      if (logStatusElement) {
        logStatusElement.textContent = `Error: ${error.message}`;
        logStatusElement.className = "status-message error";
      }
      
      // Reset the currentProvider and hide the loading indicator
      this.controller.currentProvider = null;
      this.controller.hideLoading();
    }
  }

  /**
   * Display the sync log content
   * @param {string} content - The log content
   */
  displaySyncLog(content) {
    const { syncLogDetailsElement, logStatusElement } = this.controller;
    
    // Hide loading indicator and reset currentProvider
    this.controller.hideLoading();
    this.controller.currentProvider = null;
    
    if (syncLogDetailsElement) {
      if (content && content.trim()) {
        // Sanitize the log content to remove any sensitive information
        const sanitizedContent = this.sanitizeLogContent(content);
        syncLogDetailsElement.textContent = sanitizedContent;
      } else {
        syncLogDetailsElement.textContent = "Log file is empty.";
      }
    }
    
    if (logStatusElement) {
      logStatusElement.textContent = "Sync log loaded successfully.";
      logStatusElement.className = "status-message success";
    }
  }
  
  /**
   * Sanitize log content to remove any sensitive information like tokens
   * @param {string} content - The log content to sanitize
   * @returns {string} - The sanitized log content
   */
  sanitizeLogContent(content) {
    if (!content) return '';
    
    // Patterns to detect sensitive information
    const sensitivePatterns = [
      // OAuth tokens
      { pattern: /(ya29\.[0-9A-Za-z\-_]+)/g, replacement: "[OAUTH_TOKEN_REDACTED]" },
      // Bearer tokens
      { pattern: /(Bearer\s+[0-9A-Za-z\-_\.]+)/gi, replacement: "Bearer [TOKEN_REDACTED]" },
      // Access and refresh tokens
      { pattern: /(access_token|refresh_token|id_token)["']?\s*[:=]\s*["']([^"']+)["']/gi, replacement: "$1=\"[TOKEN_REDACTED]\"" },
      // Common API key formats
      { pattern: /(api[_-]?key|apikey|key|token)["']?\s*[:=]\s*["']([^"']{8,})["']/gi, replacement: "$1=\"[API_KEY_REDACTED]\"" },
      // JWT tokens (common format: xxx.yyy.zzz)
      { pattern: /eyJ[a-zA-Z0-9_-]{5,}\.[a-zA-Z0-9_-]{5,}\.[a-zA-Z0-9_-]{5,}/g, replacement: "[JWT_TOKEN_REDACTED]" },
      // Any token-like parameter in URLs
      { pattern: /([?&](?:token|access_token|auth)=)([^&\s]{8,})/g, replacement: "$1[TOKEN_REDACTED]" },
      // Common OAuth response patterns
      { pattern: /"token_type"\s*:\s*"[^"]+"\s*,\s*"access_token"\s*:\s*"[^"]+"/g, replacement: "\"token_type\":\"Bearer\",\"access_token\":\"[TOKEN_REDACTED]\"" },
      // General long random strings that could be tokens (40+ chars)
      { pattern: /([a-zA-Z0-9_\-\.=]{40,})/g, replacement: "[POSSIBLE_TOKEN_REDACTED]" }
    ];
    
    // Apply all sanitization patterns
    let sanitized = content;
    for (const { pattern, replacement } of sensitivePatterns) {
      sanitized = sanitized.replace(pattern, replacement);
    }
    
    return sanitized;
  }

  /**
   * Display an error when loading the sync log
   * @param {string} error - The error message
   */
  displaySyncLogError(error) {
    const { syncLogDetailsElement, logStatusElement } = this.controller;
    
    // Hide loading indicator and reset currentProvider
    this.controller.hideLoading();
    this.controller.currentProvider = null;
    
    if (syncLogDetailsElement) {
      syncLogDetailsElement.textContent = "Error loading log file: " + error;
    }
    
    if (logStatusElement) {
      logStatusElement.textContent = `Error loading log: ${error}`;
      logStatusElement.className = "status-message error";
    }
  }
  
  /**
   * Clear the current schedule
   */
  async clearSchedule() {
    try {
      const {
        scheduleDetailsElement
      } = this.controller;
      
      // Set the context for schedule operations
      this.controller.currentProvider = 'schedule';
      
      // Show loading indicator
      this.controller.showLoading("Clearing schedule...");
      
      // Call the main process to completely remove the schedule from crontab
      const result = await ipcRenderer.invoke('remove-schedule');
      
      // Hide loading indicator and reset currentProvider
      this.controller.hideLoading();
      this.controller.currentProvider = null;
      
      if (result.success) {
        if (scheduleDetailsElement) {
          scheduleDetailsElement.textContent = "No active schedule. Synchronization will need to be run manually.";
        }
      } else {
        if (scheduleDetailsElement) {
          scheduleDetailsElement.textContent = `Failed to clear schedule: ${result.message}`;
        }
      }
    } catch (error) {
      console.error('Error clearing schedule:', error);
      
      const {
        scheduleDetailsElement
      } = this.controller;
      
      // Reset the currentProvider and hide loading
      this.controller.currentProvider = null;
      this.controller.hideLoading();
      
      if (scheduleDetailsElement) {
        scheduleDetailsElement.textContent = `Error clearing schedule: ${error.message}`;
      }
    }
  }

  // Removed execution log methods as requested
}

// Export the module
module.exports = LogScheduleManager;