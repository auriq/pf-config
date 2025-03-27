#!/bin/bash
# Script to terminate any running rclone processes started by this application

# Find all rclone processes and terminate them
echo "Searching for running rclone processes..."
RCLONE_PROCESSES=$(ps aux | grep "[r]clone" | awk '{print $2}')

if [ -z "$RCLONE_PROCESSES" ]; then
  echo "No rclone processes found."
else
  echo "Found rclone processes: $RCLONE_PROCESSES"
  echo "Terminating processes..."
  for pid in $RCLONE_PROCESSES; do
    kill -15 $pid 2>/dev/null
    if [ $? -eq 0 ]; then
      echo "Successfully terminated process $pid"
    else
      echo "Failed to terminate process $pid"
      # Try force kill if normal kill fails
      kill -9 $pid 2>/dev/null
      if [ $? -eq 0 ]; then
        echo "Force terminated process $pid"
      fi
    fi
  done
fi

# Make sure any electron processes related to this app are also terminated
echo "Checking for related Electron processes..."
ELECTRON_PROCESSES=$(ps aux | grep "[C]loud.Storage.Config" | awk '{print $2}')

if [ -z "$ELECTRON_PROCESSES" ]; then
  echo "No related Electron processes found."
else
  echo "Found related Electron processes: $ELECTRON_PROCESSES"
  echo "Terminating processes..."
  for pid in $ELECTRON_PROCESSES; do
    kill -15 $pid 2>/dev/null
    if [ $? -eq 0 ]; then
      echo "Successfully terminated process $pid"
    else
      echo "Failed to terminate process $pid"
      kill -9 $pid 2>/dev/null
      if [ $? -eq 0 ]; then
        echo "Force terminated process $pid"
      fi
    fi
  done
fi

echo "Cleanup complete."