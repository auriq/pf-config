/**
 * Test Manager Module
 * Handles connection testing between cloud storage and PageFinder
 */

const { ipcRenderer } = require("electron");

class TestManager {
  /**
   * Initialize the test manager
   * @param {Object} controller - Reference to the main UIController
   */
  constructor(controller) {
    this.controller = controller;
    
    // Set up the event listener for the Sync Now button
    if (this.controller.runSyncNowButton) {
      this.controller.runSyncNowButton.addEventListener("click", () => this.runSync());
    }
  }

  /**
   * Test connection between cloud storage and PageFinder
   * Performs a comprehensive test of cloud storage and PageFinder connectivity
   */
  async testConnection() {
    try {
      const {
        remoteListContainer,
        runTestConnectionButton,
        testConnectionStatusElement,
        testStatusIcon,
        testConnectionDetailsElement
      } = this.controller;
      
      // Verify that both cloud and PageFinder configs are set up
      const remoteItems = remoteListContainer.querySelectorAll('.remote-item');
      if (remoteItems.length === 0) {
        testConnectionStatusElement.textContent = "Error: No cloud storage configured. Please add at least one storage provider.";
        testConnectionStatusElement.className = "status-message error";
        
        // Add error mark to the icon
        testStatusIcon.innerHTML = "✗";
        testStatusIcon.className = "status-icon error";
        return;
      }
      
      // Check if PageFinder config is set up
      // The check-pf-config-exists handler returns a boolean, not an object
      const pfConfigExists = await ipcRenderer.invoke('check-pf-config-exists');
      if (!pfConfigExists) {
        testConnectionStatusElement.textContent = "Error: PageFinder configuration is not set up. Please configure PageFinder first.";
        testConnectionStatusElement.className = "status-message error";
        
        // Add error mark to the icon
        testStatusIcon.innerHTML = "✗";
        testStatusIcon.className = "status-icon error";
        return;
      }
      
      // Disable the test button during testing
      runTestConnectionButton.disabled = true;
      
      // Show loading indicator
      testConnectionStatusElement.textContent = "Testing connection...";
      testConnectionStatusElement.className = "status-message";
      testConnectionDetailsElement.textContent = "Running connection tests, please wait...";
      
      // Set the context for test connection - needed for currentProvider
      this.controller.currentProvider = 'test';
      
      // Call showLoading on the controller directly
      this.controller.showLoading("Testing connection...");
      
      // Add icon indicator
      testStatusIcon.innerHTML = "⟳";
      testStatusIcon.className = "status-icon loading";
      
      // Request test execution
      const result = await ipcRenderer.invoke('test-connection');
      
      // Hide loading indicator and reset the context
      this.controller.hideLoading();
      
      // Reset the currentProvider after the operation
      this.controller.currentProvider = null;
      
      // Re-enable test button
      runTestConnectionButton.disabled = false;
      
      // Update status based on result
      if (result.success) {
        // Check for token errors in the output
        const hasTokenError = this.checkForTokenErrors(result);
        
        if (hasTokenError) {
          testConnectionStatusElement.textContent = "Connection test failed: Authentication token expired or invalid. Please reconfigure the remote.";
          testConnectionStatusElement.className = "status-message error";
          
          // Hide the Sync Now button when there are token errors
          if (this.controller.runSyncNowButton) {
            this.controller.runSyncNowButton.style.display = 'none';
          }
          
          // Add error mark to the icon
          testStatusIcon.innerHTML = "✗";
          testStatusIcon.className = "status-icon error";
        } else {
          testConnectionStatusElement.textContent = "Connection test completed successfully!";
          testConnectionStatusElement.className = "status-message success";
          
          // Enable the Sync Now button ONLY when the test is completely successful
          if (this.controller.runSyncNowButton) {
            this.controller.runSyncNowButton.style.display = 'inline-block';
          }
          
          // Add success mark to the icon
          testStatusIcon.innerHTML = "✓";
          testStatusIcon.className = "status-icon success";
        }
      } else {
        testConnectionStatusElement.textContent = result.message || "Connection test failed.";
        testConnectionStatusElement.className = "status-message error";
        
        // Hide the Sync Now button when the test fails
        if (this.controller.runSyncNowButton) {
          this.controller.runSyncNowButton.style.display = 'none';
        }
        
        // Add error mark to the icon
        testStatusIcon.innerHTML = "✗";
        testStatusIcon.className = "status-icon error";
      }
      
      // Format the results for display
      let detailsOutput = "Sync Test Results:\n\n";
      
      if (result.syncOutput) {
        // Display the sync.sh output directly
        detailsOutput += "Running sync.sh with verbose flag:\n";
        detailsOutput += "----------------------------------------\n";
        
        // Sanitize the output to remove any potential tokens
        const sanitizedOutput = this.sanitizeOutput(result.syncOutput);
        detailsOutput += sanitizedOutput;
      } else {
        detailsOutput += "No sync test output available.";
      }
      
      testConnectionDetailsElement.textContent = detailsOutput;
    } catch (error) {
      console.error('Error testing connections:', error);
      
      const {
        testConnectionStatusElement,
        testStatusIcon,
        testConnectionDetailsElement,
        runTestConnectionButton
      } = this.controller;
      
      testConnectionStatusElement.textContent = `Error: ${error.message}`;
      testConnectionStatusElement.className = "status-message error";
      runTestConnectionButton.disabled = false;
      
      // Make sure to call hideLoading directly on the controller and reset currentProvider
      this.controller.hideLoading();
      this.controller.currentProvider = null;
      
      // Add error mark to the icon
      testStatusIcon.innerHTML = "✗";
      testStatusIcon.className = "status-icon error";
      
      testConnectionDetailsElement.textContent = "Test failed with error: " + error.message;
    }
  }
  
