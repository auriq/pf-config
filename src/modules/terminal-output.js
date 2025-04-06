/**
 * Terminal Output Handler
 * 
 * This module provides consistent, cross-platform terminal output functionality
 * with configurable styling, levels, and logging to file.
 * 
 * Features:
 * - Color-coded output based on message level (info, warning, error, success)
 * - All terminal output logged to logs/terminal.log
 * - File logging in overwrite mode (resets on application start)
 * - Timestamp prefixing for all messages
 */

const fs = require('fs-extra');
const path = require('path');
const util = require('util');

// Constants
const LOG_FILE_PATH = path.join(process.cwd(), 'logs', 'terminal.log');
const MAX_HISTORY = 1000; // Store the last 1000 outputs

// Ensure logs directory exists
try {
  fs.ensureDirSync(path.join(process.cwd(), 'logs'));
} catch (error) {
  console.error(`Failed to create logs directory: ${error.message}`);
}

// Initialize log file (overwrite mode)
function initLogFile() {
  try {
    // Create empty file (overwrite if exists)
    fs.writeFileSync(LOG_FILE_PATH, `Terminal Log - Started at ${new Date().toISOString()}\n\n`);
    return true;
  } catch (error) {
    console.error(`Failed to initialize log file: ${error.message}`);
    return false;
  }
}

// Initialize the log file at module load
initLogFile();

// Store original console methods
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug
};

// ANSI color codes for terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  
  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Utility to add timestamp
function timestamp() {
  return `[${new Date().toISOString()}]`;
}

// Strip ANSI color codes from strings for file logging
function stripAnsi(str) {
  if (typeof str !== 'string') return str;
  return str.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, 
    ''
  );
}

// Append message to log file
function appendToLogFile(level, message) {
  try {
    // Format the message
    const formattedMessage = `${timestamp()} [${level.toUpperCase()}] ${stripAnsi(message)}\n`;
    
    // Append to log file
    fs.appendFileSync(LOG_FILE_PATH, formattedMessage);
    return true;
  } catch (error) {
    originalConsole.error(`Failed to write to log file: ${error.message}`);
    return false;
  }
}

// Override console methods to add logging
console.log = function() {
  // Get all arguments and format them
  const args = Array.from(arguments);
  const message = util.format.apply(null, args);
  
  // Call original console.log with the message
  originalConsole.log(message);
  
  // Log to file
  appendToLogFile('INFO', message);
};

console.info = function() {
  const args = Array.from(arguments);
  const message = util.format.apply(null, args);
  originalConsole.info(colors.blue + message + colors.reset);
  appendToLogFile('INFO', message);
};

console.warn = function() {
  const args = Array.from(arguments);
  const message = util.format.apply(null, args);
  originalConsole.warn(colors.yellow + message + colors.reset);
  appendToLogFile('WARNING', message);
};

console.error = function() {
  const args = Array.from(arguments);
  const message = util.format.apply(null, args);
  originalConsole.error(colors.red + message + colors.reset);
  appendToLogFile('ERROR', message);
};

console.debug = function() {
  const args = Array.from(arguments);
  const message = util.format.apply(null, args);
  originalConsole.debug(colors.dim + message + colors.reset);
  appendToLogFile('DEBUG', message);
};

// Terminal module for more advanced formatting
const terminal = {
  // Configuration
  config: {
    useColors: true,
    showTimestamp: true,
    logToFile: true
  },
  
  // Original console for direct access
  originalConsole,
  
  // Enable/disable colors
  enableColors() {
    this.config.useColors = true;
    return this;
  },
  
  disableColors() {
    this.config.useColors = false;
    return this;
  },
  
  // Configure options
  configure(options) {
    this.config = { ...this.config, ...options };
    return this;
  },
  
  // Reset log file (overwrite with empty content)
  resetLogFile() {
    return initLogFile();
  },
  
  // Basic logging methods that match console behavior
  log(message) {
    console.log(message);
    return this;
  },
  
  info(message) {
    console.info(message);
    return this;
  },
  
  warning(message) {
    console.warn(message);
    return this;
  },
  
  error(message) {
    console.error(message);
    return this;
  },
  
  debug(message) {
    console.debug(message);
    return this;
  },
  
  // Special formatting options
  success(message) {
    const successMsg = this.config.useColors ? colors.green + message + colors.reset : message;
    originalConsole.log(successMsg);
    appendToLogFile('SUCCESS', message);
    return this;
  },
  
  // Create a header with title
  header(title) {
    const line = '='.repeat(80);
    const formatted = `\n${line}\n${title}\n${line}\n`;
    originalConsole.log(this.config.useColors ? colors.cyan + formatted + colors.reset : formatted);
    appendToLogFile('HEADER', title);
    return this;
  },
  
  // Horizontal rule
  hr(char = '-') {
    const line = char.repeat(80);
    originalConsole.log(this.config.useColors ? colors.dim + line + colors.reset : line);
    appendToLogFile('HR', line);
    return this;
  },
  
  // Box formatting
  box(message, options = {}) {
    const lines = message.split('\n');
    const width = Math.max(...lines.map(line => line.length));
    const border = '─'.repeat(width + 2);
    
    const boxContent = [
      `┌${border}┐`,
      ...lines.map(line => `│ ${line.padEnd(width)} │`),
      `└${border}┘`
    ].join('\n');
    
    const colorName = options.color || 'white';
    const colored = this.config.useColors && colors[colorName] 
      ? colors[colorName] + boxContent + colors.reset 
      : boxContent;
    
    originalConsole.log(colored);
    appendToLogFile('BOX', message);
    return this;
  }
};

// Module exports
module.exports = terminal;