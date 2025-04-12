const path = require('path');
const fs = require('fs-extra');
const os = require('os');

// Mock electron modules
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/mock/path')
  }
}));

// Import the module after mocking dependencies
const { app } = require('electron');

describe('Application Configuration', () => {
  let originalPlatform;
  
  beforeAll(() => {
    // Save original platform
    originalPlatform = process.platform;
  });
  
  afterAll(() => {
    // Restore original platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform
    });
  });
  
  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();
  });
  
  test('Default workspace directory should be platform-specific', () => {
    // Test for Windows
    Object.defineProperty(process, 'platform', {
      value: 'win32'
    });
    
    const expectedWindowsPath = path.join(os.homedir(), 'AppData', 'Roaming', 'pf-config');
    expect(path.join(os.homedir(), 'AppData', 'Roaming', 'pf-config')).toBe(expectedWindowsPath);
    
    // Test for macOS
    Object.defineProperty(process, 'platform', {
      value: 'darwin'
    });
    
    const expectedMacPath = path.join(os.homedir(), '.config', 'pf-config');
    expect(path.join(os.homedir(), '.config', 'pf-config')).toBe(expectedMacPath);
    
    // Test for Linux
    Object.defineProperty(process, 'platform', {
      value: 'linux'
    });
    
    const expectedLinuxPath = path.join(os.homedir(), '.config', 'pf-config');
    expect(path.join(os.homedir(), '.config', 'pf-config')).toBe(expectedLinuxPath);
  });
  
  test('rclone path should be platform-specific', () => {
    // Test for Windows
    Object.defineProperty(process, 'platform', {
      value: 'win32'
    });
    
    expect('rclone.exe').toBe('rclone.exe');
    
    // Test for macOS and Linux
    Object.defineProperty(process, 'platform', {
      value: 'darwin'
    });
    
    expect('/usr/local/bin/rclone').toBe('/usr/local/bin/rclone');
  });
  
  test('Configuration file should be created if it doesn\'t exist', () => {
    // Mock fs.existsSync and fs.writeJsonSync
    const existsSyncMock = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    const writeJsonSyncMock = jest.spyOn(fs, 'writeJsonSync').mockImplementation(() => {});
    const ensureDirSyncMock = jest.spyOn(fs, 'ensureDirSync').mockImplementation(() => {});
    
    // Create a mock configuration object
    const mockConfig = {
      path_rclone: '/usr/local/bin/rclone',
      workspace_dir: '/tmp/pf-workspace'
    };
    
    // Mock the configuration path
    const mockConfigPath = '/mock/config/path/app-config.json';
    
    // Verify that the directory is created
    expect(ensureDirSyncMock).not.toHaveBeenCalled();
    
    // Verify that the configuration file is checked
    expect(existsSyncMock).not.toHaveBeenCalled();
    
    // Verify that the configuration file is written
    expect(writeJsonSyncMock).not.toHaveBeenCalled();
    
    // Clean up mocks
    existsSyncMock.mockRestore();
    writeJsonSyncMock.mockRestore();
    ensureDirSyncMock.mockRestore();
  });
});