  /**
   * Run the sync.sh script with the --exec flag to actually perform the synchronization
   */
  async runSync() {
    try {
      const {
        testConnectionStatusElement,
        testConnectionDetailsElement,
        runSyncNowButton
      } = this.controller;
      
      // Disable the button during sync
      if (runSyncNowButton) {
        runSyncNowButton.disabled = true;
      }
      
      // Update status
      testConnectionStatusElement.textContent = "Executing sync operation...";
      testConnectionStatusElement.className = "status-message";
      testConnectionDetailsElement.textContent = "Running sync script with -e flag to actually perform file operations. This will copy your files to PageFinder. Please wait...";
      
      // Set the context for test connection
      this.controller.currentProvider = 'test';
      
      // Show loading indicator
      this.controller.showLoading("Running sync operation...");
      
      // Execute the sync.sh script with the --exec flag
      const result = await ipcRenderer.invoke('run-sync-with-exec');
      
      // Hide loading indicator and reset currentProvider
      this.controller.hideLoading();
      this.controller.currentProvider = null;
      
      // Re-enable the button
      if (runSyncNowButton) {
        runSyncNowButton.disabled = false;
      }
      
      // Update status based on result
      if (result.success) {
        testConnectionStatusElement.textContent = "Sync operation completed successfully!";
        testConnectionStatusElement.className = "status-message success";
      } else {
        testConnectionStatusElement.textContent = result.message || "Sync operation failed.";
        testConnectionStatusElement.className = "status-message error";
      }
      
      // Format the results for display
      let detailsOutput = "Sync Operation Results:\n\n";
      
      if (result.output) {
        // Sanitize the output to remove any potential tokens
        const sanitizedOutput = this.sanitizeOutput(result.output);
        detailsOutput += sanitizedOutput;
      } else {
        detailsOutput += "No output available.";
      }
      
      testConnectionDetailsElement.textContent = detailsOutput;
    } catch (error) {
      console.error('Error running sync operation:', error);
      
      const {
        testConnectionStatusElement,
        testConnectionDetailsElement,
        runSyncNowButton
      } = this.controller;
      
      testConnectionStatusElement.textContent = `Error: ${error.message}`;
      testConnectionStatusElement.className = "status-message error";
      
      if (runSyncNowButton) {
        runSyncNowButton.disabled = false;
      }
      
      // Make sure to clean up even in case of errors
      this.controller.hideLoading();
      this.controller.currentProvider = null;
      
      testConnectionDetailsElement.textContent = "Sync operation failed with error: " + error.message;
    }
  }
  
  /**
   * Sanitize output to remove any sensitive information like tokens
   * @param {string} output - The raw output to sanitize
   * @returns {string} - The sanitized output with tokens redacted
   */
  sanitizeOutput(output) {
    if (!output) return '';
    
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
    let sanitized = output;
    for (const { pattern, replacement } of sensitivePatterns) {
      sanitized = sanitized.replace(pattern, replacement);
    }
    
    return sanitized;
  }

  /**
   * Check for token expiration or authentication errors in the test results
   * @param {Object} result - The test result object
   * @returns {boolean} - True if token errors were found, false otherwise
   */
  checkForTokenErrors(result) {
    if (!result || !result.results) return false;
    
    // Common error patterns that indicate authentication/token issues
    const tokenErrorPatterns = [
      /failed to authenticate/i,
      /token expired/i,
      /token has expired/i,
      /invalid token/i,
      /auth failure/i,
      /authentication failed/i,
      /oauth2: token expired/i,
      /access denied/i,
      /permission denied/i,
      /Could not authenticate/i,
      /not authorized/i,
      /authorization required/i,
      /401 Unauthorized/i,
      /403 Forbidden/i
    ];
    
    // Check each test result for token errors
    for (const testResult of result.results) {
      const output = testResult.output || '';
      
      // Check if any error pattern matches the output
      for (const pattern of tokenErrorPatterns) {
        if (pattern.test(output)) {
          console.log(`Token error detected: ${pattern}`);
          return true;
        }
      }
    }
    
    return false;
  }
}

// Export the module
module.exports = TestManager;