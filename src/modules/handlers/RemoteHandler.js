/**
 * Remote Handler Module
 * Handles remote-related IPC events
 */

const { ipcMain } = require("electron");
const path = require("path");
const fs = require('fs-extra');

/**
 * Class to handle remote-related IPC events
 */
class RemoteHandler {
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
   * Set up all remote-related event handlers
   */
  setupEventHandlers() {
    // Handle remote check request
    ipcMain.on("check-remote", async (event, { remoteName, useLsCommand }) => {
      try {
        event.reply("config-status", `Checking remote ${remoteName}...`);
        const result = await this.configManager.checkRemote(remoteName, { useLsCommand });
        const metadata = this.configManager.getRemoteMetadata(remoteName);
        
        event.reply("remote-status", {
          name: remoteName,
          ...result,
          metadata: metadata
        });
      } catch (error) {
        event.reply("config-status", `Failed to check remote: ${error}`);
      }
    });

    // Handle list remotes request
    ipcMain.on("list-remotes", async (event) => {
      try {
        const remotes = await this.configManager.listRemotes();
        const metadata = this.configManager.getAllRemotesMetadata();
        event.reply("remotes-list", { remotes, metadata });
      } catch (error) {
        console.error("Error listing remotes:", error);
        event.reply("remotes-list", { remotes: [], metadata: {} });
      }
    });

    // Handle delete remote request
    ipcMain.on("delete-remote", async (event, remoteName) => {
      try {
        console.log(`Deleting remote ${remoteName}...`);
        
        // Delete the remote configuration
        await this.configManager.deleteRemote(remoteName);
        console.log(`Successfully deleted remote configuration for ${remoteName}`);
        
        // Also delete any metadata for this remote
        const metadataDeleted = this.configManager.deleteRemoteMetadata(remoteName);
        if (!metadataDeleted) {
          console.warn(`Warning: Failed to delete metadata for remote ${remoteName}. This may cause orphaned metadata.`);
        }
        
        event.reply("delete-status", {
          success: true,
          message: `Remote ${remoteName} deleted successfully`
        });
        
        // Refresh the remotes list after deletion
        const remotes = await this.configManager.listRemotes();
        const metadata = this.configManager.getAllRemotesMetadata();
        event.reply("remotes-list", { remotes, metadata });
        
        // Update the sync.sh script with the new configuration
        this.app.updateSyncScript();
      } catch (error) {
        console.error("Error deleting remote:", error);
        event.reply("delete-status", {
          success: false,
          message: `Failed to delete remote: ${error.message}`
        });
      }
    });
  }
}

module.exports = RemoteHandler;