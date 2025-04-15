// Main renderer process script for PageFinder Configuration Utility

// DOM Elements
const navItems = document.querySelectorAll('.nav-item');
const contentSections = document.querySelectorAll('.content-section');
const exitButton = document.getElementById('exit-button');

// Cloud Config Elements
const remoteNameInput = document.getElementById('remote-name');
const remoteTypeSelect = document.getElementById('remote-type');
const addCloudBtn = document.getElementById('add-cloud-btn');
const cloudList = document.getElementById('cloud-list');

// PageFinder Config Elements
const pfConfigPathInput = document.getElementById('pf-config-path');
const browsePfConfigBtn = document.getElementById('browse-pf-config');
const importPfConfigBtn = document.getElementById('import-pf-config');
const testPfConnectionBtn = document.getElementById('test-pf-connection');
const pfConnectionResult = document.getElementById('pf-connection-result');
const purgeTestBtn = document.getElementById('purge-test-btn');
const purgeExecBtn = document.getElementById('purge-exec-btn');
const purgeResult = document.getElementById('purge-result');

// Sync Elements
const syncTestBtn = document.getElementById('sync-test-btn');
const syncExecBtn = document.getElementById('sync-exec-btn');
const syncResult = document.getElementById('sync-result');

// Schedule Elements
const scheduleTimeInput = document.getElementById('schedule-time');
const setupScheduleBtn = document.getElementById('setup-schedule-btn');
const scheduleResult = document.getElementById('schedule-result');
const lastSyncLog = document.getElementById('last-sync-log');
const reloadSyncLogBtn = document.getElementById('reload-sync-log-btn');

// Settings Elements
const rclonePathInput = document.getElementById('rclone-path');
const browseRclonePathBtn = document.getElementById('browse-rclone-path');
const workspaceDirInput = document.getElementById('workspace-dir');
const browseWorkspaceDirBtn = document.getElementById('browse-workspace-dir');
const saveSettingsBtn = document.getElementById('save-settings-btn');

// Modal Elements
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalCancelBtn = document.getElementById('modal-cancel');
const modalConfirmBtn = document.getElementById('modal-confirm');
const modalCloseBtn = document.querySelector('.modal-close');

// Notification container
let notificationContainer;

// Remote metadata
let remoteMetadata = {};

// Maximum number of remotes allowed
const MAX_REMOTES = 3;

// Initialize the application
async function initApp() {
  // Create notification container
  createNotificationContainer();

  // Clean up any lingering rclone processes
  await cleanupRcloneProcesses();

  // Load application configuration
  const config = await window.api.getConfig();

  // Set input values from config
  rclonePathInput.value = config.path_rclone;
  workspaceDirInput.value = config.workspace_dir;


  // Load remote metadata
  await loadRemoteMetadata();

  // Load cloud storage list
  await loadCloudList();

  // Check if PageFinder config exists and disable/enable test button accordingly
  const pfConfig = await window.api.readConfigFile('pf');
  if (pfConfig.success) {
    // Enable test connection button if pf.conf exists
    testPfConnectionBtn.disabled = false;
    purgeTestBtn.disabled = false;
  } else {
    // Disable test connection button if pf.conf doesn't exist
    testPfConnectionBtn.disabled = true;
    purgeTestBtn.disabled = true;
  }

  // Load last sync log if available
  await loadLastSyncLog();
}

// Clean up any lingering rclone processes
async function cleanupRcloneProcesses() {
  try {
    await window.api.cleanupRclone();
    console.log('Cleaned up rclone processes');
  } catch (error) {
    console.error('Error cleaning up rclone processes:', error);
  }
}

// Load remote metadata
async function loadRemoteMetadata() {
  try {
    const result = await window.api.readRemoteMetadata();
    if (result.success) {
      remoteMetadata = result.metadata;
    } else {
      showErrorNotification(`Error loading remote metadata: ${result.error}`);
      remoteMetadata = {};
    }
  } catch (error) {
    showErrorNotification(`Error loading remote metadata: ${error.message}`);
    remoteMetadata = {};
  }
}

