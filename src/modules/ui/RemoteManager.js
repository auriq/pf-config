/**
 * Remote Manager Module
 * Handles all remote storage operations
 */

const { ipcRenderer } = require("electron");

class RemoteManager {
  /**
   * Initialize the remote manager
   * @param {Object} controller - Reference to the main UIController
   */
  constructor(controller) {
    this.controller = controller;
  }

  /**
   * Get metadata for a remote from the current display
   * @param {string} remoteName - Name of the remote
   * @returns {Object|null} - The metadata object or null
   */
  getRemoteMetadata(remoteName) {
    const { remoteListContainer } = this.controller;
    
    // We can search for metadata in the display elements or ask the main process
    const remoteElements = remoteListContainer.querySelectorAll('.remote-item');
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
   * Browse for a local folder
   */
  async browseLocalFolder() {
    try {
      const result = await ipcRenderer.invoke('browse-local-folder');
      
      // The result is the folder path directly, or null if cancelled
      if (result) {
        const localPathInput = document.getElementById('local-path');
        if (localPathInput) {
          localPathInput.value = result;
        }
      }
    } catch (error) {
      console.error('Error browsing for local folder:', error);
      this.controller.statusElement.textContent = `Error: ${error.message}`;
    }
  }

  /**
   * Confirm and save the subfolder setting
   */
  confirmSubfolderSetting() {
    const { currentSubfolderRemote, subfolderPathInput, statusElement, dialogManager } = this.controller;
    
    if (!currentSubfolderRemote) {
      statusElement.textContent = "No remote selected for subfolder setting";
      dialogManager.hideSubfolderDialog();
      return;
    }
    
    const subfolder = subfolderPathInput.value.trim();
    
    // Send to main process
    statusElement.textContent = `Setting subfolder for ${currentSubfolderRemote}...`;
    ipcRenderer.send("set-subfolder", {
      remoteName: currentSubfolderRemote,
      subfolder: subfolder
    });
    
    dialogManager.hideSubfolderDialog();
  }

  /**
   * Use the default rclone path
   */
  handleDefaultRclonePath() {
    this.controller.rclonePathInput.value = '/usr/local/bin/rclone';
    this.saveRclonePath();
  }

  /**
   * Save the rclone path
   */
  async saveRclonePath() {
    const { rclonePathInput, statusElement, dialogManager } = this.controller;
    const rclonePath = rclonePathInput.value.trim();
    
    if (!rclonePath) {
      statusElement.textContent = "Please enter a valid rclone path";
      return;
    }
    
    statusElement.textContent = "Validating rclone path...";
    
    const isValid = await ipcRenderer.invoke('validate-rclone-path', rclonePath);
    
    if (isValid) {
      statusElement.textContent = "Rclone path set successfully!";
      dialogManager.hideRcloneSetupDialog();
      this.refreshRemotesList();
    } else {
      statusElement.textContent = "Invalid rclone path. Please check and try again.";
    }
  }

  /**
   * Confirm the creation of a new remote
   */
  confirmRemoteCreation() {
    const { 
      remoteNameInput, 
      statusElement, 
      currentProvider, 
      providers, 
      dialogManager 
    } = this.controller;
    
    const remoteName = remoteNameInput.value.trim();
    
    if (!remoteName) {
      statusElement.textContent = "Please enter a remote name";
      return;
    }
    
    const providerType = providers.get(currentProvider);
    if (!providerType) {
      statusElement.textContent = "Invalid provider type";
      return;
    }
    
    // Check for local path if local storage is selected
    let localPath = '';
    if (currentProvider === 'local') {
      const localPathInput = document.getElementById('local-path');
      localPath = localPathInput.value.trim();
      
      if (!localPath) {
        statusElement.textContent = "Please enter a local folder path";
        return;
      }
    }
    
    statusElement.textContent = "Starting configuration...";
    this.disableProviderButtons(true);
    
    // Only show loading indicator for cloud providers (not local)
    // This prevents the loading overlay from blocking file dialogs
    if (currentProvider !== 'local') {
      this.controller.showLoading("Configuring remote. This may take a moment...");
    }
    
    ipcRenderer.send("configure-remote", {
      name: remoteName,
      provider: providerType,
      localPath: localPath
    });
    
    dialogManager.hideRemoteDialog();
  }

  /**
   * Refresh the list of remotes
   * Also kills any zombie rclone processes
   */
  refreshRemotesList() {
    const { statusElement, reloadButton } = this.controller;
    statusElement.textContent = "Cleaning up processes and loading remotes list...";
    reloadButton.disabled = true;
    this.controller.showLoading("Loading remotes...");
    
    // Clean up zombie rclone processes first
    ipcRenderer.send("cleanup-zombie-rclone");
    
    // Set up one-time listener for cleanup completion
    ipcRenderer.once("cleanup-complete", () => {
      // Now load the remotes list
      ipcRenderer.send("list-remotes");
    });
  }

  /**
   * Handle remote selection
   * @param {string} remoteName - The name of the remote
   */
  handleRemoteClick(remoteName) {
    const { remoteListContainer } = this.controller;
    
    // Remove previous selection
    const previousSelected = remoteListContainer.querySelector('.selected');
    if (previousSelected) {
      previousSelected.classList.remove('selected');
    }
    
    // Add selection to clicked remote
    const remoteElements = remoteListContainer.querySelectorAll('.remote-item');
    for (const element of remoteElements) {
      // Get the text content but ignore any nested subfolder spans
      const nameElement = element.querySelector('.remote-item-name');
      const nameText = nameElement ? nameElement.childNodes[0].textContent.trim() : '';
      
      if (nameText === remoteName) {
        element.classList.add('selected');
        break;
      }
    }
    
    this.controller.selectedRemote = remoteName;
    const remoteStatusElement = document.getElementById('remote-status');
    if (remoteStatusElement) {
      remoteStatusElement.textContent = `Selected remote: ${remoteName}`;
    }
  }

  /**
   * Update the list of remotes in the UI
   * @param {Object} data - The data containing remotes and metadata
   */
  updateRemotesList(data) {
    const { 
      remoteListContainer, 
      statusElement, 
      selectedRemote,
      reloadButton
    } = this.controller;
    
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
    this.controller.hideLoading();
    
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
      remoteListContainer.innerHTML = '';
      remoteListContainer.appendChild(remotesList);
      
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
        
        // Name click handler
        item.querySelector('.remote-item-name').addEventListener('click', () => {
          this.handleRemoteClick(nameText);
        });

        // Folder button handler for subfolder restriction
        item.querySelector('.action-icon.folder').addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          // Auto-select the remote if not already selected
          if (this.controller.selectedRemote !== nameText) {
            this.handleRemoteClick(nameText);
          }
          this.controller.dialogManager.showSubfolderDialog(nameText);
        });

