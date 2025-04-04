/**
 * PageFinder Manager Module
 * Handles all PageFinder configuration operations
 */

const { ipcRenderer } = require("electron");

class PageFinderManager {
  /**
   * Initialize the PageFinder manager
   * @param {Object} controller - Reference to the main UIController
   */
  constructor(controller) {
    this.controller = controller;
  }

  /**
   * Check if the PageFinder config file exists
   */
  async checkPFConfigExists() {
    try {
      const {
        pfConfigPathInput,
        pfConfigStatusElement,
        pfConfigStatusIcon,
        validatePFConfigButton
      } = this.controller;
      
      // The main process returns a boolean (not an object with exists property)
      // indicating if the file exists at ~/.config/pf-config/pf.conf
      const exists = await ipcRenderer.invoke('check-pf-config-exists');
      
      if (exists) {
        // Don't show the path in the input field when config is found
        if (pfConfigPathInput) {
          pfConfigPathInput.value = "";
        }
        
        if (pfConfigStatusElement) {
          pfConfigStatusElement.textContent = "PageFinder configuration found.";
          pfConfigStatusElement.className = "status-message success";
        }
        
        if (pfConfigStatusIcon) {
          pfConfigStatusIcon.innerHTML = "✓";
          pfConfigStatusIcon.className = "status-icon success";
        }
        
        // Enable the validate button
        if (validatePFConfigButton) {
          validatePFConfigButton.disabled = false;
        }
      } else {
        if (pfConfigStatusElement) {
          pfConfigStatusElement.textContent = "PageFinder configuration not found. Please browse for your config file.";
          pfConfigStatusElement.className = "status-message";
        }
        
        if (pfConfigStatusIcon) {
          pfConfigStatusIcon.innerHTML = "";
          pfConfigStatusIcon.className = "status-icon";
        }
      }
    } catch (error) {
      console.error('Error checking PageFinder config:', error);
      
      if (this.controller.pfConfigStatusElement) {
        this.controller.pfConfigStatusElement.textContent = `Error: ${error.message}`;
        this.controller.pfConfigStatusElement.className = "status-message error";
      }
      
      if (this.controller.pfConfigStatusIcon) {
        this.controller.pfConfigStatusIcon.innerHTML = "✗";
        this.controller.pfConfigStatusIcon.className = "status-icon error";
      }
    }
  }

  /**
   * Browse for PageFinder config file
   */
  async browsePFConfig() {
    try {
      const {
        pfConfigPathInput,
        pfConfigStatusElement,
        validatePFConfigButton
      } = this.controller;
      
      // This returns the file path directly, not a {success, filePath} object
      const filePath = await ipcRenderer.invoke('browse-pf-config');
      
      // If a file was selected (not canceled)
      if (filePath) {
        if (pfConfigPathInput) {
          pfConfigPathInput.value = filePath;
        }
        
        if (pfConfigStatusElement) {
          pfConfigStatusElement.textContent = "PageFinder configuration selected. Click Validate to save.";
          pfConfigStatusElement.className = "status-message";
        }
        
        // Enable the validate button
        if (validatePFConfigButton) {
          validatePFConfigButton.disabled = false;
        }
      }
    } catch (error) {
      console.error('Error browsing for PageFinder config:', error);
      
      if (this.controller.pfConfigStatusElement) {
        this.controller.pfConfigStatusElement.textContent = `Error: ${error.message}`;
        this.controller.pfConfigStatusElement.className = "status-message error";
      }
    }
  }

