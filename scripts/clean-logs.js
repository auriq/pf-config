#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');

/**
 * Clean logs by keeping only the last event block starting with "===== PageFinder"
 */
async function cleanLogs() {
  try {
    // Get the log file path
    const logPath = path.join(process.cwd(), 'logs', 'sync_detail.log');
    
    // Check if the log file exists
    if (!fs.existsSync(logPath)) {
      return { success: false, message: 'Log file not found.' };
    }
    
    // Read the log file
    const logContent = fs.readFileSync(logPath, 'utf8');
    
    // Find the last occurrence of "===== PageFinder"
    const pattern = /={5} PageFinder/g;
    const matches = [...logContent.matchAll(pattern)];
    
    if (matches.length === 0) {
      return { success: false, message: 'No PageFinder event blocks found in the log.' };
    }
    
    // Get the position of the last match
    const lastMatchPosition = matches[matches.length - 1].index;
    
    // Extract the content from the last match to the end
    const newLogContent = logContent.substring(lastMatchPosition);
    
    // Write the new content back to the log file
    fs.writeFileSync(logPath, newLogContent);
    
    return { success: true, message: 'Log file cleaned successfully.' };
  } catch (error) {
    return { success: false, message: `Error cleaning logs: ${error.message}` };
  }
}

// If this script is run directly from the command line
if (require.main === module) {
  cleanLogs()
    .then(result => {
      // Exit with appropriate code without printing sensitive information
      process.exit(result.success ? 0 : 1);
    })
    .catch(() => {
      process.exit(1);
    });
}

module.exports = { cleanLogs };