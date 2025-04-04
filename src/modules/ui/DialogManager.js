/**
 * Dialog Manager Module
 * Handles all dialog operations for the application
 */

class DialogManager {
  /**
   * Initialize the dialog manager
   * @param {Object} controller - Reference to the main UIController
   */
  constructor(controller) {
    this.controller = controller;
  }

  /**
   * Show the remote configuration dialog
   * @param {string} providerKey - The provider key
   */
  showRemoteDialog(providerKey) {
    const { 
      remoteListContainer, 
      statusElement, 
      remoteDialog, 
      remoteNameInput, 
      overlay, 
      localPathGroup, 
      providers,
      currentProvider
    } = this.controller;
    
    // Check if maximum number of remotes (3) has been reached
    const remoteItems = remoteListContainer.querySelectorAll('.remote-item');
    
    if (remoteItems.length >= 3) {
      statusElement.textContent = "Maximum limit of 3 storage configurations reached. Please remove an existing one first.";
      return;
    }
    
    const providerDisplayNames = {
      drive: "Google Drive",
      onedrive: "OneDrive",
      box: "Box",
      dropbox: "Dropbox",
      local: "Local Storage"
    };
    
    // Update dialog title
    const dialogTitle = remoteDialog.querySelector("h3");
    dialogTitle.textContent = `Add ${providerDisplayNames[providerKey]} Remote`;
    
    // Clear inputs
    remoteNameInput.value = "";
    
    // Show/hide local path group
    if (providerKey === 'local') {
      localPathGroup.style.display = 'block';
      const localPathInput = document.getElementById('local-path');
      if (localPathInput) {
        localPathInput.value = '';
      }
    } else {
      localPathGroup.style.display = 'none';
    }
    
    // Show dialog
    this.showDialog(remoteDialog, overlay);
    remoteNameInput.focus();
  }

  /**
   * Hide the remote dialog
   */
  hideRemoteDialog() {
    const { remoteDialog, overlay } = this.controller;
    this.hideDialog(remoteDialog, overlay);
  }

  /**
   * Show the subfolder dialog
   * @param {string} remoteName - The remote to set subfolder for
   */
  showSubfolderDialog(remoteName) {
    const { 
      currentSubfolderRemote, 
      subfolderDialog, 
      overlay, 
      subfolderPathInput,
      remoteManager
    } = this.controller;
    
    this.controller.currentSubfolderRemote = remoteName;
    
    // Get existing subfolder if any
    const metadata = remoteManager.getRemoteMetadata(remoteName);
    const currentSubfolder = metadata?.subfolder || '';
    
    // Set value in input
    subfolderPathInput.value = currentSubfolder;
    
    // Show dialog
    subfolderDialog.querySelector('h3').textContent = `Set Subfolder for ${remoteName}`;
    this.showDialog(subfolderDialog, overlay);
    subfolderPathInput.focus();
  }

  /**
   * Hide the subfolder dialog
   */
  hideSubfolderDialog() {
    const { subfolderDialog, overlay } = this.controller;
    this.hideDialog(subfolderDialog, overlay);
    this.controller.currentSubfolderRemote = null;
  }

  /**
   * Show the rclone setup dialog
   */
  showRcloneSetupDialog() {
    const { rcloneSetupDialog, overlay, rclonePathInput } = this.controller;
    this.showDialog(rcloneSetupDialog, overlay);
    rclonePathInput.focus();
  }

  /**
   * Hide the rclone setup dialog
   */
  hideRcloneSetupDialog() {
    const { rcloneSetupDialog, overlay } = this.controller;
    this.hideDialog(rcloneSetupDialog, overlay);
  }

  /**
   * Show a dialog
   * @param {HTMLElement} dialog - The dialog element
   * @param {HTMLElement} overlay - The overlay element
   */
  showDialog(dialog, overlay) {
    overlay.classList.add("show");
    dialog.classList.add("show");
  }

  /**
   * Hide a dialog
   * @param {HTMLElement} dialog - The dialog element
   * @param {HTMLElement} overlay - The overlay element
   */
  hideDialog(dialog, overlay) {
    overlay.classList.remove("show");
    dialog.classList.remove("show");
  }
}

// Export the module
module.exports = DialogManager;