  /**
   * Validate PageFinder config file
   */
  async validatePFConfig() {
    try {
      const {
        pfConfigPathInput,
        pfConfigStatusElement,
        pfConfigStatusIcon,
        validatePFConfigButton,
        pfUsernameInput,
        pfBucketInput,
        pfPrefixInput
      } = this.controller;
      
      // Get the file path from the input field
      const filePath = pfConfigPathInput ? pfConfigPathInput.value : '';
      
      if (!filePath) {
        if (pfConfigStatusElement) {
          pfConfigStatusElement.textContent = "Please select a PageFinder configuration file first.";
          pfConfigStatusElement.className = "status-message error";
        }
        return;
      }
      
      if (pfConfigStatusElement) {
        pfConfigStatusElement.textContent = "Validating config file...";
      }
      
      if (validatePFConfigButton) {
        validatePFConfigButton.disabled = true;
      }
      
      // IMPORTANT: The main process expects a file path that exists on the filesystem
      // Send the full path to validate-pf-config
      const result = await ipcRenderer.invoke('validate-pf-config', filePath);
      
      if (validatePFConfigButton) {
        validatePFConfigButton.disabled = false;
      }
      
      if (result.success) {
        if (pfConfigStatusElement) {
          pfConfigStatusElement.textContent = "PageFinder configuration validated and saved.";
          pfConfigStatusElement.className = "status-message success";
        }
        
        if (pfConfigStatusIcon) {
          pfConfigStatusIcon.innerHTML = "✓";
          pfConfigStatusIcon.className = "status-icon success";
        }
        
        // Update the connection fields
        if (pfUsernameInput && result.username) {
          pfUsernameInput.value = result.username;
        }
        
        if (pfBucketInput && result.bucket) {
          pfBucketInput.value = result.bucket;
        }
        
        if (pfPrefixInput && result.prefix) {
          pfPrefixInput.value = result.prefix;
        }
        
        // Enable the Check Connection button - IMPORTANT!
        if (this.controller.checkPFConnectionButton) {
          this.controller.checkPFConnectionButton.disabled = false;
        }
        
        // Critical: Check if the config file exists after validation to refresh UI
        await this.checkPFConfigExists();
      } else {
        if (pfConfigStatusElement) {
          pfConfigStatusElement.textContent = result.message || "Failed to validate PageFinder configuration.";
          pfConfigStatusElement.className = "status-message error";
        }
        
        if (pfConfigStatusIcon) {
          pfConfigStatusIcon.innerHTML = "✗";
          pfConfigStatusIcon.className = "status-icon error";
        }
      }
    } catch (error) {
      console.error('Error validating PageFinder config:', error);
      
      if (this.controller.pfConfigStatusElement) {
        this.controller.pfConfigStatusElement.textContent = `Error: ${error.message}`;
        this.controller.pfConfigStatusElement.className = "status-message error";
      }
      
      if (this.controller.validatePFConfigButton) {
        this.controller.validatePFConfigButton.disabled = false;
      }
      
      if (this.controller.pfConfigStatusIcon) {
        this.controller.pfConfigStatusIcon.innerHTML = "✗";
        this.controller.pfConfigStatusIcon.className = "status-icon error";
      }
    }
  }

