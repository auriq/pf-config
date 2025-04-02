const { ipcRenderer } = require("electron");

/**
 * Cloud Storage Configuration UI Controller
 * Handles all UI interactions and IPC communication
 */
class ConfigUIController {
  constructor() {
    this.initializeElements();
    this.setupEventListeners();
    this.currentProvider = null;
    this.selectedRemote = null;
    this.currentSubfolderRemote = null;
    
    // Show main menu initially
    this.showSection('menu');
    
    // Request initial remotes list (in background)
    this.refreshRemotesList();
  }
  
  /**
   * Show loading indicator with custom message
   * @param {string} message - Message to display
   */
  showLoading(message = "Loading...") {
    const loadingContainer = document.getElementById("loading-container");
    const loadingText = document.getElementById("loading-text");
    
    if (loadingContainer && loadingText) {
      loadingText.textContent = message;
      loadingContainer.classList.add("show");
      // Don't show overlay for local storage operations to allow file dialogs
      if (!this.currentProvider || this.currentProvider !== 'local') {
        document.getElementById("overlay").classList.add("show");
      }
    }
  }
  
  /**
   * Hide loading indicator
   */
  hideLoading() {
    const loadingContainer = document.getElementById("loading-container");
    
    if (loadingContainer) {
      loadingContainer.classList.remove("show");
      // Only remove overlay if no other dialogs are visible and we're not in the middle of a local storage operation
      if (!document.querySelector(".dialog.show") && (!this.currentProvider || this.currentProvider !== 'local')) {
        document.getElementById("overlay").classList.remove("show");
      }
    }
  }
  
  /**
   * Initialize all DOM elements
   */
  initializeElements() {
   // Main menu sections
   this.mainMenuSection = document.getElementById("main-menu");
   this.cloudConfigSection = document.getElementById("cloud-config-section");
   this.pagefinderConfigSection = document.getElementById("pagefinder-config-section");
   this.testConnectionSection = document.getElementById("test-connection-section");
   this.scheduleSection = document.getElementById("schedule-section");
   
   // Menu buttons
   this.cloudConfigButton = document.getElementById("menu-cloud-config");
   this.pagefinderConfigButton = document.getElementById("menu-pagefinder-config");
   this.testConnectionButton = document.getElementById("menu-test-connection");
   this.scheduleButton = document.getElementById("menu-schedule");
   
   // Back to menu buttons
   this.backToMenuButton = document.getElementById("back-to-menu");
   this.backToMenuPFButton = document.getElementById("back-to-menu-pagefinder");
   this.backToMenuTestButton = document.getElementById("back-to-menu-test");
   this.backToMenuScheduleButton = document.getElementById("back-to-menu-schedule");
   
   // Provider buttons
   this.providerButtons = {
     gdrive: document.getElementById("add-gdrive"),
     onedrive: document.getElementById("add-onedrive"),
     box: document.getElementById("add-box"),
     dropbox: document.getElementById("add-dropbox"),
     local: document.getElementById("add-local")
   };
   
   // Action buttons
   this.closeButton = document.getElementById("close");
   this.reloadButton = document.getElementById("reload-remotes");
   
   // Local folder browse button
   this.browseLocalFolderButton = document.getElementById("browse-local-folder");
   
   // UI containers
   this.remoteListContainer = document.getElementById("remote-list");
   this.statusElement = document.getElementById("config-status");
   
   // Dialog elements
   this.overlay = document.getElementById("overlay");
   this.remoteDialog = document.getElementById("remote-dialog");
   this.rcloneSetupDialog = document.getElementById("rclone-setup-dialog");
   this.subfolderDialog = document.getElementById("subfolder-dialog");
   
   // Dialog inputs
   this.remoteNameInput = document.getElementById("remote-name");
   this.rclonePathInput = document.getElementById("rclone-path");
   this.subfolderPathInput = document.getElementById("set-subfolder-path");
    
    // Dialog buttons
    this.confirmRemoteButton = document.getElementById("confirm-remote");
    this.cancelRemoteButton = document.getElementById("cancel-remote");
    this.confirmRclonePathButton = document.getElementById("confirm-rclone-path");
    this.cancelRclonePathButton = document.getElementById("cancel-rclone-path");
    this.useDefaultPathButton = document.getElementById("use-default-path");
    this.confirmSubfolderButton = document.getElementById("confirm-subfolder");
    this.cancelSubfolderButton = document.getElementById("cancel-subfolder");
    
    // Local path group (for local storage)
    this.localPathGroup = document.getElementById("local-path-group");
    
    // PageFinder config elements
    this.pfConfigPathInput = document.getElementById("pf-config-path");
    this.browsePFConfigButton = document.getElementById("browse-pf-config");
    this.validatePFConfigButton = document.getElementById("validate-pf-config");
    this.pfConfigStatusElement = document.getElementById("pf-config-status");
    this.pfConfigStatusIcon = document.getElementById("config-status-icon");
    
    // PageFinder connection elements
    this.pfUsernameInput = document.getElementById("pf-username");
    this.pfBucketInput = document.getElementById("pf-bucket");
    this.pfPrefixInput = document.getElementById("pf-prefix");
    this.checkPFConnectionButton = document.getElementById("check-pf-connection");
    this.pfConnectionStatusElement = document.getElementById("pf-connection-status");
    this.pfConnectionStatusIcon = document.getElementById("connection-status-icon");
    this.pfConnectionDetailsElement = document.getElementById("pf-connection-details");
    this.useLsCommandPfCheckbox = document.getElementById("use-ls-command-pf");
    
    // Test connection elements
    this.runTestConnectionButton = document.getElementById("run-test-connection");
    this.testConnectionStatusElement = document.getElementById("test-connection-status");
    this.testStatusIcon = document.getElementById("test-status-icon");
    this.testConnectionDetailsElement = document.getElementById("test-connection-details");
    
    // Schedule elements
    this.scheduleEnabledCheckbox = document.getElementById("schedule-enabled");
    this.scheduleFrequencySelect = document.getElementById("schedule-frequency");
    this.scheduleHourSelect = document.getElementById("schedule-hour");
    this.scheduleMinuteSelect = document.getElementById("schedule-minute");
    this.scheduleDayOfWeekSelect = document.getElementById("schedule-day-of-week");
    this.scheduleDayOfMonthSelect = document.getElementById("schedule-day-of-month");
    this.saveScheduleButton = document.getElementById("save-schedule");
    this.scheduleStatusElement = document.getElementById("schedule-status");
    this.scheduleStatusIcon = document.getElementById("schedule-status-icon");
    this.scheduleDetailsElement = document.getElementById("schedule-details");
    this.dailyOptions = document.getElementById("daily-options");
    this.weeklyOptions = document.getElementById("weekly-options");
    this.monthlyOptions = document.getElementById("monthly-options");
    
    // Create a map of provider names to rclone provider types
    this.providers = new Map([
      ['gdrive', 'drive'],
      ['onedrive', 'onedrive'],
      ['box', 'box'],
      ['dropbox', 'dropbox'],
      ['local', 'local']
    ]);
  }
  