// Create notification container
function createNotificationContainer() {
  notificationContainer = document.createElement('div');
  notificationContainer.className = 'notification-container';
  document.body.appendChild(notificationContainer);

  // Add styles for notifications
  const style = document.createElement('style');
  style.textContent = `
    .notification-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
    }

    .notification {
      padding: 12px 20px;
      margin-bottom: 10px;
      border-radius: 4px;
      color: white;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
      animation: slideIn 0.3s ease-out forwards;
      max-width: 300px;
    }

    .notification.success {
      background-color: #27ae60;
    }

    .notification.error {
      background-color: #e74c3c;
    }

    .notification.info {
      background-color: #3498db;
    }

    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

// Navigation
navItems.forEach(item => {
  item.addEventListener('click', () => {
    // Remove active class from all items
    navItems.forEach(navItem => navItem.classList.remove('active'));

    // Add active class to clicked item
    item.classList.add('active');

    // Show corresponding content section
    const sectionId = item.getAttribute('data-section');
    contentSections.forEach(section => {
      section.classList.remove('active');
      if (section.id === sectionId) {
        section.classList.add('active');
      }
    });
  });
});

// Exit button - use the exitApp function to properly terminate all processes
exitButton.addEventListener('click', async () => {
  showInfoNotification('Exiting application...');
  await window.api.exitApp();
});

// Cloud Configuration

// Add cloud storage
addCloudBtn.addEventListener('click', async () => {
  const remoteName = remoteNameInput.value.trim();
  const remoteType = remoteTypeSelect.value;

  if (!remoteName) {
    showErrorNotification('Please enter a name for the remote.');
    return;
  }

  // Show loading state
  addCloudBtn.disabled = true;
  addCloudBtn.textContent = 'Adding...';

  try {
    // Clean up any lingering rclone processes first
    await cleanupRcloneProcesses();

    const result = await window.api.addCloud(remoteName, remoteType);

    if (result.success) {
      // Clear input
      remoteNameInput.value = '';

      // Initialize metadata for this remote
      await window.api.updateRemoteMetadata(remoteName, { type: remoteType });

      // Reload remote metadata
      await loadRemoteMetadata();

      // Reload cloud list
      await loadCloudList();

      showSuccessNotification(`Cloud storage "${remoteName}" added successfully.`);
    } else {
      // Clean up any lingering rclone processes
      await cleanupRcloneProcesses();

      showErrorNotification(`Failed to add cloud storage: ${result.stderr}`);
    }
  } catch (error) {
    // Clean up any lingering rclone processes
    await cleanupRcloneProcesses();

    showErrorNotification(`Error: ${error.message}`);
  } finally {
    // Reset button state
    addCloudBtn.disabled = false;
    addCloudBtn.textContent = 'Add Cloud Storage';

    // Check if we've reached the maximum number of remotes
    checkRemoteLimit();
  }
});

// Check if we've reached the maximum number of remotes
async function checkRemoteLimit() {
  try {
    const result = await window.api.listCloud();

    if (result.success) {
      const remoteCount = result.remotes.length;

      // Create or update the limit message
      let limitMessage = document.getElementById('remote-limit-message');
      if (!limitMessage) {
        limitMessage = document.createElement('div');
        limitMessage.id = 'remote-limit-message';
        limitMessage.className = 'limit-message';

        // Insert after the add button
        addCloudBtn.parentNode.insertBefore(limitMessage, addCloudBtn.nextSibling);
      }

      if (remoteCount >= MAX_REMOTES) {
        // Disable the add button and show the limit message
        addCloudBtn.disabled = true;
        limitMessage.textContent = `Maximum limit of ${MAX_REMOTES} remotes reached.`;
        limitMessage.style.color = '#e74c3c';
        limitMessage.style.marginTop = '10px';
        limitMessage.style.display = 'block';
      } else {
        // Enable the add button and hide the limit message
        addCloudBtn.disabled = false;
        limitMessage.style.display = 'none';
      }
    }
  } catch (error) {
    console.error('Error checking remote limit:', error);
  }
}

// Load cloud storage list
async function loadCloudList() {
  try {
    const result = await window.api.listCloud();

    if (result.success && result.remotes.length > 0) {
      // Clear list
      cloudList.innerHTML = '';

      // Add each remote to the list
      for (const remote of result.remotes) {
        const listItem = document.createElement('div');
        listItem.className = 'list-item';

        const header = document.createElement('div');
        header.className = 'list-item-header';

        const title = document.createElement('div');
        title.className = 'list-item-title';
        title.textContent = remote;

        const actions = document.createElement('div');
        actions.className = 'list-item-actions';

        // Create checkbox for list files option
        const listFilesLabel = document.createElement('label');
        listFilesLabel.className = 'checkbox-label';
        listFilesLabel.style.marginRight = '10px';

        const listFilesCheckbox = document.createElement('input');
        listFilesCheckbox.type = 'checkbox';
        listFilesCheckbox.id = `${remote}-list-files`;

        const listFilesText = document.createTextNode(' List Files');

        listFilesLabel.appendChild(listFilesCheckbox);
        listFilesLabel.appendChild(listFilesText);

        const checkBtn = document.createElement('button');
        checkBtn.className = 'btn btn-secondary';
        checkBtn.textContent = 'Check';
        checkBtn.addEventListener('click', () => {
          const listFiles = listFilesCheckbox.checked;
          checkRemote(remote, listItem, listFiles);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger';  // Changed to danger class
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => deleteRemote(remote));

        actions.appendChild(listFilesLabel);
        actions.appendChild(checkBtn);
        actions.appendChild(deleteBtn);

        header.appendChild(title);
        header.appendChild(actions);

        const content = document.createElement('div');
        content.className = 'list-item-content';

        // Add subfolder input and save button in one row
        const subfolderRow = document.createElement('div');
        subfolderRow.className = 'subfolder-row';

        const subfolderInput = document.createElement('input');
        subfolderInput.type = 'text';
        subfolderInput.placeholder = 'Optional subfolder path';

        // Set subfolder value from metadata if available
        if (remoteMetadata[remote] && remoteMetadata[remote].subfolder) {
          subfolderInput.value = remoteMetadata[remote].subfolder;
        }

        const saveSubfolderBtn = document.createElement('button');
        saveSubfolderBtn.className = 'btn btn-primary';
        saveSubfolderBtn.textContent = 'Save';
        saveSubfolderBtn.addEventListener('click', () => saveSubfolder(remote, subfolderInput.value));

        subfolderRow.appendChild(subfolderInput);
        subfolderRow.appendChild(saveSubfolderBtn);

        // Add result container for rclone output
        const resultContainer = document.createElement('div');
        resultContainer.className = 'result-container';
        resultContainer.id = `${remote}-result`;
        resultContainer.style.display = 'none';
        resultContainer.style.marginTop = '15px';

        content.appendChild(subfolderRow);
        content.appendChild(resultContainer);

        listItem.appendChild(header);
        listItem.appendChild(content);

        cloudList.appendChild(listItem);
      }
    } else {
      // Show empty message
      cloudList.innerHTML = '<div class="empty-list-message">No cloud storage configured yet.</div>';
    }

    // Check if we've reached the maximum number of remotes
    checkRemoteLimit();
  } catch (error) {
    showErrorNotification(`Error loading cloud list: ${error.message}`);
  }
}

// Check remote connection
async function checkRemote(remoteName, listItem, listFiles = false) {
  // Find the result container
  const resultContainer = listItem.querySelector(`#${remoteName}-result`);

  // Show loading state
  resultContainer.style.display = 'block';
  resultContainer.innerHTML = 'Checking connection...';

  try {
    // Clean up any lingering rclone processes first
    await cleanupRcloneProcesses();

    const result = await window.api.checkRemote(remoteName, listFiles);

    // Show result
    if (result.success) {
      resultContainer.innerHTML = '<span class="text-success">Connection successful!</span>\n\n' + result.stdout;
      showSuccessNotification(`Connection to "${remoteName}" successful.`);
    } else {
      // Clean up any lingering rclone processes
      await cleanupRcloneProcesses();

      resultContainer.innerHTML = '<span class="text-error">Connection failed!</span>\n\n' + result.stderr;
      showErrorNotification(`Failed to connect to "${remoteName}"`);
    }
  } catch (error) {
    // Clean up any lingering rclone processes
    await cleanupRcloneProcesses();

    resultContainer.innerHTML = `<span class="text-error">Error: ${error.message}</span>`;
    showErrorNotification(`Error: ${error.message}`);
  }
}

