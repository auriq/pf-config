# PageFinder Configuration - Task Scheduler Setup Script (Windows PowerShell Version)
# This script sets up a scheduled task to run sync.ps1 at a specified time
# Usage: .\setup-sync-task.ps1 HH:MM
# Note: This script requires administrative privileges to create a scheduled task

param(
    [Parameter(Mandatory=$true)]
    [string]$Time
)

# Load environment variables from .env file
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
. "$scriptPath\env-loader.ps1"

# Function to display usage information
function Show-Usage {
    Write-Host "Usage: $($MyInvocation.MyCommand.Name) HH:MM"
    Write-Host "  HH:MM - Time to run sync.ps1 in 24-hour format (e.g., 14:30 for 2:30 PM)"
    exit 1
}

# Function to validate time format
function Test-TimeFormat {
    param([string]$TimeString)
    
    $timePattern = "^([0-1][0-9]|2[0-3]):([0-5][0-9])$"
    if (-not ($TimeString -match $timePattern)) {
        Write-Host "Error: Invalid time format. Please use HH:MM in 24-hour format."
        Show-Usage
        return $false
    }
    return $true
}

# Validate the time format
if (-not (Test-TimeFormat $Time)) {
    exit 1
}

# Extract hours and minutes
$hours = $Time.Split(':')[0]
$minutes = $Time.Split(':')[1]

# Get the absolute path to sync.ps1
$syncScript = Join-Path $scriptPath "sync.ps1"

# Check if sync.ps1 exists
if (-not (Test-Path $syncScript)) {
    Write-Host "Error: sync.ps1 not found at $syncScript"
    exit 1
}

# Task name
$taskName = "PageFinderDailySync"

# Check if the task already exists
$taskExists = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($taskExists) {
    Write-Host "A PageFinder Daily Sync scheduled task already exists. Updating it..."
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Create the action to run the PowerShell script with execution mode
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$syncScript`" -e"

# Create a trigger for the specified time
$trigger = New-ScheduledTaskTrigger -Daily -At "$hours`:$minutes"

# Set the principal to run with highest privileges
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Highest

# Create the task settings
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

# Register the scheduled task
try {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "PageFinder Daily Synchronization"
    
    Write-Host "Success: Scheduled task added to run sync.ps1 at $Time daily."
    Write-Host "Task details:"
    Get-ScheduledTask -TaskName $taskName | Format-List
} catch {
    Write-Host "Error: Failed to create scheduled task: $_"
    exit 1
}

# Set environment variables for the task
$taskPath = "\$taskName"
try {
    # Create a batch file that sets environment variables and calls the PowerShell script
    $batchFile = Join-Path $env:WORKSPACE_DIR "run_sync.bat"
    @"
@echo off
set RCLONE_PATH=$($env:RCLONE_PATH)
set WORKSPACE_DIR=$($env:WORKSPACE_DIR)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$syncScript" -e
"@ | Set-Content -Path $batchFile

    # Update the task to use the batch file
    $action = New-ScheduledTaskAction -Execute $batchFile
    Set-ScheduledTask -TaskName $taskName -Action $action
    
    Write-Host "Environment variables configured for the task."
} catch {
    Write-Host "Warning: Failed to set environment variables for the task: $_"
    Write-Host "The task will still run, but may not use the correct environment variables."
}