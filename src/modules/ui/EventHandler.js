/**
 * Event Handler Module
 * Manages all event listeners for the application
 */

const { ipcRenderer } = require("electron");

class EventHandler {
  /**
   * Initialize the event handler
   * @param {Object} controller - Reference to the main UIController
   */
  constructor(controller) {
    this.controller = controller;
  }

  /**
   * Set up all event listeners for UI elements
   */
  setupEventListeners() {
    this.setupUIEventListeners();
    this.setupIPCListeners();
  }

  /**
   * Set up UI-specific event listeners
   */
  setupUIEventListeners() {
    const {
      sidebarCloudButton,
      sidebarPagefinderButton,
      sidebarTestButton,
      sidebarLogsButton,
      sidebarScheduleButton,
      browsePFConfigButton,
      validatePFConfigButton,
      browseLocalFolderButton,
      checkPFConnectionButton,
      runTestConnectionButton,
      viewSyncLogButton,
      viewExecLogButton,
      scheduleFrequencySelect,
      saveScheduleButton,
      addStorageButton,
      storageTypeSelect,
      useDefaultPathButton,
      confirmRclonePathButton,
      cancelRclonePathButton,
      confirmRemoteButton,
      cancelRemoteButton,
      confirmSubfolderButton,
      cancelSubfolderButton,
      closeButton,
      reloadButton
    } = this.controller;

    // Sidebar menu navigation
    sidebarCloudButton.addEventListener("click", () => this.controller.showSection("cloud"));
    sidebarPagefinderButton.addEventListener("click", () => this.controller.showSection("pagefinder"));
    sidebarTestButton.addEventListener("click", () => this.controller.showSection("test"));
    sidebarLogsButton.addEventListener("click", () => this.controller.showSection("logs"));
    sidebarScheduleButton.addEventListener("click", () => this.controller.showSection("schedule"));
    
    // PageFinder config handlers
    if (browsePFConfigButton) {
      browsePFConfigButton.addEventListener("click", () => this.controller.pageFinderManager.browsePFConfig());
    }
    
    if (validatePFConfigButton) {
      validatePFConfigButton.addEventListener("click", () => this.controller.pageFinderManager.validatePFConfig());
    }
    
    // Local folder browse button handler
    if (browseLocalFolderButton) {
      browseLocalFolderButton.addEventListener("click", () => this.controller.remoteManager.browseLocalFolder());
    }
    
    if (checkPFConnectionButton) {
      checkPFConnectionButton.addEventListener("click", () => this.controller.pageFinderManager.checkPFConnection());
    }

    // Test connection button handler
    if (runTestConnectionButton) {
      runTestConnectionButton.addEventListener("click", () => this.controller.testManager.testConnection());
    }
    
    // Check logs button handler
    const checkLogsButton = document.getElementById('check-logs');
    if (checkLogsButton) {
      checkLogsButton.addEventListener("click", () => this.controller.logScheduleManager.checkSyncLog());
    }
    
    // Schedule handlers
    if (scheduleFrequencySelect) {
      scheduleFrequencySelect.addEventListener("change", () => this.controller.logScheduleManager.updateScheduleOptions());
    }
    
    if (saveScheduleButton) {
      saveScheduleButton.addEventListener("click", () => this.controller.logScheduleManager.saveSchedule());
    }
    
    // Clear schedule button handler
    const clearScheduleButton = document.getElementById('clear-schedule');
    if (clearScheduleButton) {
      clearScheduleButton.addEventListener("click", () => this.controller.logScheduleManager.clearSchedule());
    }
    // Set up storage selection handlers
    if (storageTypeSelect) {
      // Add change listener to handle showing/hiding local path group when dropdown changes
      storageTypeSelect.addEventListener("change", () => {
        // Store the selected provider type for later use
        this.controller.currentProviderType = storageTypeSelect.value;
      });
    }
    
    if (addStorageButton) {
      addStorageButton.addEventListener("click", () => {
        const selectedProvider = storageTypeSelect.value;
        this.controller.currentProvider = selectedProvider;
        this.controller.dialogManager.showRemoteDialog(selectedProvider);
      });
    }
    
    // Rclone setup dialog handlers
    useDefaultPathButton.addEventListener("click", () => this.controller.remoteManager.handleDefaultRclonePath());
    confirmRclonePathButton.addEventListener("click", () => this.controller.remoteManager.saveRclonePath());
    cancelRclonePathButton.addEventListener("click", () => this.controller.dialogManager.hideRcloneSetupDialog());
    
    // Remote dialog handlers
    confirmRemoteButton.addEventListener("click", () => this.controller.remoteManager.confirmRemoteCreation());
    cancelRemoteButton.addEventListener("click", () => this.controller.dialogManager.hideRemoteDialog());
    
    // Subfolder dialog handlers
    confirmSubfolderButton.addEventListener("click", () => this.controller.remoteManager.confirmSubfolderSetting());
    cancelSubfolderButton.addEventListener("click", () => this.controller.dialogManager.hideSubfolderDialog());
    
    // Action button handlers
    closeButton.addEventListener("click", () => this.controller.closeApplication());
    reloadButton.addEventListener("click", () => this.controller.remoteManager.refreshRemotesList());
  }

  /**
   * Set up all IPC event listeners
   */
  setupIPCListeners() {
    ipcRenderer.on('show-rclone-setup', async () => {
      const currentPath = await ipcRenderer.invoke('get-rclone-path');
      this.controller.rclonePathInput.value = currentPath || '/usr/local/bin/rclone';
      this.controller.dialogManager.showRcloneSetupDialog();
    });
    
    ipcRenderer.on("remotes-list", (event, remotes) => 
      this.controller.remoteManager.updateRemotesList(remotes));
      
    ipcRenderer.on("remote-status", (event, result) => 
      this.controller.remoteManager.displayRemoteStatus(result));
      
    ipcRenderer.on("delete-status", (event, { success, message }) => 
      this.controller.remoteManager.handleDeleteStatus(success, message));
      
    ipcRenderer.on("config-status", (event, message) => 
      this.controller.remoteManager.updateConfigStatus(message));
      
    ipcRenderer.on("subfolder-status", (event, { success, message, remoteName }) => {
      this.controller.statusElement.textContent = message;
      if (success) {
        this.controller.remoteManager.refreshRemotesList();
      }
    });
    
    ipcRenderer.on("sync-log-content", (event, { success, content, error }) => {
      if (success) {
        this.controller.logScheduleManager.displaySyncLog(content);
      } else {
        this.controller.logScheduleManager.displaySyncLogError(error);
      }
    });
    
    ipcRenderer.on("clean-logs-result", (event, { success, message, error }) => {
      if (success) {
        this.controller.logStatusElement.textContent = message;
        this.controller.logStatusElement.className = "status-message success";
        // Refresh the log display
        this.controller.logScheduleManager.checkSyncLog();
      } else {
        this.controller.logStatusElement.textContent = error || message;
        this.controller.logStatusElement.className = "status-message error";
      }
    });
  }
}

// Export the module
module.exports = EventHandler;