# PageFinder Configuration - Orphan Purge Script (Windows PowerShell Version)
# This script detects and purges orphaned directories in PageFinder
# It can be run in dry-run mode (default) or execution mode (-e flag)

param(
    [switch]$e = $false
)

# Load environment variables from .env file
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
. "$scriptPath\env-loader.ps1"

# Set the working directory from environment variable
$workDir = $env:WORKSPACE_DIR
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$logFile = Join-Path $workDir "purge.log"

# Debug information to stdout
Write-Host "Script started at $timestamp"
Write-Host "Working directory: $workDir"
Write-Host "Log file: $logFile"

# Function to log messages
function Log-Message {
    param([string]$message)
    
    # Print to terminal
    Write-Host "[$timestamp] $message"
    
    # Log to file
    $logEntry = "[$timestamp] $message"
    
    if (-not (Test-Path $logFile)) {
        Set-Content -Path $logFile -Value $logEntry
        Write-Host "Created new log file: $logFile"
    } else {
        # Prepend to log file
        $tempFile = Join-Path $workDir "temp_purge_log"
        Set-Content -Path $tempFile -Value $logEntry
        Get-Content $logFile | Add-Content -Path $tempFile
        Move-Item -Path $tempFile -Destination $logFile -Force
    }
}

# Initialize log file
Log-Message "Purge log initialized"
Log-Message "----- Starting orphan detection and purge process -----"

# Check if execution mode is enabled
$executeMode = $e
if ($executeMode) {
    Log-Message "Execution mode enabled"
} else {
    Log-Message "Dry-run mode enabled (use -e to execute)"
}

# Paths to configuration files
$cloudConf = Join-Path $workDir "cloud.conf"
$pfConf = Join-Path $workDir "pf.conf"
$metadataJson = Join-Path $workDir "remote-meta.json"

# Check if configuration files exist
if (-not (Test-Path $cloudConf)) {
    Log-Message "ERROR: Cloud configuration file not found at $cloudConf"
    exit 1
}

if (-not (Test-Path $pfConf)) {
    Log-Message "ERROR: PageFinder configuration file not found at $pfConf"
    exit 1
}

# Extract PageFinder name, bucket, and prefix from pf.conf
# Format expected: [pfname]
#                  type = ...
#                  bucket = ...
#                  prefix = ...
$pfContent = Get-Content $pfConf
$pfName = ($pfContent | Select-String -Pattern "^\[(.+)\]" | ForEach-Object { $_.Matches.Groups[1].Value } | Select-Object -First 1)
$bucket = ($pfContent | Select-String -Pattern "bucket\s*=\s*(.+)" | ForEach-Object { $_.Matches.Groups[1].Value.Trim() } | Select-Object -First 1)
$prefix = ($pfContent | Select-String -Pattern "prefix\s*=\s*(.+)" | ForEach-Object { $_.Matches.Groups[1].Value.Trim() } | Select-Object -First 1)

# Construct the base PageFinder path
if (-not $prefix) {
    $pfBasePath = "${pfName}:$bucket/$pfName"
} else {
    $pfBasePath = "${pfName}:$bucket/$prefix/$pfName"
}

Log-Message "PageFinder base path: $pfBasePath"

# Step 1: Find folders in destination
Log-Message "Finding folders in destination..."
$destFoldersCmd = "$env:RCLONE_PATH lsd `"$pfBasePath`" --config `"$pfConf`""
Log-Message "Executing: $destFoldersCmd"

try {
    $destFoldersOutput = Invoke-Expression $destFoldersCmd 2>&1
    $destFoldersStatus = $LASTEXITCODE
    
    if ($destFoldersStatus -ne 0) {
        Log-Message "ERROR: Failed to list folders in destination"
        Log-Message "Error output: $destFoldersOutput"
        exit 1
    }
} catch {
    Log-Message "ERROR: Exception occurred while executing command: $_"
    exit 1
}

# Parse the output to get folder names
# rclone lsd output format: "          -1 2023-04-11 12:34:56        -1 folder_name"
Log-Message "Parsing destination folders output..."
Log-Message "Output: $destFoldersOutput"

# Create a temporary file to store folder names
$foldersFile = Join-Path $workDir "folders.txt"
if (Test-Path $foldersFile) {
    Remove-Item $foldersFile -Force
}

