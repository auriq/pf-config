/**
 * Utility functions for the PageFinder Configuration application
 */

const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');

/**
 * Execute a command and return the result as a promise
 * @param {string} command - The command to execute
 * @returns {Promise<string>} - The command output
 */
function executeCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

/**
 * Ensure a directory exists, creating it if necessary
 * @param {string} dirPath - The directory path to ensure
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Format a date for display or logging
 * @param {Date} date - The date to format
 * @returns {string} - The formatted date string
 */
function formatDate(date = new Date()) {
  return date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
}

/**
 * Log a message with timestamp
 * @param {string} message - The message to log
 * @param {string} level - The log level (info, error, warn)
 */
function log(message, level = 'info') {
  const timestamp = formatDate();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  console.log(logMessage);
  return logMessage;
}

/**
 * Parse a cron expression into a human-readable schedule
 * @param {string} cronExpression - The cron expression to parse
 * @returns {Object} - The parsed schedule
 */
function parseCronExpression(cronExpression) {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length < 5) {
    throw new Error('Invalid cron expression');
  }
  
  const minute = parseInt(parts[0]);
  const hour = parseInt(parts[1]);
  const dayOfMonth = parts[2];
  const month = parts[3];
  const dayOfWeek = parts[4];
  
  // Determine frequency
  let frequency = 'daily';
  let dayOfWeekValue = null;
  let dayOfMonthValue = null;
  
  if (minute === 0 && hour === '*') {
    frequency = 'hourly';
  } else if (dayOfMonth !== '*' && month === '*' && dayOfWeek === '*') {
    frequency = 'monthly';
    dayOfMonthValue = parseInt(dayOfMonth);
  } else if (dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
    frequency = 'weekly';
    dayOfWeekValue = parseInt(dayOfWeek);
  }
  
  return {
    frequency,
    hour,
    minute,
    dayOfWeek: dayOfWeekValue,
    dayOfMonth: dayOfMonthValue,
    cronExpression
  };
}

/**
 * Generate a cron expression from a schedule object
 * @param {Object} schedule - The schedule object
 * @returns {string} - The cron expression
 */
function generateCronExpression(schedule) {
  if (!schedule || !schedule.frequency) {
    return '0 0 * * *'; // Default to daily at midnight
  }
  
  let cronExpression = '0 0 * * *';
  
  if (schedule.frequency === 'hourly') {
    // Run at the beginning of every hour
    cronExpression = '0 * * * *';
  } else if (schedule.frequency === 'daily') {
    // Run at specific hour and minute
    const hour = schedule.hour || 0;
    const minute = schedule.minute || 0;
    cronExpression = `${minute} ${hour} * * *`;
  } else if (schedule.frequency === 'weekly') {
    // Run on specific day of week at specific hour and minute
    const dayOfWeek = schedule.dayOfWeek || 0; // 0 = Sunday
    const hour = schedule.hour || 0;
    const minute = schedule.minute || 0;
    cronExpression = `${minute} ${hour} * * ${dayOfWeek}`;
  } else if (schedule.frequency === 'monthly') {
    // Run on specific day of month at specific hour and minute
    const dayOfMonth = schedule.dayOfMonth || 1;
    const hour = schedule.hour || 0;
    const minute = schedule.minute || 0;
    cronExpression = `${minute} ${hour} ${dayOfMonth} * *`;
  }
  
  return cronExpression;
}

module.exports = {
  executeCommand,
  ensureDirectoryExists,
  formatDate,
  log,
  parseCronExpression,
  generateCronExpression
};