  /**
   * Set up all event listeners
   */
  setupEventListeners() {
    // Main menu navigation
    this.cloudConfigButton.addEventListener("click", () => this.showSection("cloud"));
    this.pagefinderConfigButton.addEventListener("click", () => this.showSection("pagefinder"));
    this.testConnectionButton.addEventListener("click", () => this.showSection("test"));
    this.scheduleButton.addEventListener("click", () => this.showSection("schedule"));
    
    // Back to menu handlers
    this.backToMenuButton.addEventListener("click", () => this.showSection("menu"));
    this.backToMenuPFButton.addEventListener("click", () => this.showSection("menu"));
    this.backToMenuTestButton.addEventListener("click", () => this.showSection("menu"));
    this.backToMenuScheduleButton.addEventListener("click", () => this.showSection("menu"));
    
    // PageFinder config handlers
    if (this.browsePFConfigButton) {
      this.browsePFConfigButton.addEventListener("click", () => this.browsePFConfig());
    }
    
    if (this.validatePFConfigButton) {
      this.validatePFConfigButton.addEventListener("click", () => this.validatePFConfig());
    }
    
    // Local folder browse button handler
    if (this.browseLocalFolderButton) {
      this.browseLocalFolderButton.addEventListener("click", () => this.browseLocalFolder());
    }
    
    if (this.checkPFConnectionButton) {
      this.checkPFConnectionButton.addEventListener("click", () => this.checkPFConnection());
    }
    
    // Test connection button handler
    if (this.runTestConnectionButton) {
      this.runTestConnectionButton.addEventListener("click", () => this.testConnection());
    }
    
    // Schedule handlers
    if (this.scheduleFrequencySelect) {
      this.scheduleFrequencySelect.addEventListener("change", () => this.updateScheduleOptions());
    }
    
    if (this.saveScheduleButton) {
      this.saveScheduleButton.addEventListener("click", () => this.saveSchedule());
    }
    
    // Set up provider button handlers
    Object.entries(this.providerButtons).forEach(([key, button]) => {
      button.addEventListener("click", () => {
        this.currentProvider = key;
        this.showRemoteDialog(key);
      });
    });
    
    // Rclone setup dialog handlers
    this.useDefaultPathButton.addEventListener("click", () => this.handleDefaultRclonePath());
    this.confirmRclonePathButton.addEventListener("click", () => this.saveRclonePath());
    this.cancelRclonePathButton.addEventListener("click", () => this.hideRcloneSetupDialog());
    
    // Remote dialog handlers
    this.confirmRemoteButton.addEventListener("click", () => this.confirmRemoteCreation());
    this.cancelRemoteButton.addEventListener("click", () => this.hideRemoteDialog());
    
    // Subfolder dialog handlers
    this.confirmSubfolderButton.addEventListener("click", () => this.confirmSubfolderSetting());
    this.cancelSubfolderButton.addEventListener("click", () => this.hideSubfolderDialog());
    
    // Action button handlers
    this.closeButton.addEventListener("click", () => this.closeApplication());
    this.reloadButton.addEventListener("click", () => this.refreshRemotesList());
    
    // IPC event listeners
    this.setupIPCListeners();
  }
  
  /**
   * Set up all IPC event listeners
   */
  setupIPCListeners() {
    ipcRenderer.on('show-rclone-setup', async () => {
      const currentPath = await ipcRenderer.invoke('get-rclone-path');
      this.rclonePathInput.value = currentPath || '/usr/local/bin/rclone';
      this.showRcloneSetupDialog();
    });
    
    ipcRenderer.on("remotes-list", (event, remotes) => this.updateRemotesList(remotes));
    ipcRenderer.on("remote-status", (event, result) => this.displayRemoteStatus(result));
    ipcRenderer.on("delete-status", (event, { success, message }) => this.handleDeleteStatus(success, message));
    ipcRenderer.on("config-status", (event, message) => this.updateConfigStatus(message));
    ipcRenderer.on("subfolder-status", (event, { success, message, remoteName }) => {
      this.statusElement.textContent = message;
      if (success) {
        this.refreshRemotesList();
      }
    });
  }
  
  /**
   * Show a specific section and hide others
   * @param {string} section - The section to show: 'menu', 'cloud', 'pagefinder', 'test', or 'schedule'
   */
  async showSection(section) {
    // Hide all sections first
    this.mainMenuSection.style.display = 'none';
    this.cloudConfigSection.style.display = 'none';
    this.pagefinderConfigSection.style.display = 'none';
    this.testConnectionSection.style.display = 'none';
    this.scheduleSection.style.display = 'none';
    
    // Show the requested section
    switch(section) {
      case 'menu':
        this.mainMenuSection.style.display = 'block';
        break;
      case 'cloud':
        this.cloudConfigSection.style.display = 'block';
        break;
      case 'pagefinder':
        this.pagefinderConfigSection.style.display = 'block';
        // Check if pf.conf exists
        this.checkPFConfigExists();
        break;
      case 'test':
        this.testConnectionSection.style.display = 'block';
        break;
      case 'schedule':
        this.scheduleSection.style.display = 'block';
        // Load current schedule when showing the schedule section
        await this.loadCurrentSchedule();
        break;
      default:
        this.mainMenuSection.style.display = 'block';
    }
  }
  