  /**
   * Check PageFinder connection
   */
  async checkPFConnection() {
    try {
      const {
        pfConnectionStatusElement,
        checkPFConnectionButton,
        pfConnectionDetailsElement,
        pfConnectionStatusIcon,
        useLsCommandPfCheckbox
      } = this.controller;
      
      if (pfConnectionStatusElement) {
        pfConnectionStatusElement.textContent = "Checking connection...";
        pfConnectionStatusElement.className = "status-message";
      }
      
      if (checkPFConnectionButton) {
        checkPFConnectionButton.disabled = true;
      }
      
      if (pfConnectionDetailsElement) {
        pfConnectionDetailsElement.textContent = "Checking connection, please wait...";
      }
      
      // In the PageFinder context, we should always use 'pagefinder' as the provider
      // This is needed to prevent errors when accessing 'currentProvider' in showLoading and hideLoading
      this.controller.currentProvider = 'pagefinder';
      
      // IMPORTANT: We need to call showLoading on the controller directly, not use the destructured function
      this.controller.showLoading("Checking PageFinder connection...");
      
      const result = await ipcRenderer.invoke('check-pf-connection', {
        useLsCommand: useLsCommandPfCheckbox && useLsCommandPfCheckbox.checked
      });
      
      // IMPORTANT: We need to call hideLoading on the controller directly, not use the destructured function
      this.controller.hideLoading();
      
      // Reset it back to null after operation is complete
      this.controller.currentProvider = null;
      
      if (checkPFConnectionButton) {
        checkPFConnectionButton.disabled = false;
      }
      
      if (result.success) {
        if (pfConnectionStatusElement) {
          pfConnectionStatusElement.textContent = "Connection successful!";
          pfConnectionStatusElement.className = "status-message success";
        }
        
        if (pfConnectionStatusIcon) {
          pfConnectionStatusIcon.innerHTML = "✓";
          pfConnectionStatusIcon.className = "status-icon success";
        }
        
        // Format details output with config information
        let detailsOutput = "Connection Details (Extracted from Config):\n\n";
        
        // The details may be nested in the result structure
        const details = result.details || {};
        
        // Add remote information
        if (details.remoteName) {
          detailsOutput += `Remote: ${details.remoteName}\n`;
        }
        
        // Add bucket information if available
        if (details.bucket) {
          detailsOutput += `Bucket: ${details.bucket}\n`;
        }
        
        // Add region information if available
        if (details.region) {
          detailsOutput += `Region: ${details.region}\n`;
        }
        
        // Add path information
        if (details.path) {
          detailsOutput += `Path: ${details.path}\n`;
        }
        
        // Add full path information
        if (details.fullPath) {
          detailsOutput += `Full Path: ${details.fullPath}\n`;
        }
        
        // Add access key information (masked for security)
        if (details.accessKey) {
          const maskedKey = details.accessKey.substring(0, 4) + '...' +
                           details.accessKey.substring(details.accessKey.length - 4);
          detailsOutput += `Access Key: ${maskedKey}\n`;
        }
        
        detailsOutput += "\nDirectory Listing:\n";
        detailsOutput += "----------------------------------------\n";
        detailsOutput += details.output || "No files found";
        
        if (pfConnectionDetailsElement) {
          pfConnectionDetailsElement.textContent = detailsOutput;
        }
      } else {
        if (pfConnectionStatusElement) {
          pfConnectionStatusElement.textContent = result.message || "Connection failed.";
          pfConnectionStatusElement.className = "status-message error";
        }
        
        if (pfConnectionStatusIcon) {
          pfConnectionStatusIcon.innerHTML = "✗";
          pfConnectionStatusIcon.className = "status-icon error";
        }
        
        if (pfConnectionDetailsElement) {
          pfConnectionDetailsElement.textContent = "Connection failed: " + (result.message || "Unknown error");
        }
      }
    } catch (error) {
      console.error('Error checking PageFinder connection:', error);
      
      if (this.controller.pfConnectionStatusElement) {
        this.controller.pfConnectionStatusElement.textContent = `Error: ${error.message}`;
        this.controller.pfConnectionStatusElement.className = "status-message error";
      }
      
      if (this.controller.checkPFConnectionButton) {
        this.controller.checkPFConnectionButton.disabled = false;
      }
      
      // Add error mark to the icon
      if (this.controller.pfConnectionStatusIcon) {
        this.controller.pfConnectionStatusIcon.innerHTML = "✗";
        this.controller.pfConnectionStatusIcon.className = "status-icon error";
      }
      
      if (this.controller.pfConnectionDetailsElement) {
        this.controller.pfConnectionDetailsElement.textContent = "Connection failed with error: " + error.message;
      }
      
      // Make sure we reset currentProvider and hide loading indicator even in case of error
      this.controller.currentProvider = null;
      this.controller.hideLoading();
    }
  }
}

// Export the module
module.exports = PageFinderManager;