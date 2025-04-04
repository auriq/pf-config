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
  }

  /**
   * Update schedule options based on selected frequency
   */
  updateScheduleOptions() {
    const { 
      scheduleFrequencySelect,
      dailyOptions,
      weeklyOptions,
      monthlyOptions
    } = this.controller;
    
    if (!scheduleFrequencySelect) return;
    
    const frequency = scheduleFrequencySelect.value;
    
    // Hide all frequency-specific options first
    if (dailyOptions) dailyOptions.style.display = 'none';
    if (weeklyOptions) weeklyOptions.style.display = 'none';
    if (monthlyOptions) monthlyOptions.style.display = 'none';
    
    // Show options based on selected frequency
    switch (frequency) {
      case 'daily':
        if (dailyOptions) dailyOptions.style.display = 'block';
        break;
      case 'weekly':
        if (dailyOptions) dailyOptions.style.display = 'block';
        if (weeklyOptions) weeklyOptions.style.display = 'block';
        break;
      case 'monthly':
        if (dailyOptions) dailyOptions.style.display = 'block';
        if (monthlyOptions) monthlyOptions.style.display = 'block';
        break;
    }
  }

  /**
   * Load and display the current schedule
   */
  async loadCurrentSchedule() {
    try {
      const {
        scheduleStatusElement,
        scheduleEnabledCheckbox,
        scheduleFrequencySelect,
        scheduleHourSelect,
        scheduleMinuteSelect,
        scheduleDayOfWeekSelect,
        scheduleDayOfMonthSelect,
        scheduleDetailsElement,
        scheduleStatusIcon
      } = this.controller;
      
      if (scheduleStatusElement) {
        scheduleStatusElement.textContent = "Loading current schedule...";
        scheduleStatusElement.className = "status-message";
      }
      
      // Get the current schedule from the main process
      const result = await ipcRenderer.invoke('get-current-schedule');
      
      if (result.success && result.schedule) {
        // Update UI with the current schedule
        if (scheduleEnabledCheckbox) {
          scheduleEnabledCheckbox.checked = result.schedule.enabled;
        }
        
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
        } else if (result.schedule.frequency === 'monthly' && result.schedule.dayOfMonth !== null && scheduleDayOfMonthSelect) {
          scheduleDayOfMonthSelect.value = result.schedule.dayOfMonth.toString();
        }
        
        // Update the display of options based on frequency
        this.updateScheduleOptions();
        
        // Show schedule details
        const detailsOutput = this.formatScheduleDetails(result.schedule);
        
        if (scheduleDetailsElement) {
          scheduleDetailsElement.textContent = detailsOutput;
        }
        
        if (scheduleStatusElement) {
          scheduleStatusElement.textContent = "Schedule loaded successfully.";
          scheduleStatusElement.className = "status-message success";
        }
        
        if (scheduleStatusIcon) {
          scheduleStatusIcon.innerHTML = "✓";
          scheduleStatusIcon.className = "status-icon success";
        }
      } else {
        if (scheduleStatusElement) {
          scheduleStatusElement.textContent = result.message || "Failed to load schedule.";
          scheduleStatusElement.className = "status-message error";
        }
        
        if (scheduleStatusIcon) {
          scheduleStatusIcon.innerHTML = "✗";
          scheduleStatusIcon.className = "status-icon error";
        }
        
        if (scheduleDetailsElement) {
          scheduleDetailsElement.textContent = "No schedule has been set up yet.";
        }
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
      
      const {
        scheduleStatusElement,
        scheduleStatusIcon,
        scheduleDetailsElement
      } = this.controller;
      
      if (scheduleStatusElement) {
        scheduleStatusElement.textContent = `Error: ${error.message}`;
        scheduleStatusElement.className = "status-message error";
      }
      
      if (scheduleStatusIcon) {
        scheduleStatusIcon.innerHTML = "✗";
        scheduleStatusIcon.className = "status-icon error";
      }
      
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
    } else if (schedule.frequency === 'monthly' && schedule.dayOfMonth !== null) {
      detailsOutput += `Day of Month: ${schedule.dayOfMonth}\n`;
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
        scheduleStatusElement,
        scheduleEnabledCheckbox,
        scheduleFrequencySelect,
        scheduleHourSelect,
        scheduleMinuteSelect,
        scheduleDayOfWeekSelect,
        scheduleDayOfMonthSelect,
        saveScheduleButton,
        scheduleDetailsElement,
        scheduleStatusIcon
      } = this.controller;
      
      if (scheduleStatusElement) {
        scheduleStatusElement.textContent = "Saving schedule...";
        scheduleStatusElement.className = "status-message";
      }
      
      if (saveScheduleButton) {
        saveScheduleButton.disabled = true;
      }
      
      // Set the context for schedule operations
      this.controller.currentProvider = 'schedule';
      
      // Show loading indicator by calling directly on the controller
      this.controller.showLoading("Saving schedule...");
      
      // Add loading icon
      if (scheduleStatusIcon) {
        scheduleStatusIcon.innerHTML = "⟳";
        scheduleStatusIcon.className = "status-icon loading";
      }
      
      // Build schedule object
      const schedule = {
        enabled: scheduleEnabledCheckbox ? scheduleEnabledCheckbox.checked : false,
        frequency: scheduleFrequencySelect ? scheduleFrequencySelect.value : 'daily',
        hour: scheduleHourSelect ? parseInt(scheduleHourSelect.value) : 0,
        minute: scheduleMinuteSelect ? parseInt(scheduleMinuteSelect.value) : 0
      };
      
      // Add frequency-specific values
      if (schedule.frequency === 'weekly') {
        schedule.dayOfWeek = scheduleDayOfWeekSelect ? parseInt(scheduleDayOfWeekSelect.value) : 0;
      } else if (schedule.frequency === 'monthly') {
        schedule.dayOfMonth = scheduleDayOfMonthSelect ? parseInt(scheduleDayOfMonthSelect.value) : 1;
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
        if (scheduleStatusElement) {
          scheduleStatusElement.textContent = "Schedule saved successfully.";
          scheduleStatusElement.className = "status-message success";
        }
        
        if (scheduleStatusIcon) {
          scheduleStatusIcon.innerHTML = "✓";
          scheduleStatusIcon.className = "status-icon success";
        }
        
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
          if (scheduleStatusElement) {
            scheduleStatusElement.textContent = "Verifying schedule...";
          }
          
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
            
            if (scheduleStatusElement) {
              scheduleStatusElement.textContent = "Schedule verified and set successfully!";
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
            
            if (scheduleStatusElement) {
              scheduleStatusElement.textContent = "Schedule may not be set correctly. Please check verification results.";
            }
          }
        }, 1000); // Wait a second to ensure crontab has been updated
      } else {
        if (scheduleStatusElement) {
          scheduleStatusElement.textContent = result.message;
          scheduleStatusElement.className = "status-message error";
        }
        
        if (scheduleStatusIcon) {
          scheduleStatusIcon.innerHTML = "✗";
          scheduleStatusIcon.className = "status-icon error";
        }
        
        if (scheduleDetailsElement) {
          scheduleDetailsElement.textContent = "Failed to generate sync script: " + result.error;
        }
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      
      const {
        scheduleStatusElement,
        scheduleStatusIcon,
        scheduleDetailsElement,
        saveScheduleButton
      } = this.controller;
      
      if (scheduleStatusElement) {
        scheduleStatusElement.textContent = `Error: ${error.message}`;
        scheduleStatusElement.className = "status-message error";
      }
      
      if (saveScheduleButton) {
        saveScheduleButton.disabled = false;
      }
      
      // Reset the currentProvider and hide the loading indicator
      this.controller.currentProvider = null;
      this.controller.hideLoading();
      
      if (scheduleStatusIcon) {
        scheduleStatusIcon.innerHTML = "✗";
        scheduleStatusIcon.className = "status-icon error";
      }
      
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
        syncLogDetailsElement.textContent = content;
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
   * Clean the logs
   */
  async cleanLogs() {
    try {
      const { logStatusElement } = this.controller;
      
      if (logStatusElement) {
        logStatusElement.textContent = "Cleaning logs...";
        logStatusElement.className = "status-message";
      }
      
      // Set the context for log operations
      this.controller.currentProvider = 'logs';
      
      // Call showLoading directly on the controller
      this.controller.showLoading("Cleaning logs...");
      
      // Send command to clean logs
      ipcRenderer.send("clean-logs");
    } catch (error) {
      console.error('Error cleaning logs:', error);
      
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
}

// Export the module
module.exports = LogScheduleManager;