  /**
   * Load and display the current schedule
   */
  async loadCurrentSchedule() {
    try {
      this.scheduleStatusElement.textContent = "Loading current schedule...";
      this.scheduleStatusElement.className = "status-message";
      
      // Get the current schedule from the main process
      const result = await ipcRenderer.invoke('get-current-schedule');
      
      if (result.success && result.schedule) {
        // Update UI with the current schedule
        this.scheduleEnabledCheckbox.checked = result.schedule.enabled;
        this.scheduleFrequencySelect.value = result.schedule.frequency;
        
        // Set time values
        if (result.schedule.hour !== undefined) {
          this.scheduleHourSelect.value = result.schedule.hour.toString();
        }
        if (result.schedule.minute !== undefined) {
          this.scheduleMinuteSelect.value = result.schedule.minute.toString();
        }
        
        // Set frequency-specific values
        if (result.schedule.frequency === 'weekly' && result.schedule.dayOfWeek !== null) {
          this.scheduleDayOfWeekSelect.value = result.schedule.dayOfWeek.toString();
        } else if (result.schedule.frequency === 'monthly' && result.schedule.dayOfMonth !== null) {
          this.scheduleDayOfMonthSelect.value = result.schedule.dayOfMonth.toString();
        }
        
        // Update the display of options based on frequency
        this.updateScheduleOptions();
        
        // Show schedule details
        let detailsOutput = "Current Schedule:\n\n";
        detailsOutput += `Status: ${result.schedule.enabled ? 'Enabled' : 'Disabled'}\n`;
        detailsOutput += `Frequency: ${result.schedule.frequency.charAt(0).toUpperCase() + result.schedule.frequency.slice(1)}\n`;
        
        // Format time
        const hour12 = result.schedule.hour % 12 || 12;
        const ampm = result.schedule.hour < 12 ? 'AM' : 'PM';
        const minute = result.schedule.minute.toString().padStart(2, '0');
        detailsOutput += `Time: ${hour12}:${minute} ${ampm}\n`;
        
        // Add frequency-specific details
        if (result.schedule.frequency === 'weekly' && result.schedule.dayOfWeek !== null) {
          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          detailsOutput += `Day of Week: ${days[result.schedule.dayOfWeek]}\n`;
        } else if (result.schedule.frequency === 'monthly' && result.schedule.dayOfMonth !== null) {
          detailsOutput += `Day of Month: ${result.schedule.dayOfMonth}\n`;
        }
        
        detailsOutput += `\nCron Expression: ${result.schedule.cronExpression}\n`;
        
        this.scheduleDetailsElement.textContent = detailsOutput;
        this.scheduleStatusElement.textContent = "Existing schedule loaded.";
        this.scheduleStatusElement.className = "status-message success";
      } else {
        // No schedule found or error
        this.scheduleStatusElement.textContent = result.message || "No existing schedule found.";
        this.scheduleDetailsElement.textContent = "No schedule has been set up yet.";
        
        // Set default values
        this.scheduleEnabledCheckbox.checked = false;
        this.scheduleFrequencySelect.value = 'daily';
        this.scheduleHourSelect.value = '0';
        this.scheduleMinuteSelect.value = '0';
        this.updateScheduleOptions();
      }
    } catch (error) {
      console.error('Error loading current schedule:', error);
      this.scheduleStatusElement.textContent = `Error loading schedule: ${error.message}`;
      this.scheduleStatusElement.className = "status-message error";
    }
  }
  
  /**
   * Show the subfolder setting dialog
   * @param {string} remoteName - The remote to set subfolder for
   */
  showSubfolderDialog(remoteName) {
    this.currentSubfolderRemote = remoteName;
    
    // Get existing subfolder if any
    const metadata = this.getRemoteMetadata(remoteName);
    const currentSubfolder = metadata?.subfolder || '';
    
    // Set value in input
    this.subfolderPathInput.value = currentSubfolder;
    
    // Show dialog
    this.overlay.classList.add("show");
    this.subfolderDialog.classList.add("show");
    this.subfolderDialog.querySelector('h3').textContent = `Set Subfolder for ${remoteName}`;
    this.subfolderPathInput.focus();
  }
  
  /**
   * Hide the subfolder dialog
   */
  hideSubfolderDialog() {
    this.overlay.classList.remove("show");
    this.subfolderDialog.classList.remove("show");
    this.currentSubfolderRemote = null;
  }
  
  /**
   * Get metadata for a remote from the current display
   * @param {string} remoteName - Name of the remote
   * @returns {Object|null} - The metadata object or null
   */
  getRemoteMetadata(remoteName) {
    // We can search for metadata in the display elements or ask the main process
    const remoteElements = this.remoteListContainer.querySelectorAll('.remote-item');
    for (const element of remoteElements) {
      const nameElement = element.querySelector('.remote-item-name');
      const nameText = nameElement ? nameElement.childNodes[0].textContent.trim() : '';
      
      if (nameText === remoteName) {
        const subfolderElement = element.querySelector('.remote-subfolder small');
        if (subfolderElement) {
          return { subfolder: subfolderElement.textContent.trim() };
        }
        break;
      }
    }
    return null;
  }
  
  /**
   * Check if the PageFinder config file exists
   */
  async checkPFConfigExists() {
    try {
      const pfConfigExists = await ipcRenderer.invoke('check-pf-config-exists');
      
      if (pfConfigExists) {
        // Update UI to show that the config file exists
        this.pfConfigStatusElement.textContent = "PageFinder config file found. You can check the connection.";
        this.pfConfigStatusElement.className = "status-message success";
        
        // Enable the check connection button
        if (this.checkPFConnectionButton) {
          this.checkPFConnectionButton.disabled = false;
        }
        
        // Add a check mark to the config status icon if it exists
        const configStatusIcon = document.getElementById("config-status-icon");
        if (configStatusIcon) {
          configStatusIcon.innerHTML = "✓";
          configStatusIcon.className = "status-icon success";
        }
      } else {
        // Update UI to show that the config file doesn't exist
        this.pfConfigStatusElement.textContent = "PageFinder config file not found. Please browse for a config file.";
        this.pfConfigStatusElement.className = "status-message";
        
        // Disable the check connection button
        if (this.checkPFConnectionButton) {
          this.checkPFConnectionButton.disabled = true;
        }
      }
    } catch (error) {
      console.error('Error checking if PageFinder config exists:', error);
      this.pfConfigStatusElement.textContent = `Error: ${error.message}`;
      this.pfConfigStatusElement.className = "status-message error";
    }
  }
  
  /**
   * Browse for a PageFinder config file
   */
  async browsePFConfig() {
    try {
      this.pfConfigStatusElement.textContent = "Browsing for config file...";
      this.pfConfigStatusElement.className = "status-message";
      
      const filePath = await ipcRenderer.invoke('browse-pf-config');
      
      if (filePath) {
        this.pfConfigPathInput.value = filePath;
        this.pfConfigStatusElement.textContent = "File selected. Click 'Validate & Save' to continue.";
        
        // Enable the validate button
        if (this.validatePFConfigButton) {
          this.validatePFConfigButton.disabled = false;
        }
      } else {
        this.pfConfigStatusElement.textContent = "No file selected.";
      }
      
      // Check if the config file exists after browsing
      await this.checkPFConfigExists();
    } catch (error) {
      console.error('Error browsing for PageFinder config:', error);
      this.pfConfigStatusElement.textContent = `Error: ${error.message}`;
      this.pfConfigStatusElement.className = "status-message error";
    }
  }
  