// Delete remote
function deleteRemote(remoteName) {
  // Ask for confirmation before deleting
  showConfirmationModal(
    'Delete Remote',
    `Are you sure you want to delete the remote "${remoteName}"?`,
    () => deleteRemoteConfirmed(remoteName)
  );
}

// Delete remote (confirmed)
async function deleteRemoteConfirmed(remoteName) {
  try {
    // Clean up any lingering rclone processes first
    await cleanupRcloneProcesses();

    const result = await window.api.deleteRemote(remoteName);

    if (result.success) {
      // Reload remote metadata
      await loadRemoteMetadata();

      // Reload cloud list
      await loadCloudList();

      showSuccessNotification(`Remote "${remoteName}" deleted.`);
    } else {
      showErrorNotification(`Failed to delete remote: ${result.error}`);
    }
  } catch (error) {
    showErrorNotification(`Error: ${error.message}`);
  }
}

// Save subfolder for remote
async function saveSubfolder(remoteName, subfolder) {
  try {
    // Get existing metadata for this remote
    let metadata = remoteMetadata[remoteName] || {};

    // Ensure subfolder has leading slash for local remotes
    if (metadata.type === 'local' && subfolder && !subfolder.startsWith('/')) {
      subfolder = '/' + subfolder;
      showInfoNotification('Added leading slash to local path.');
    }

    // Update subfolder
    metadata.subfolder = subfolder;

    // Save metadata
    const result = await window.api.updateRemoteMetadata(remoteName, metadata);

    if (result.success) {
      // Reload remote metadata
      await loadRemoteMetadata();

      showSuccessNotification(`Subfolder for "${remoteName}" saved.`);
    } else {
      showErrorNotification(`Failed to save subfolder: ${result.error}`);
    }
  } catch (error) {
    showErrorNotification(`Error: ${error.message}`);
  }
}

