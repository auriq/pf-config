const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    // App configuration
    getConfig: () => ipcRenderer.invoke('get-config'),
    updateConfig: (config) => ipcRenderer.invoke('update-config', config),

    // App control
    exitApp: () => ipcRenderer.invoke('exit-app'),

    // rclone operations
    executeRclone: (command, args) => ipcRenderer.invoke('execute-rclone', command, args),
    cleanupRclone: () => ipcRenderer.invoke('cleanup-rclone'),

    // Script execution
    executeScript: (scriptPath, args) => ipcRenderer.invoke('execute-script', scriptPath, args),

    // File operations
    openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),
    readLog: (logName) => ipcRenderer.invoke('read-log', logName),
    readConfigFile: (configName) => ipcRenderer.invoke('read-config-file', configName),
    writeConfigFile: (configName, content) => ipcRenderer.invoke('write-config-file', configName, content),
    copyConfigFile: (sourcePath, configName) => ipcRenderer.invoke('copy-config-file', sourcePath, configName),

    // Remote metadata operations
    readRemoteMetadata: () => ipcRenderer.invoke('read-remote-metadata'),
    updateRemoteMetadata: (remoteName, metadata) => ipcRenderer.invoke('update-remote-metadata', remoteName, metadata),
    deleteRemoteMetadata: (remoteName) => ipcRenderer.invoke('delete-remote-metadata', remoteName),

    // Cloud configuration
    addCloud: async (remoteName, type) => {
      try {
        // Clean up any lingering rclone processes first
        await ipcRenderer.invoke('cleanup-rclone');

        const config = await ipcRenderer.invoke('get-config');
        const configPath = `${config.workspace_dir}/cloud.conf`;
        const args = ['config', 'create', remoteName, type, '--config', configPath];

        const result = await ipcRenderer.invoke('execute-rclone', 'config', args);

        // If the operation failed, clean up any lingering processes
        if (!result.success) {
          await ipcRenderer.invoke('cleanup-rclone');
        }

        return result;
      } catch (error) {
        // Clean up on error
        await ipcRenderer.invoke('cleanup-rclone');
        throw error;
      }
    },

    listCloud: async () => {
      const configContent = await ipcRenderer.invoke('read-config-file', 'cloud');
      if (!configContent.success) {
        return { success: false, remotes: [] };
      }

      // Parse the config file to extract remote names
      const remotes = [];
      const lines = configContent.content.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split('\n');
      for (const line of lines) {
        if (line.startsWith('[') && line.endsWith(']')) {
          remotes.push(line.substring(1, line.length - 1));
        }
      }

      return { success: true, remotes };
    },

    checkRemote: async (remoteName, listFiles = false) => {
      try {
        // Clean up any lingering rclone processes first
        await ipcRenderer.invoke('cleanup-rclone');

        const config = await ipcRenderer.invoke('get-config');
        const configPath = `${config.workspace_dir}/cloud.conf`;

        // Get metadata for this remote
        const metadataResult = await ipcRenderer.invoke('read-remote-metadata');
        let path = `${remoteName}:`;

        if (metadataResult.success && metadataResult.metadata[remoteName] && metadataResult.metadata[remoteName].subfolder) {
          const subfolder = metadataResult.metadata[remoteName].subfolder;
          path = `${remoteName}:${subfolder}`;
        }

        // Use ls command with max-depth if listFiles is true, otherwise use lsd
        const command = listFiles ? 'ls' : 'lsd';
        const args = [command, path, '--config', configPath];

        // Add max-depth parameter if using ls
        if (listFiles) {
          args.push('--max-depth');
          args.push('1');
        }

        const result = await ipcRenderer.invoke('execute-rclone', command, args);

        // If the operation failed, clean up any lingering processes
        if (!result.success) {
          await ipcRenderer.invoke('cleanup-rclone');
        }

        return result;
      } catch (error) {
        // Clean up on error
        await ipcRenderer.invoke('cleanup-rclone');
        throw error;
      }
    },

    deleteRemote: async (remoteName) => {
      const configContent = await ipcRenderer.invoke('read-config-file', 'cloud');
      if (!configContent.success) {
        return { success: false, error: 'Could not read cloud configuration' };
      }

      // Remove the remote section from the config file
      let inRemoteSection = false;
      let remoteFound = false;
      const lines = configContent.content.split('\n');
      const newLines = [];

      for (const line of lines) {
        if (line.trim() === `[${remoteName}]`) {
          inRemoteSection = true;
          remoteFound = true;
          continue;
        }

        if (inRemoteSection && line.startsWith('[')) {
          inRemoteSection = false;
        }

        if (!inRemoteSection) {
          newLines.push(line);
        }
      }

      if (!remoteFound) {
        return { success: false, error: 'Remote not found' };
      }

      // Delete metadata for this remote
      await ipcRenderer.invoke('delete-remote-metadata', remoteName);

      // Clean up any lingering rclone processes
      await ipcRenderer.invoke('cleanup-rclone');

      // Write the updated config file
      return ipcRenderer.invoke('write-config-file', 'cloud', newLines.join('\n'));
    },

    // PageFinder configuration
    testPageFinderConnection: async (isEnableFileList = false) => {
      try {
        // Clean up any lingering rclone processes first
        await ipcRenderer.invoke('cleanup-rclone');

        const config = await ipcRenderer.invoke('get-config');
        const pfConfig = await ipcRenderer.invoke('read-config-file', 'pf');

        if (!pfConfig.success) {
          return { success: false, error: 'Could not read PageFinder configuration' };
        }

        // Extract PageFinder name, bucket, and prefix
        const lines = pfConfig.content.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split('\n');
        let pfName = '';
        let bucket = '';
        let prefix = '';

        for (const line of lines) {
          if (line.startsWith('[') && line.endsWith(']')) {
            pfName = line.substring(1, line.length - 1);
          } else if (line.includes('bucket')) {
            bucket = line.split('=')[1].trim();
          } else if (line.includes('prefix')) {
            prefix = line.split('=')[1].trim();
          }
        }

        if (!pfName || !bucket) {
          return { success: false, error: 'Invalid PageFinder configuration' };
        }

        // Construct the path
        let path = `${pfName}:${bucket}`;
        if (prefix) {
          path += `/${prefix}`;
        }

        // Test the connection
        const configPath = `${config.workspace_dir}/pf.conf`;
        const args = ['lsd', path];
        if (isEnableFileList) {
          args.push('--max-depth');
          args.push('1');
        }
        args.push('--config');
        args.push(configPath);

        const result = await ipcRenderer.invoke('execute-rclone', 'lsd', args);

        // If the operation failed, clean up any lingering processes
        if (!result.success) {
          await ipcRenderer.invoke('cleanup-rclone');
        }

        return result;
      } catch (error) {
        // Clean up on error
        await ipcRenderer.invoke('cleanup-rclone');
        throw error;
      }
    },

    // Purge operations
    runPurgeTest: async () => {
      const config = await ipcRenderer.invoke('get-config');
      const scriptPath = process.platform === 'win32' ? 'scripts/purge-workspace.ps1' : 'scripts/purge-workspace.sh';
      return ipcRenderer.invoke('execute-script', scriptPath, []);
    },

    runPurgeExec: async () => {
      const config = await ipcRenderer.invoke('get-config');
      const scriptPath = process.platform === 'win32' ? 'scripts/purge-workspace.ps1' : 'scripts/purge-workspace.sh';
      return ipcRenderer.invoke('execute-script', scriptPath, ['-e']);
    },

    // Sync operations
    runSyncTest: async () => {
      const config = await ipcRenderer.invoke('get-config');
      const scriptPath = process.platform === 'win32' ? 'scripts/sync-workspace.ps1' : 'scripts/sync-workspace.sh';
      return ipcRenderer.invoke('execute-script', scriptPath, []);
    },

    runSyncExec: async () => {
      const config = await ipcRenderer.invoke('get-config');
      const scriptPath = process.platform === 'win32' ? 'scripts/sync-workspace.ps1' : 'scripts/sync-workspace.sh';
      return ipcRenderer.invoke('execute-script', scriptPath, ['-e']);
    },

    // Schedule operations
    setupSchedule: async (time) => {
      // Validate time format (HH:MM)
      const timePattern = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
      if (!timePattern.test(time)) {
        return { success: false, error: 'Invalid time format. Please use HH:MM in 24-hour format.' };
      }

      try {
        // Use the relative path to the setup-sync-cron.sh script
        const scriptPath = process.platform === 'win32' ? 'scripts/setup-sync-cron.ps1' : 'scripts/setup-sync-cron.sh';

        // Execute the script with the time parameter
        const result = await ipcRenderer.invoke('execute-script', scriptPath, [time]);

        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  }
);