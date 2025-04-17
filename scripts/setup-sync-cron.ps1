# Setup sync cron script for Windows
# Sets up a scheduled task to run the sync-workspace script daily
param (
    [string]$time = "03:00"
)

# Get the directory of the current script
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
#$rootDir = Split-Path -Parent $scriptDir

# Load environment variables
if (Test-Path (Join-Path $scriptDir "env-loader.ps1")) {
    . (Join-Path $scriptDir "env-loader.ps1")
} else {
    Write-Host "Error: env-loader.ps1 not found"
    exit 1
}

# Parse time
$timeComponents = $time -split ':'
if ($timeComponents.Count -ne 2) {
    Write-Host "Error: Invalid time format. Please use HH:MM format."
    exit 1
}

$hour = [int]$timeComponents[0]
$minute = [int]$timeComponents[1]

if ($hour -lt 0 -or $hour -gt 23 -or $minute -lt 0 -or $minute -gt 59) {
    Write-Host "Error: Invalid time. Hour must be 0-23, minute must be 0-59."
    exit 1
}

# Determine script to use
$syncScriptPath = ""
if (Test-Path (Join-Path $env:WORKSPACE_DIR "scripts/sync-workspace.ps1")) {
    $syncScriptPath = Join-Path $env:WORKSPACE_DIR "scripts/sync-workspace.ps1"
    Write-Host "Using script in workspace: $syncScriptPath"
} elseif (Test-Path (Join-Path $scriptDir "sync-workspace.ps1")) {
    $syncScriptPath = Join-Path $scriptDir "sync-workspace.ps1"
    Write-Host "Using script in application: $syncScriptPath"
} else {
    Write-Host "Error: sync-workspace.ps1 not found"
    exit 1
}

# Task name
$taskName = "PageFinder Daily Sync"

# Check if task already exists
$taskExists = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($taskExists) {
    Write-Host "A PageFinder Daily Sync task already exists. Updating it..."
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Create action
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$syncScriptPath`" -e"

# Create trigger
$trigger = New-ScheduledTaskTrigger -Daily -At "$hour`:$minute"

# Create principal (run with highest privileges)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Highest

# Create task settings
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

# Register the task
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings

Write-Host "Success: Scheduled task added to run sync-workspace.ps1 at $time daily."

# Show current tasks
Write-Host "Current scheduled tasks:"
Get-ScheduledTask -TaskName $taskName | Format-Table -Property TaskName, State, LastRunTime, NextRunTime