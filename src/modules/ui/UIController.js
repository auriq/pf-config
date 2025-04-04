/**
 * UI Controller Module
 * Handles core UI operations and coordinates between other modules
 */

// Import dependencies
const { ipcRenderer } = require("electron");
const DialogManager = require("./DialogManager");
const RemoteManager = require("./RemoteManager");
const PageFinderManager = require("./PageFinderManager");
const TestManager = require("./TestManager");
const LogScheduleManager = require("./LogScheduleManager");
const EventHandler = require("./EventHandler");

class UIController {
  /**
   * Initialize the UI controller
   */
  constructor() {
    // Initialize state
    this.currentProvider = null;
    this.selectedRemote = null;
    this.currentSubfolderRemote = null;
    
    // Initialize UI elements
    this.initializeElements();
    
    // Initialize sub-modules
    this.dialogManager = new DialogManager(this);
    this.remoteManager = new RemoteManager(this);
    this.pageFinderManager = new PageFinderManager(this);
    this.testManager = new TestManager(this);
    this.logScheduleManager = new LogScheduleManager(this);
    
    // Initialize event handler
    this.eventHandler = new EventHandler(this);
    this.eventHandler.setupEventListeners();
    
    // Show cloud config section initially
    this.showSection('cloud');
    
    // Request initial remotes list (in background)
    this.remoteManager.refreshRemotesList();
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
   * This method sets up references to all UI elements used throughout the application
   */
  initializeElements() {
    // Content sections
    this.cloudConfigSection = document.getElementById("cloud-config-section");
    this.pagefinderConfigSection = document.getElementById("pagefinder-config-section");
    this.testConnectionSection = document.getElementById("test-connection-section");
    this.logsSection = document.getElementById("logs-section");
    this.scheduleSection = document.getElementById("schedule-section");
    
    // Sidebar menu items
    this.sidebarCloudButton = document.getElementById("sidebar-menu-cloud");
    this.sidebarPagefinderButton = document.getElementById("sidebar-menu-pagefinder");
    this.sidebarTestButton = document.getElementById("sidebar-menu-test");
    this.sidebarLogsButton = document.getElementById("sidebar-menu-logs");
    this.sidebarScheduleButton = document.getElementById("sidebar-menu-schedule");
    
    // Sidebar menu items array for easier manipulation
    this.sidebarMenuItems = [
      this.sidebarCloudButton,
      this.sidebarPagefinderButton,
      this.sidebarTestButton,
      this.sidebarLogsButton,
      this.sidebarScheduleButton
    ];
    
    // Storage selection elements
    this.storageTypeSelect = document.getElementById("storage-type-select");
    this.addStorageButton = document.getElementById("add-storage-btn");
    
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
    this.useLsCommandCloudCheckbox = document.getElementById("use-ls-command-cloud");
    
    // Test connection elements
    this.runTestConnectionButton = document.getElementById("run-test-connection");
    this.runSyncNowButton = document.getElementById("run-sync-now");
    this.testConnectionStatusElement = document.getElementById("test-connection-status");
    this.testStatusIcon = document.getElementById("test-status-icon");
    this.testConnectionDetailsElement = document.getElementById("test-connection-details");
    
    // Logs elements
    this.viewSyncLogButton = document.getElementById("view-sync-log");
    this.cleanLogsButton = document.getElementById("clean-logs");
    this.logStatusElement = document.getElementById("log-status");
    this.syncLogDetailsElement = document.getElementById("sync-log-details");
    
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
      ['drive', 'drive'],
      ['onedrive', 'onedrive'],
      ['box', 'box'],
      ['dropbox', 'dropbox'],
      ['local', 'local']
    ]);
  }

  /**
   * Show a specific section and hide others
   * Controls which main application section is visible
   * @param {string} section - The section to show: 'menu', 'cloud', 'pagefinder', 'test', 'logs', or 'schedule'
   */
  async showSection(section) {
    // Hide all sections first
    this.cloudConfigSection.style.display = 'none';
    this.pagefinderConfigSection.style.display = 'none';
    this.testConnectionSection.style.display = 'none';
    this.logsSection.style.display = 'none';
    this.scheduleSection.style.display = 'none';
    
    // Remove active class from all sidebar menu items
    this.sidebarMenuItems.forEach(item => {
      item.classList.remove('active');
    });
    
    // Show the requested section and set active sidebar item
    switch(section) {
      case 'cloud':
        this.cloudConfigSection.style.display = 'block';
        this.sidebarCloudButton.classList.add('active');
        break;
      case 'pagefinder':
        this.pagefinderConfigSection.style.display = 'block';
        this.sidebarPagefinderButton.classList.add('active');
        // Check if pf.conf exists
        this.pageFinderManager.checkPFConfigExists();
        break;
      case 'test':
        this.testConnectionSection.style.display = 'block';
        this.sidebarTestButton.classList.add('active');
        break;
      case 'logs':
        this.logsSection.style.display = 'block';
        this.sidebarLogsButton.classList.add('active');
        break;
      case 'schedule':
        this.scheduleSection.style.display = 'block';
        this.sidebarScheduleButton.classList.add('active');
        // Load current schedule when showing the schedule section
        this.logScheduleManager.loadCurrentSchedule();
        break;
      default:
        this.cloudConfigSection.style.display = 'block';
        this.sidebarCloudButton.classList.add('active');
    }
  }
  
  /**
   * Close the application
   */
  closeApplication() {
    this.closeButton.disabled = true;
    this.statusElement.textContent = "Cleaning up and closing...";
    ipcRenderer.send("close-app");
  }
}

// Export the module
module.exports = UIController;