// PageFinder Configuration

// Browse for PageFinder config file
browsePfConfigBtn.addEventListener('click', async () => {
  try {
    const result = await window.api.openFileDialog({
      title: 'Select PageFinder Configuration File',
      properties: ['openFile'],
      filters: [
        { name: 'Configuration Files', extensions: ['conf'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      pfConfigPathInput.value = result.filePaths[0];
    }
  } catch (error) {
    showErrorNotification(`Error: ${error.message}`);
  }
});

// Import PageFinder config
importPfConfigBtn.addEventListener('click', async () => {
  const configPath = pfConfigPathInput.value.trim();

  if (!configPath) {
    showErrorNotification('Please select a configuration file.');
    return;
  }

  // Show loading state
  importPfConfigBtn.disabled = true;
  importPfConfigBtn.textContent = 'Importing...';

  try {
    const result = await window.api.copyConfigFile(configPath, 'pf');

    if (result.success) {
      showSuccessNotification('PageFinder configuration imported.');
      // Enable test buttons after successful import
      testPfConnectionBtn.disabled = false;
      purgeTestBtn.disabled = false;
    } else {
      showErrorNotification(`Failed to import configuration: ${result.error}`);
    }
  } catch (error) {
    showErrorNotification(`Error: ${error.message}`);
  } finally {
    // Reset button state
    importPfConfigBtn.disabled = false;
    importPfConfigBtn.textContent = 'Import Configuration';
  }
});

// Test PageFinder connection
testPfConnectionBtn.addEventListener('click', async () => {
  // Show loading state
  testPfConnectionBtn.disabled = true;
  testPfConnectionBtn.textContent = 'Testing...';

  try {
    // Clean up any lingering rclone processes first
    await cleanupRcloneProcesses();

    const result = await window.api.testPageFinderConnection();

    // Show result
    pfConnectionResult.style.display = 'block';

    if (result.success) {
      pfConnectionResult.innerHTML = '<span class="text-success">Connection successful!</span>\n\n' + result.stdout;
      showSuccessNotification('Connection successful!');
    } else {
      // Clean up any lingering rclone processes
      await cleanupRcloneProcesses();

      const errMessage = result.stderr || result.error;
      pfConnectionResult.innerHTML = '<span class="text-error">Connection failed!</span>\n\n' + errMessage;
      showErrorNotification('Connection failed!');
    }
  } catch (error) {
    // Clean up any lingering rclone processes
    await cleanupRcloneProcesses();

    pfConnectionResult.style.display = 'block';
    pfConnectionResult.innerHTML = `<span class="text-error">Error: ${error.message}</span>`;
    showErrorNotification(`Error: ${error.message}`);
  } finally {
    // Reset button state
    testPfConnectionBtn.disabled = false;
    testPfConnectionBtn.textContent = 'Test Connection';
  }
});

// Test purge
purgeTestBtn.addEventListener('click', async () => {
  // Show loading state
  purgeTestBtn.disabled = true;
  purgeTestBtn.textContent = 'Testing...';

  try {
    const result = await window.api.runPurgeTest();

    // Show result
    purgeResult.style.display = 'block';

    if (result.success) {
      purgeResult.innerHTML = '<span class="text-success">Purge test completed successfully!</span>\n\n' + result.stdout;
      purgeExecBtn.disabled = false;
      showSuccessNotification('Purge test completed successfully!');
    } else {
      purgeResult.innerHTML = '<span class="text-error">Purge test failed!</span>\n\n' + result.stderr;
      purgeExecBtn.disabled = true;
      showErrorNotification('Purge test failed!');
    }
  } catch (error) {
    purgeResult.style.display = 'block';
    purgeResult.innerHTML = `<span class="text-error">Error: ${error.message}</span>`;
    purgeExecBtn.disabled = true;
    showErrorNotification(`Error: ${error.message}`);
  } finally {
    // Reset button state
    purgeTestBtn.disabled = false;
    purgeTestBtn.textContent = 'Test Purge';
  }
});

// Execute purge
purgeExecBtn.addEventListener('click', () => {
  // Show confirmation dialog before executing
  showConfirmationModal(
    'Confirm Purge Operation',
    'WARNING: This will permanently delete all data in the workspace directory. This action cannot be undone. Are you sure you want to proceed?',
    async () => {
      // Only execute if confirmed
      await executePurge();
    }
  );
});

// Execute purge (confirmed)
async function executePurge() {
  // Show loading state
  purgeExecBtn.disabled = true;
  purgeExecBtn.textContent = 'Executing...';

  try {
    const result = await window.api.runPurgeExec();

    // Show result
    purgeResult.style.display = 'block';

    if (result.success) {
      purgeResult.innerHTML = '<span class="text-success">Purge executed successfully!</span>\n\n' + result.stdout;
      showSuccessNotification('Purge executed successfully!');
    } else {
      purgeResult.innerHTML = '<span class="text-error">Purge execution failed!</span>\n\n' + result.stderr;
      showErrorNotification('Purge execution failed!');
    }
  } catch (error) {
    purgeResult.style.display = 'block';
    purgeResult.innerHTML = `<span class="text-error">Error: ${error.message}</span>`;
    showErrorNotification(`Error: ${error.message}`);
  } finally {
    // Reset button state
    purgeExecBtn.disabled = false;
    purgeExecBtn.textContent = 'Execute Purge';
  }
}

// Sync

// Test sync
syncTestBtn.addEventListener('click', async () => {
  // Show loading state
  syncTestBtn.disabled = true;
  syncTestBtn.textContent = 'Testing...';

  try {
    const result = await window.api.runSyncTest();

    // Show result
    syncResult.style.display = 'block';

    if (result.success) {
      syncResult.innerHTML = '<span class="text-success">Sync test completed successfully!</span>\n\n' + result.stdout;
      syncExecBtn.disabled = false;
      showSuccessNotification('Sync test completed successfully!');
    } else {
      syncResult.innerHTML = '<span class="text-error">Sync test failed!</span>\n\n' + result.stderr;
      syncExecBtn.disabled = true;
      showErrorNotification('Sync test failed!');
    }
  } catch (error) {
    syncResult.style.display = 'block';
    syncResult.innerHTML = `<span class="text-error">Error: ${error.message}</span>`;
    syncExecBtn.disabled = true;
    showErrorNotification(`Error: ${error.message}`);
  } finally {
    // Reset button state
    syncTestBtn.disabled = false;
    syncTestBtn.textContent = 'Test Sync';
  }
});

// Execute sync
syncExecBtn.addEventListener('click', async () => {
  // Execute without confirmation
  await executeSync();
});

// Execute sync (confirmed)
async function executeSync() {
  // Show loading state
  syncExecBtn.disabled = true;
  syncExecBtn.textContent = 'Executing...';

  try {
    const result = await window.api.runSyncExec();

    // Show result
    syncResult.style.display = 'block';

    if (result.success) {
      syncResult.innerHTML = '<span class="text-success">Sync executed successfully!</span>\n\n' + result.stdout;
      showSuccessNotification('Sync executed successfully!');
    } else {
      syncResult.innerHTML = '<span class="text-error">Sync execution failed!</span>\n\n' + result.stderr;
      showErrorNotification('Sync execution failed!');
    }
  } catch (error) {
    syncResult.style.display = 'block';
    syncResult.innerHTML = `<span class="text-error">Error: ${error.message}</span>`;
    showErrorNotification(`Error: ${error.message}`);
  } finally {
    // Reset button state
    syncExecBtn.disabled = false;
    syncExecBtn.textContent = 'Execute Sync';
  }
}

// Schedule

// Set up schedule
setupScheduleBtn.addEventListener('click', async () => {
  const time = scheduleTimeInput.value;

  // Show loading state
  setupScheduleBtn.disabled = true;
  setupScheduleBtn.textContent = 'Setting up...';

  try {
    const result = await window.api.setupSchedule(time);

    // Show result
    scheduleResult.style.display = 'block';

    if (result.success) {
      scheduleResult.innerHTML = '<span class="text-success">Schedule set up successfully!</span>';
      showSuccessNotification('Schedule set up successfully!');
    } else {
      scheduleResult.innerHTML = `<span class="text-error">Failed to set up schedule: ${result.error}</span>`;
      showErrorNotification(`Failed to set up schedule: ${result.error}`);
    }
  } catch (error) {
    scheduleResult.style.display = 'block';
    scheduleResult.innerHTML = `<span class="text-error">Error: ${error.message}</span>`;
    showErrorNotification(`Error: ${error.message}`);
  } finally {
    // Reset button state
    setupScheduleBtn.disabled = false;
    setupScheduleBtn.textContent = 'Set Up Schedule';
  }
});

// Reload sync log button
reloadSyncLogBtn.addEventListener('click', async () => {
  // Show loading state
  reloadSyncLogBtn.disabled = true;
  lastSyncLog.innerHTML = '<div class="empty-log-message">Loading sync log...</div>';

  // Load the sync log
  await loadLastSyncLog();

  // Reset button state
  reloadSyncLogBtn.disabled = false;

  // Show notification
  showInfoNotification('Sync log reloaded');
});

// Load last sync log
async function loadLastSyncLog() {
  try {
    const result = await window.api.readLog('sync');

    if (result.success) {
      lastSyncLog.innerHTML = result.content;
    } else {
      lastSyncLog.innerHTML = '<div class="empty-log-message">No sync log available.</div>';
    }
  } catch (error) {
    lastSyncLog.innerHTML = `<div class="empty-log-message">Error loading sync log: ${error.message}</div>`;
  }
}

// Settings

// Browse for rclone path
browseRclonePathBtn.addEventListener('click', async () => {
  try {
    const result = await window.api.openFileDialog({
      title: 'Select rclone Executable',
      properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      rclonePathInput.value = result.filePaths[0];
    }
  } catch (error) {
    showErrorNotification(`Error: ${error.message}`);
  }
});

// Browse for workspace directory
browseWorkspaceDirBtn.addEventListener('click', async () => {
  try {
    const result = await window.api.openFileDialog({
      title: 'Select Workspace Directory',
      properties: ['openDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      workspaceDirInput.value = result.filePaths[0];
    }
  } catch (error) {
    showErrorNotification(`Error: ${error.message}`);
  }
});

// Save settings
saveSettingsBtn.addEventListener('click', async () => {
  const rclonePath = rclonePathInput.value.trim();
  const workspaceDir = workspaceDirInput.value.trim();

  if (!rclonePath) {
    showErrorNotification('Please enter the path to the rclone executable.');
    return;
  }

  if (!workspaceDir) {
    showErrorNotification('Please enter the workspace directory.');
    return;
  }

  // Show loading state
  saveSettingsBtn.disabled = true;
  saveSettingsBtn.textContent = 'Saving...';

  try {
    const result = await window.api.updateConfig({
      path_rclone: rclonePath,
      workspace_dir: workspaceDir
    });

    showSuccessNotification('Settings saved.');
  } catch (error) {
    showErrorNotification(`Error: ${error.message}`);
  } finally {
    // Reset button state
    saveSettingsBtn.disabled = false;
    saveSettingsBtn.textContent = 'Save Settings';
  }
});

// Modal functions

// Show confirmation modal
function showConfirmationModal(title, message, onConfirm) {
  modalTitle.textContent = title;
  modalBody.textContent = message;

  // Set up confirm button
  modalConfirmBtn.onclick = () => {
    hideModal();
    onConfirm();
  };

  // Show modal
  modal.style.display = 'block';
}

// Hide modal
function hideModal() {
  modal.style.display = 'none';
}

// Close modal when clicking the close button
modalCloseBtn.addEventListener('click', hideModal);

// Close modal when clicking the cancel button
modalCancelBtn.addEventListener('click', hideModal);

// Close modal when clicking outside the modal content
window.addEventListener('click', (event) => {
  if (event.target === modal) {
    hideModal();
  }
});

// Notification functions

// Show success notification
function showSuccessNotification(message) {
  showNotification(message, 'success');
}

// Show error notification
function showErrorNotification(message) {
  showNotification(message, 'error');
}

// Show info notification
function showInfoNotification(message) {
  showNotification(message, 'info');
}

// Show notification
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;

  notificationContainer.appendChild(notification);

  // Remove notification after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'fadeOut 0.3s ease-out forwards';
    setTimeout(() => {
      notificationContainer.removeChild(notification);
    }, 300);
  }, 3000);
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