  /**
   * Browse for a local folder
   */
  async browseLocalFolder() {
    try {
      this.statusElement.textContent = "Browsing for folder...";
      
      const folderPath = await ipcRenderer.invoke('browse-local-folder');
      
      if (folderPath) {
        // Update the local path input field
        const localPathInput = document.getElementById('local-path');
        if (localPathInput) {
          localPathInput.value = folderPath;
        }
        this.statusElement.textContent = "Folder selected.";
      } else {
        this.statusElement.textContent = "No folder selected.";
      }
    } catch (error) {
      console.error('Error browsing for local folder:', error);
      this.statusElement.textContent = `Error: ${error.message}`;
    }
  }
  
  /**
   * Update schedule options based on selected frequency
   */
  updateScheduleOptions() {
    const frequency = this.scheduleFrequencySelect.value;
    
    // Hide all options first
    this.dailyOptions.style.display = 'none';
    this.weeklyOptions.style.display = 'none';
    this.monthlyOptions.style.display = 'none';
    
    // Show time options for all frequencies
    this.dailyOptions.style.display = 'block';
    
    // Show additional options based on frequency
    if (frequency === 'weekly') {
      this.weeklyOptions.style.display = 'block';
    } else if (frequency === 'monthly') {
      this.monthlyOptions.style.display = 'block';
    }
  }
  