        // Check button handler
        item.querySelector('.action-icon.check').addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          // Auto-select the remote if not already selected
          if (this.controller.selectedRemote !== nameText) {
            this.handleRemoteClick(nameText);
          }
          statusElement.textContent = "Testing remote connection...";
          remoteListContainer.classList.add('loading');
          this.controller.showLoading("Testing remote connection...");
          
          // Get the checkbox value
          const useLsCommandCheckbox = document.getElementById('use-ls-command-cloud');
          const useLsCommand = useLsCommandCheckbox && useLsCommandCheckbox.checked;
          
          // Send the remote name and checkbox value
          ipcRenderer.send("check-remote", {
            remoteName: nameText,
            useLsCommand: useLsCommand
          });
        });

        // Delete button handler
        item.querySelector('.action-icon.delete').addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          // Auto-select the remote if not already selected
          if (this.controller.selectedRemote !== nameText) {
            this.handleRemoteClick(nameText);
          }
          statusElement.textContent = `Deleting remote ${nameText}...`;
          this.controller.showLoading(`Deleting remote ${nameText}...`);
          ipcRenderer.send("delete-remote", nameText);
        });
      });
      
      // Reselect previously selected remote
      if (selectedRemote) {
        // Get the list of actual remote names (handling both array and object formats)
        const remoteNames = Array.isArray(remotes) 
          ? remotes 
          : (remotes.remotes || []);
        
        // Check if our selected remote is still in the list
        let found = false;
        remoteNames.forEach(remoteName => {
          // Clean the name to compare with our stored selection
          if (typeof remoteName === 'string' && remoteName.trim() === selectedRemote) {
            found = true;
            this.handleRemoteClick(selectedRemote);
          }
        });
        
        if (!found) {
          this.controller.selectedRemote = null;
        }
      }
    } else {
      remoteListContainer.innerHTML = '<div class="no-remotes">No remotes configured</div>';
      this.controller.selectedRemote = null;
    }
    
    // Update status
    statusElement.textContent = remotes.length > 0 
      ? "Remotes list loaded successfully." 
      : "No remotes configured. Add a new remote to get started.";
    
    reloadButton.disabled = false;
  }

  /**
   * Display the remote status information
   * @param {Object} result - The remote status result
   */
  displayRemoteStatus(result) {
    const { remoteListContainer } = this.controller;
    remoteListContainer.classList.remove('loading');
    this.controller.hideLoading();
    
    // Get the remote status container and elements
    const remoteStatusContainer = document.getElementById('remote-status-container');
    const remoteStatusHeader = remoteStatusContainer?.querySelector('.remote-status-header');
    const remoteStatusElement = document.getElementById('remote-status');
    
    if (!remoteStatusContainer || !remoteStatusElement) return;
    
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
    const { statusElement } = this.controller;
    statusElement.textContent = message;
    this.controller.hideLoading();
    
    if (success) {
      this.controller.selectedRemote = null;
      // Refresh the remotes list
      this.refreshRemotesList();
    }
  }

  /**
   * Update the configuration status message
   * @param {string} message - The status message
   */
  updateConfigStatus(message) {
    const { statusElement } = this.controller;
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
    
    statusElement.textContent = cleanMessage;
  }

  /**
   * Disable/enable all provider buttons
   * @param {boolean} disabled - Whether to disable the buttons
   */
  disableProviderButtons(disabled) {
    const { addStorageButton, storageTypeSelect } = this.controller;
    
    if (addStorageButton) {
      addStorageButton.disabled = disabled;
    }
    if (storageTypeSelect) {
      storageTypeSelect.disabled = disabled;
    }
  }

  /**
   * Enable all provider buttons
   */
  enableProviderButtons() {
    this.disableProviderButtons(false);
  }
}

// Export the module
module.exports = RemoteManager;