# Process each line of the output
$destFolders = @()
foreach ($line in $destFoldersOutput) {
    # Skip empty lines
    if ([string]::IsNullOrWhiteSpace($line)) {
        continue
    }
    
    # Extract the folder name (last field)
    $folder = ($line -split '\s+')[-1]
    
    if (-not [string]::IsNullOrWhiteSpace($folder)) {
        Log-Message "Found folder: $folder"
        Add-Content -Path $foldersFile -Value $folder
        $destFolders += $folder
    }
}

# Log the found folders
Log-Message "Destination folders found: $($destFolders -join ', ')"

# Step 2: Find source remote names from cloud.conf
Log-Message "Finding source remote names from cloud.conf..."
$sourceRemotes = Get-Content $cloudConf | Select-String -Pattern "^\[(.+)\]" | ForEach-Object { $_.Matches.Groups[1].Value }

if (-not $sourceRemotes) {
    Log-Message "No source remotes found in cloud.conf"
    exit 1
}

# Create a temporary file to store source remote names
$remotesFile = Join-Path $workDir "remotes.txt"
if (Test-Path $remotesFile) {
    Remove-Item $remotesFile -Force
}

# Process each remote name
foreach ($remote in $sourceRemotes) {
    if (-not [string]::IsNullOrWhiteSpace($remote)) {
        Log-Message "Found remote: $remote"
        Add-Content -Path $remotesFile -Value $remote
    }
}

Log-Message "Source remotes found: $($sourceRemotes -join ', ')"

# Step 3: Compare names to find orphans
Log-Message "Comparing names to find orphans..."

# Create a temporary file to store orphan names
$orphansFile = Join-Path $workDir "orphans.txt"
if (Test-Path $orphansFile) {
    Remove-Item $orphansFile -Force
}

# Process each destination folder
$orphans = @()
foreach ($folder in $destFolders) {
    # Skip empty lines
    if ([string]::IsNullOrWhiteSpace($folder)) {
        continue
    }
    
    # Check if this folder exists in source remotes
    $found = $false
    foreach ($remote in $sourceRemotes) {
        if ($folder -eq $remote) {
            $found = $true
            break
        }
    }
    
    if (-not $found) {
        Log-Message "Found orphan: $folder"
        Add-Content -Path $orphansFile -Value $folder
        $orphans += $folder
    }
}

# Log the found orphans
if ($orphans.Count -gt 0) {
    Log-Message "Orphans found: $($orphans -join ', ')"
} else {
    Log-Message "No orphans found"
}

# Step 4 & 5: Construct and execute purge commands
if ($orphans.Count -eq 0) {
    Log-Message "No orphans found"
} else {
    Log-Message "Found orphans, proceeding with purge..."
    
    foreach ($orphan in $orphans) {
        # Skip empty lines
        if ([string]::IsNullOrWhiteSpace($orphan)) {
            continue
        }
        
        # Construct the purge command
        if ($executeMode) {
            $purgeCmd = "$env:RCLONE_PATH purge `"$pfBasePath/$orphan`" --config `"$pfConf`""
        } else {
            $purgeCmd = "$env:RCLONE_PATH purge `"$pfBasePath/$orphan`" --dry-run --config `"$pfConf`""
        }
        
        Log-Message "Executing: $purgeCmd"
        
        # Execute the purge command
        try {
            $purgeOutput = Invoke-Expression $purgeCmd 2>&1
            $purgeStatus = $LASTEXITCODE
            
            # Log the output
            if ($purgeOutput) {
                Log-Message "Command output for $orphan:"
                foreach ($line in $purgeOutput) {
                    Log-Message "  $line"
                }
            } else {
                Log-Message "Command for $orphan produced no output"
            }
            
            # Log the result
            if ($purgeStatus -eq 0) {
                if ($executeMode) {
                    Log-Message "Purge for $orphan completed successfully"
                } else {
                    Log-Message "Dry run for $orphan completed successfully"
                }
            } else {
                Log-Message "ERROR: Command for $orphan failed with exit code $purgeStatus"
            }
        } catch {
            Log-Message "ERROR: Exception occurred while executing command: $_"
        }
    }
}

Log-Message "----- Orphan detection and purge process finished -----"

# Clean up temporary files
if (Test-Path $foldersFile) { Remove-Item $foldersFile -Force }
if (Test-Path $remotesFile) { Remove-Item $remotesFile -Force }
if (Test-Path $orphansFile) { Remove-Item $orphansFile -Force }