  /**
   * Save schedule and generate sync script
   */
  async saveSchedule() {
    try {
      // Verify that both cloud and PageFinder configs are set up
      const remoteItems = this.remoteListContainer.querySelectorAll('.remote-item');
      if (remoteItems.length === 0) {
        this.scheduleStatusElement.textContent = "No cloud storage configured. Please set up at least one cloud storage first.";
        this.scheduleStatusElement.className = "status-message error";
        return;
      }
      
      // Check if PageFinder config exists (we'll assume it's valid if it exists)
      const pfConfigExists = await ipcRenderer.invoke('check-pf-config-exists');
      if (!pfConfigExists) {
        this.scheduleStatusElement.textContent = "PageFinder configuration not found. Please set up PageFinder first.";
        this.scheduleStatusElement.className = "status-message error";
        return;
      }
      
      // Get schedule settings
      const schedule = {
        enabled: this.scheduleEnabledCheckbox.checked,
        frequency: this.scheduleFrequencySelect.value,
        hour: parseInt(this.scheduleHourSelect.value),
        minute: parseInt(this.scheduleMinuteSelect.value)
      };
      
      // Add frequency-specific options
      if (schedule.frequency === 'weekly') {
        schedule.dayOfWeek = parseInt(this.scheduleDayOfWeekSelect.value);
      } else if (schedule.frequency === 'monthly') {
        schedule.dayOfMonth = parseInt(this.scheduleDayOfMonthSelect.value);
      }
      
      // Update UI to show we're generating the script
      this.scheduleStatusElement.textContent = "Generating sync script...";
      this.scheduleStatusElement.className = "status-message";
      this.saveScheduleButton.disabled = true;
      this.scheduleDetailsElement.textContent = "Generating script, please wait...";
      this.showLoading("Generating sync script and setting up schedule...");
      
      // Call the main process to generate the script
      const result = await ipcRenderer.invoke('generate-sync-script', { schedule });
      
      // Update UI with results
      this.saveScheduleButton.disabled = false;
      this.hideLoading();
      
      if (result.success) {
        this.scheduleStatusElement.textContent = result.message;
        this.scheduleStatusElement.className = "status-message success";
        
        // Add check mark to the icon
        this.scheduleStatusIcon.innerHTML = "✓";
        this.scheduleStatusIcon.className = "status-icon success";
        
        // Format the schedule details
        let detailsOutput = "Schedule Configuration:\n\n";
        detailsOutput += `Status: ${schedule.enabled ? 'Enabled' : 'Disabled'}\n`;
        detailsOutput += `Frequency: ${schedule.frequency.charAt(0).toUpperCase() + schedule.frequency.slice(1)}\n`;
        
        // Format time
        const hour12 = schedule.hour % 12 || 12;
        const ampm = schedule.hour < 12 ? 'AM' : 'PM';
        const minute = schedule.minute.toString().padStart(2, '0');
        detailsOutput += `Time: ${hour12}:${minute} ${ampm}\n`;
        
        // Add frequency-specific details
        if (schedule.frequency === 'weekly') {
          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          detailsOutput += `Day of Week: ${days[schedule.dayOfWeek]}\n`;
        } else if (schedule.frequency === 'monthly') {
          detailsOutput += `Day of Month: ${schedule.dayOfMonth}\n`;
        }
        
        detailsOutput += `\nSync Script Path: ${result.scriptPath}\n\n`;
        
        // Add cron expression explanation
        let cronExpression = '';
        if (schedule.frequency === 'hourly') {
          cronExpression = '0 * * * *';
        } else if (schedule.frequency === 'daily') {
          cronExpression = `${schedule.minute} ${schedule.hour} * * *`;
        } else if (schedule.frequency === 'weekly') {
          cronExpression = `${schedule.minute} ${schedule.hour} * * ${schedule.dayOfWeek}`;
        } else if (schedule.frequency === 'monthly') {
          cronExpression = `${schedule.minute} ${schedule.hour} ${schedule.dayOfMonth} * *`;
        }
        
        detailsOutput += `Cron Expression: ${cronExpression}\n`;
        detailsOutput += `(This is the schedule format used by the system's task scheduler)\n\n`;
        
        detailsOutput += "The sync script will run automatically according to this schedule.\n";
        detailsOutput += "You can also run it manually at any time by executing the script directly.\n";
        detailsOutput += "Logs will be saved to the 'logs' directory.";
        
        this.scheduleDetailsElement.textContent = detailsOutput;
        
        // Verify that the schedule was set correctly
        setTimeout(async () => {
          this.scheduleStatusElement.textContent = "Verifying schedule...";
          
          // Get the current schedule from the system
          const verifyResult = await ipcRenderer.invoke('get-current-schedule');
          
          if (verifyResult.success && verifyResult.schedule) {
            // Add verification details to the output
            let verificationOutput = this.scheduleDetailsElement.textContent;
            verificationOutput += "\n\n===== VERIFICATION RESULTS =====\n";
            verificationOutput += "Schedule was successfully set in the system's crontab.\n";
            verificationOutput += `Verified cron expression: ${verifyResult.schedule.cronExpression}\n`;
            
            this.scheduleDetailsElement.textContent = verificationOutput;
            this.scheduleStatusElement.textContent = "Schedule verified and set successfully!";
          } else {
            // Add verification failure details
            let verificationOutput = this.scheduleDetailsElement.textContent;
            verificationOutput += "\n\n===== VERIFICATION RESULTS =====\n";
            verificationOutput += "WARNING: Could not verify if the schedule was set correctly.\n";
            verificationOutput += `Reason: ${verifyResult.message || "Unknown error"}\n`;
            verificationOutput += "The script was generated but the schedule may not be active.";
            
            this.scheduleDetailsElement.textContent = verificationOutput;
            this.scheduleStatusElement.textContent = "Schedule may not be set correctly. Please check verification results.";
          }
        }, 1000); // Wait a second to ensure crontab has been updated
      } else {
        this.scheduleStatusElement.textContent = result.message;
        this.scheduleStatusElement.className = "status-message error";
        
        // Add error mark to the icon
        this.scheduleStatusIcon.innerHTML = "✗";
        this.scheduleStatusIcon.className = "status-icon error";
        
        this.scheduleDetailsElement.textContent = "Failed to generate sync script: " + result.error;
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      this.scheduleStatusElement.textContent = `Error: ${error.message}`;
      this.scheduleStatusElement.className = "status-message error";
      this.saveScheduleButton.disabled = false;
      this.hideLoading();
      
      // Add error mark to the icon
      this.scheduleStatusIcon.innerHTML = "✗";
      this.scheduleStatusIcon.className = "status-icon error";
      
      this.scheduleDetailsElement.textContent = "Failed to save schedule: " + error.message;
    }
  }
  
  /**
   * Test connection between cloud storage and PageFinder
   */
  async testConnection() {
    try {
      // Verify that both cloud and PageFinder configs are set up
      const remoteItems = this.remoteListContainer.querySelectorAll('.remote-item');
      if (remoteItems.length === 0) {
        this.testConnectionStatusElement.textContent = "No cloud storage configured. Please set up at least one cloud storage first.";
        this.testConnectionStatusElement.className = "status-message error";
        return;
      }
      
      // Check if PageFinder config exists (we'll assume it's valid if it exists)
      const pfConfigExists = await ipcRenderer.invoke('check-pf-config-exists');
      if (!pfConfigExists) {
        this.testConnectionStatusElement.textContent = "PageFinder configuration not found. Please set up PageFinder first.";
        this.testConnectionStatusElement.className = "status-message error";
        return;
      }
      
      // Update UI to show we're testing
      this.testConnectionStatusElement.textContent = "Testing connections...";
      this.testConnectionStatusElement.className = "status-message";
      this.runTestConnectionButton.disabled = true;
      this.testConnectionDetailsElement.textContent = "Running tests, please wait...";
      this.showLoading("Testing connections between cloud storage and PageFinder...");
      
      // Call the main process to run the tests
      const result = await ipcRenderer.invoke('test-connection');
      
      // Update UI with results
      this.runTestConnectionButton.disabled = false;
      this.hideLoading();
      
      if (result.success) {
        this.testConnectionStatusElement.textContent = result.message;
        this.testConnectionStatusElement.className = "status-message success";
        
        // Add check mark to the icon
        this.testStatusIcon.innerHTML = "✓";
        this.testStatusIcon.className = "status-icon success";
      } else {
        this.testConnectionStatusElement.textContent = result.message;
        this.testConnectionStatusElement.className = "status-message error";
        
        // Add error mark to the icon
        this.testStatusIcon.innerHTML = "✗";
        this.testStatusIcon.className = "status-icon error";
      }
      
      // Format the results for display
      let detailsOutput = "Test Results:\n\n";
      
      if (result.results && result.results.length > 0) {
        result.results.forEach((testResult, index) => {
          detailsOutput += `Test ${index + 1}: ${testResult.remote}\n`;
          detailsOutput += `Command: ${testResult.command}\n`;
          detailsOutput += `Status: ${testResult.success ? 'Success ✓' : 'Failed ✗'}\n`;
          // Display the raw output exactly as it appears in the terminal
          // No formatting, no modifications, just the raw output
          detailsOutput = testResult.output || 'No output';
          detailsOutput += "----------------------------------------\n\n";
        });
      } else {
        detailsOutput += "No test results available.";
      }
      
      this.testConnectionDetailsElement.innerHTML = detailsOutput;
    } catch (error) {
      console.error('Error testing connections:', error);
      this.testConnectionStatusElement.textContent = `Error: ${error.message}`;
      this.testConnectionStatusElement.className = "status-message error";
      this.runTestConnectionButton.disabled = false;
      this.hideLoading();
      
      // Add error mark to the icon
      this.testStatusIcon.innerHTML = "✗";
      this.testStatusIcon.className = "status-icon error";
      
      this.testConnectionDetailsElement.innerHTML = "Test failed with error: " + error.message;
    }
  }
  
  /**
   * Validate and save the PageFinder config file
   */
  async validatePFConfig() {
    try {
      const filePath = this.pfConfigPathInput.value;
      
      if (!filePath) {
        this.pfConfigStatusElement.textContent = "Please select a config file first.";
        this.pfConfigStatusElement.className = "status-message error";
        return;
      }
      
      this.pfConfigStatusElement.textContent = "Validating config file...";
      this.validatePFConfigButton.disabled = true;
      
      const result = await ipcRenderer.invoke('validate-pf-config', filePath);
      
      this.validatePFConfigButton.disabled = false;
      
      if (result.success) {
        this.pfConfigStatusElement.textContent = result.message;
        this.pfConfigStatusElement.className = "status-message success";
        
        // Add check mark to the icon
        this.pfConfigStatusIcon.innerHTML = "✓";
        this.pfConfigStatusIcon.className = "status-icon success";
        
        // Enable the check connection button
        if (this.checkPFConnectionButton) {
          this.checkPFConnectionButton.disabled = false;
        }
        
        // Check if the config file exists after validation
        await this.checkPFConfigExists();
      } else {
        this.pfConfigStatusElement.textContent = result.message;
        this.pfConfigStatusElement.className = "status-message error";
        
        // Add error mark to the icon
        this.pfConfigStatusIcon.innerHTML = "✗";
        this.pfConfigStatusIcon.className = "status-icon error";
      }
    } catch (error) {
      console.error('Error validating PageFinder config:', error);
      this.pfConfigStatusElement.textContent = `Error: ${error.message}`;
      this.pfConfigStatusElement.className = "status-message error";
      this.validatePFConfigButton.disabled = false;
      
      // Add error mark to the icon
      this.pfConfigStatusIcon.innerHTML = "✗";
      this.pfConfigStatusIcon.className = "status-icon error";
    }
  }
  
  /**
   * Check connection to PageFinder bucket
   */
  async checkPFConnection() {
    try {
      // Verify that config file has been set first
      const configStatus = this.pfConfigStatusIcon.className || '';
      if (!configStatus.includes('success')) {
        this.pfConnectionStatusElement.textContent = "Please set up configuration first.";
        this.pfConnectionStatusElement.className = "status-message error";
        return;
      }
      
      this.pfConnectionStatusElement.textContent = "Checking connection...";
      this.checkPFConnectionButton.disabled = true;
      this.pfConnectionDetailsElement.textContent = "Extracting parameters from config file and testing connection...";
      
      // Pass the checkbox value to the main process
      const result = await ipcRenderer.invoke('check-pf-connection', {
        useLsCommand: this.useLsCommandPfCheckbox && this.useLsCommandPfCheckbox.checked
      });
      
      this.checkPFConnectionButton.disabled = false;
      
      if (result.success) {
        this.pfConnectionStatusElement.textContent = result.message;
        this.pfConnectionStatusElement.className = "status-message success";
        
        // Add check mark to the icon
        this.pfConnectionStatusIcon.innerHTML = "✓";
        this.pfConnectionStatusIcon.className = "status-icon success";
        
        // Format details output with config information
        let detailsOutput = "Connection Details (Extracted from Config):\n\n";
        detailsOutput += `Remote: ${result.details.remoteName}\n`;
        
        if (result.details.bucket) {
          detailsOutput += `Bucket: ${result.details.bucket}\n`;
        }
        
        if (result.details.region) {
          detailsOutput += `Region: ${result.details.region}\n`;
        }
        
        if (result.details.accessKey) {
          // Only show a portion of the access key for security
          const maskedKey = result.details.accessKey.substring(0, 4) + '...' +
                           result.details.accessKey.substring(result.details.accessKey.length - 4);
          detailsOutput += `Access Key: ${maskedKey}\n`;
        }
        detailsOutput += "Directory Listing:\n";
        detailsOutput += "----------------------------------------\n";
        detailsOutput += result.details.output || "No files found";
        
        this.pfConnectionDetailsElement.textContent = detailsOutput;
      } else {
        this.pfConnectionStatusElement.textContent = result.message;
        this.pfConnectionStatusElement.className = "status-message error";
        
        // Add error mark to the icon
        this.pfConnectionStatusIcon.innerHTML = "✗";
        this.pfConnectionStatusIcon.className = "status-icon error";
        
        this.pfConnectionDetailsElement.textContent = result.error || "Connection failed. Please check your configuration.";
      }
    } catch (error) {
      console.error('Error checking PageFinder connection:', error);
      this.pfConnectionStatusElement.textContent = `Error: ${error.message}`;
      this.pfConnectionStatusElement.className = "status-message error";
      this.checkPFConnectionButton.disabled = false;
      
      // Add error mark to the icon
      this.pfConnectionStatusIcon.innerHTML = "✗";
      this.pfConnectionStatusIcon.className = "status-icon error";
      
      this.pfConnectionDetailsElement.textContent = "Connection failed with error: " + error.message;
    }
  }
  
  /**
   * Confirm and save the subfolder setting
   */
  confirmSubfolderSetting() {
    if (!this.currentSubfolderRemote) {
      this.statusElement.textContent = "No remote selected for subfolder setting";
      this.hideSubfolderDialog();
      return;
    }
    
    const subfolder = this.subfolderPathInput.value.trim();
    
    // Send to main process
    this.statusElement.textContent = `Setting subfolder for ${this.currentSubfolderRemote}...`;
    ipcRenderer.send("set-subfolder", {
      remoteName: this.currentSubfolderRemote,
      subfolder: subfolder
    });
    
    this.hideSubfolderDialog();
  }
  
  /**
   * Display the remote configuration dialog
   * @param {string} providerKey - The provider key
   */
  showRemoteDialog(providerKey) {
    // Check if maximum number of remotes (3) has been reached
    const remoteItems = this.remoteListContainer.querySelectorAll('.remote-item');
    if (remoteItems.length >= 3) {
      this.statusElement.textContent = "Maximum limit of 3 storage configurations reached. Please remove an existing one first.";
      return;
    }
    
    const providerDisplayNames = {
      gdrive: "Google Drive",
      onedrive: "OneDrive",
      box: "Box",
      dropbox: "Dropbox",
      local: "Local Storage"
    };
    
    // Update dialog title
    const dialogTitle = this.remoteDialog.querySelector("h3");
    dialogTitle.textContent = `Add ${providerDisplayNames[providerKey]} Remote`;
    
    // Clear inputs
    this.remoteNameInput.value = "";
    
    // Show/hide local path group
    if (providerKey === 'local') {
      this.localPathGroup.style.display = 'block';
      const localPathInput = document.getElementById('local-path');
      if (localPathInput) {
        localPathInput.value = '';
      }
    } else {
      this.localPathGroup.style.display = 'none';
    }
    
    // Show dialog
    this.overlay.classList.add("show");
    this.remoteDialog.classList.add("show");
    this.remoteNameInput.focus();
  }
  
  /**
   * Hide the remote dialog
   */
  hideRemoteDialog() {
    this.overlay.classList.remove("show");
    this.remoteDialog.classList.remove("show");
  }
  
  /**
   * Display the rclone setup dialog
   */
  showRcloneSetupDialog() {
    this.overlay.classList.add("show");
    this.rcloneSetupDialog.classList.add("show");
    this.rclonePathInput.focus();
  }
  
  /**
   * Hide the rclone setup dialog
   */
  hideRcloneSetupDialog() {
    this.overlay.classList.remove("show");
    this.rcloneSetupDialog.classList.remove("show");
  }
  
  /**
   * Use the default rclone path
   */
  handleDefaultRclonePath() {
    this.rclonePathInput.value = '/usr/local/bin/rclone';
    this.saveRclonePath();
  }
  
  /**
   * Save the rclone path
   */
  async saveRclonePath() {
    const rclonePath = this.rclonePathInput.value.trim();
    
    if (!rclonePath) {
      this.statusElement.textContent = "Please enter a valid rclone path";
      return;
    }
    
    this.statusElement.textContent = "Validating rclone path...";
    
    const isValid = await ipcRenderer.invoke('validate-rclone-path', rclonePath);
    
    if (isValid) {
      this.statusElement.textContent = "Rclone path set successfully!";
      this.hideRcloneSetupDialog();
      this.refreshRemotesList();
    } else {
      this.statusElement.textContent = "Invalid rclone path. Please check and try again.";
    }
  }
  
  /**
   * Confirm the creation of a new remote
   */
  confirmRemoteCreation() {
    const remoteName = this.remoteNameInput.value.trim();
    
    if (!remoteName) {
      this.statusElement.textContent = "Please enter a remote name";
      return;
    }
    
    const providerType = this.providers.get(this.currentProvider);
    if (!providerType) {
      this.statusElement.textContent = "Invalid provider type";
      return;
    }
    
    // Check for local path if local storage is selected
    let localPath = '';
    if (this.currentProvider === 'local') {
      const localPathInput = document.getElementById('local-path');
      localPath = localPathInput.value.trim();
      
      if (!localPath) {
        this.statusElement.textContent = "Please enter a local folder path";
        return;
      }
    }
    
    this.statusElement.textContent = "Starting configuration...";
    this.disableProviderButtons(true);
    
    // Only show loading indicator for cloud providers (not local)
    // This prevents the loading overlay from blocking file dialogs
    if (this.currentProvider !== 'local') {
      this.showLoading("Configuring remote. This may take a moment...");
    }
    
    ipcRenderer.send("configure-remote", {
      name: remoteName,
      provider: providerType,
      localPath: localPath
    });
    
    this.hideRemoteDialog();
  }
  
  /**
   * Close the application
   */
  closeApplication() {
    this.closeButton.disabled = true;
    this.statusElement.textContent = "Cleaning up and closing...";
    ipcRenderer.send("close-app");
  }
  
  /**
   * Refresh the list of remotes
   */
  refreshRemotesList() {
    this.statusElement.textContent = "Loading remotes list...";
    this.reloadButton.disabled = true;
    this.showLoading("Loading remotes...");
    ipcRenderer.send("list-remotes");
  }
  
  /**
   * Handle remote selection
   * @param {string} remoteName - The name of the remote
   */
  handleRemoteClick(remoteName) {
    // Remove previous selection
    const previousSelected = this.remoteListContainer.querySelector('.selected');
    if (previousSelected) {
      previousSelected.classList.remove('selected');
    }

    // Add selection to clicked remote
    const remoteElements = this.remoteListContainer.querySelectorAll('.remote-item');
    for (const element of remoteElements) {
      // Get the text content but ignore any nested subfolder spans
      const nameElement = element.querySelector('.remote-item-name');
      const nameText = nameElement ? nameElement.childNodes[0].textContent.trim() : '';
      
      if (nameText === remoteName) {
        element.classList.add('selected');
        break;
      }
    }

    this.selectedRemote = remoteName;
    const remoteStatusElement = document.getElementById('remote-status');
    if (remoteStatusElement) {
      remoteStatusElement.textContent = `Selected remote: ${remoteName}`;
    }
  }
  
  /**
   * Update the list of remotes in the UI
   * @param {Object} data - The data containing remotes and metadata
   * @param {string[]} data.remotes - The list of remotes
   * @param {Object} data.metadata - The metadata for the remotes
   */
  updateRemotesList(data) {
    let remotes = [];
    let metadata = {};
    
    // Handle both old format (array) and new format (object with remotes and metadata)
    if (Array.isArray(data)) {
      remotes = data;
    } else if (data && data.remotes) {
      remotes = data.remotes;
      metadata = data.metadata || {};
    }
    
    // Hide loading indicator
    this.hideLoading();
    
    // Create remotes list
    const remotesList = document.createElement("div");
    remotesList.className = "remote-items";
    
    if (remotes.length > 0) {
      remotesList.innerHTML = remotes.map(remote => {
        // Get metadata for this remote if available
        const remoteMetadata = metadata[remote] || {};
        const hasSubfolder = remoteMetadata.subfolder && remoteMetadata.subfolder.trim() !== '';
        
        return `
        <div class="remote-item">
          <span class="remote-item-name">
            ${remote}
            ${hasSubfolder ? `
              <span class="remote-subfolder" title="Access limited to subfolder">
                <svg width="14" height="14" viewBox="0 0 16 16" style="vertical-align: middle; margin-left: 5px;">
                  <path fill="currentColor" d="M9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.825a2 2 0 0 1-1.991-1.819l-.637-7a2 2 0 0 1 1.99-2.181h4.017a2 2 0 0 0 1.523-.734l.6-.738a1 1 0 0 1 .76-.366z"/>
                </svg>
                <small>${remoteMetadata.subfolder}</small>
              </span>
            ` : ''}
          </span>
          <div class="remote-item-actions">
            <button class="action-icon folder" title="Set Subfolder Restriction">
              <svg width="16" height="16" viewBox="0 0 16 16">
                <path fill="currentColor" d="M9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.825a2 2 0 0 1-1.991-1.819l-.637-7a2 2 0 0 1 1.99-2.181h4.017a2 2 0 0 0 1.523-.734l.6-.738a1 1 0 0 1 .76-.366z"/>
              </svg>
            </button>
            <button class="action-icon check" title="Check Remote">
              <svg width="16" height="16" viewBox="0 0 16 16">
                <path fill="currentColor" d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
              </svg>
            </button>
            <button class="action-icon delete" title="Delete Remote">
              <svg width="16" height="16" viewBox="0 0 16 16">
                <path fill="currentColor" d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                <path fill="currentColor" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
              </svg>
            </button>
          </div>
        </div>
      `;
      }).join("");
      
      // Update remoteList content
      this.remoteListContainer.innerHTML = '';
      this.remoteListContainer.appendChild(remotesList);
      
      // Make sure remote status container exists
      const remoteStatusContainer = document.getElementById('remote-status-container');
      if (remoteStatusContainer) {
        // Clear the container
        remoteStatusContainer.innerHTML = '';
        
        // Create a header for the status container
        const statusHeader = document.createElement("div");
        statusHeader.className = "remote-status-header";
        statusHeader.textContent = "Remote Status";
        remoteStatusContainer.appendChild(statusHeader);
        
        // Create the status content div
        const statusDiv = document.createElement("div");
        statusDiv.id = "remote-status";
        statusDiv.className = "remote-status";
        statusDiv.textContent = "Select a remote and click the check icon to view details.";
        remoteStatusContainer.appendChild(statusDiv);
      }
      
      // Add click handlers
      const remoteItems = remotesList.querySelectorAll('.remote-item');
      remoteItems.forEach(item => {
        // Get the text content but ignore any nested subfolder spans
        const nameElement = item.querySelector('.remote-item-name');
        const nameText = nameElement ? nameElement.childNodes[0].textContent.trim() : '';
        
        console.log('Adding handlers for remote:', nameText);
        
        // Name click handler
        item.querySelector('.remote-item-name').addEventListener('click', () => {
          this.handleRemoteClick(nameText);
        });

        // Folder button handler for subfolder restriction
        item.querySelector('.action-icon.folder').addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          // Auto-select the remote if not already selected
          if (this.selectedRemote !== nameText) {
            this.handleRemoteClick(nameText);
          }
          this.showSubfolderDialog(nameText);
        });

        // Check button handler
        item.querySelector('.action-icon.check').addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          // Auto-select the remote if not already selected
          if (this.selectedRemote !== nameText) {
            this.handleRemoteClick(nameText);
          }
          this.statusElement.textContent = "Testing remote connection...";
          this.remoteListContainer.classList.add('loading');
          this.showLoading("Testing remote connection...");
          ipcRenderer.send("check-remote", nameText);
        });

        // Delete button handler
        item.querySelector('.action-icon.delete').addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          // Auto-select the remote if not already selected
          if (this.selectedRemote !== nameText) {
            this.handleRemoteClick(nameText);
          }
          this.statusElement.textContent = `Deleting remote ${nameText}...`;
          this.showLoading(`Deleting remote ${nameText}...`);
          ipcRenderer.send("delete-remote", nameText);
        });
      });
      
      // Reselect previously selected remote
      if (this.selectedRemote) {
        // Get the list of actual remote names (handling both array and object formats)
        const remoteNames = Array.isArray(remotes) 
          ? remotes 
          : (remotes.remotes || []);
        
        // Check if our selected remote is still in the list
        let found = false;
        remoteNames.forEach(remoteName => {
          // Clean the name to compare with our stored selection
          if (typeof remoteName === 'string' && remoteName.trim() === this.selectedRemote) {
            found = true;
            this.handleRemoteClick(this.selectedRemote);
          }
        });
        
        if (!found) {
          this.selectedRemote = null;
        }
      }
    } else {
      this.remoteListContainer.innerHTML = '<div class="no-remotes">No remotes configured</div>';
      this.selectedRemote = null;
    }
    
    // Update status
    this.statusElement.textContent = remotes.length > 0 
      ? "Remotes list loaded successfully." 
      : "No remotes configured. Add a new remote to get started.";
    
    this.reloadButton.disabled = false;
  }
  
  /**
   * Display the remote status information
   * @param {Object} result - The remote status result
   */
  /**
   * Display the remote status information in the separate status container with improved formatting
   * @param {Object} result - The remote status result
   */
  displayRemoteStatus(result) {
    this.remoteListContainer.classList.remove('loading');
    this.hideLoading();
    
    // Get the remote status container and elements
    const remoteStatusContainer = document.getElementById('remote-status-container');
    const remoteStatusHeader = remoteStatusContainer?.querySelector('.remote-status-header');
    const remoteStatusElement = document.getElementById('remote-status');
    
    if (!remoteStatusContainer || !remoteStatusElement) return;
    
    console.log('Remote status result:', result);
    
    // Update the header with the remote name
    if (remoteStatusHeader && result.name) {
      remoteStatusHeader.textContent = `Remote Status: ${result.name}`;
    }
    
    let content = '';
    
    // Format remote name as a header
    if (result.name) {
      content += `📂 Remote: ${result.name}\n`;
      
      // Add a separator line
      content += `${'─'.repeat(40)}\n\n`;
    }
    
    // Add metadata info if available
    if (result.metadata && result.metadata.subfolder) {
      content += `📁 Subfolder: ${result.metadata.subfolder}\n`;
      
      // Check if this is a local remote from the type if available
      if (result.type === 'local' && result.path) {
        content += `📁 Local Path: ${result.path}\n`;
        content += `📁 Full Path: ${result.path}/${result.metadata.subfolder}\n`;
      }
      content += '\n';
    }
    
    // Add summary if available and format it nicely
    if (result.summary) {
      content += `📊 Storage Information:\n${result.summary}\n\n`;
    }
    
    // Add file listing if available
    if (result.recentFiles) {
      content += `📄 Files:\n${result.recentFiles}`;
    }
    
    // Ensure we have some content
    if (!content.trim()) {
      content = "No content to display";
    }
    
    // Update the content
    remoteStatusElement.textContent = content;
    
    // Scroll to the top of the status container
    remoteStatusElement.scrollTop = 0;
    
    // Make sure the container is visible
    remoteStatusContainer.style.display = 'block';
  }
  
  /**
   * Handle the remote deletion status
   * @param {boolean} success - Whether the deletion was successful
   * @param {string} message - The status message
   */
  handleDeleteStatus(success, message) {
    this.statusElement.textContent = message;
    this.hideLoading();
    if (success) {
      this.selectedRemote = null;
      // Refresh the remotes list
      this.refreshRemotesList();
    }
  }
  
  /**
   * Update the configuration status message
   * @param {string} message - The status message
   */
  updateConfigStatus(message) {
    let cleanMessage = message;
    
    // Handle special cases with better messaging
    if (message.includes('command not found')) {
      cleanMessage = "Error: Rclone is not installed\n\nPlease install rclone first:\n1. Visit https://rclone.org/install/\n2. Follow the installation instructions for your system\n3. Restart this application";
      
    } else if (message.includes("token =")) {
      cleanMessage = "Remote configured successfully! (Browser connection errors can be ignored)";
      
    } else if (message.includes("Make sure your Redirect URL")) {
      cleanMessage = "Waiting for authorization...";
      
    } else if (message.includes("type =")) {
      cleanMessage = "Remote configured successfully!";
      
      setTimeout(() => {
        ipcRenderer.send("list-remotes");
      }, 1000);
    } else {
      this.enableProviderButtons();
    }
    
    this.statusElement.textContent = cleanMessage;
  }
  
  /**
   * Disable/enable all provider buttons
   * @param {boolean} disabled - Whether to disable the buttons
   */
  disableProviderButtons(disabled) {
    Object.values(this.providerButtons).forEach(button => {
      button.disabled = disabled;
    });
  }
  
  /**
   * Enable all provider buttons
   */
  enableProviderButtons() {
    this.disableProviderButtons(false);
  }
}

// Initialize the UI
const uiController = new ConfigUIController();