# PageFinder Configuration - Synchronization Script (Windows PowerShell Version)
# This script synchronizes data between cloud storage and PageFinder
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
$logFile = Join-Path $workDir "sync.log"

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
        $tempFile = Join-Path $workDir "temp_sync_log"
        Set-Content -Path $tempFile -Value $logEntry
        Get-Content $logFile | Add-Content -Path $tempFile
        Move-Item -Path $tempFile -Destination $logFile -Force
    }
}

# Function to check log file size and truncate if necessary
function Check-LogSize {
    if (Test-Path $logFile) {
        # Get log file size in bytes
        $logSize = (Get-Item $logFile).Length
        
        # If log file size is greater than 1MB (1048576 bytes), truncate it
        if ($logSize -gt 1048576) {
            Log-Message "Log file size exceeds 1MB, truncating..."
            
            # Keep approximately the last 500KB of the log file
            $content = Get-Content -Path $logFile -Tail 500
            Set-Content -Path $logFile -Value $content
            
            Log-Message "Log file truncated to last 500 lines"
        }
    }
}

# Initialize log file
Log-Message "Sync log initialized"

# Check and maintain log file size
Check-LogSize

Log-Message "----- Starting synchronization process -----"

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
$rcloneConf = Join-Path $workDir "rclone.conf"
$metadataJson = Join-Path $workDir "remote-meta.json"

# Create sample configuration files if they don't exist
if (-not (Test-Path $cloudConf)) {
    Log-Message "Creating sample cloud configuration file at $cloudConf"
    @"
[gdrive]
type = drive
client_id = your-client-id
client_secret = your-client-secret
scope = drive

[onedrive]
type = onedrive
client_id = your-client-id
client_secret = your-client-secret
"@ | Set-Content -Path $cloudConf
}

if (-not (Test-Path $pfConf)) {
    Log-Message "Creating sample PageFinder configuration file at $pfConf"
    @"
[pagefinder]
type = s3
provider = AWS
access_key_id = your-access-key
secret_access_key = your-secret-key
region = us-west-2
bucket = pagefinder-bucket
prefix = data
"@ | Set-Content -Path $pfConf
}

# Create sample metadata file if it doesn't exist
if (-not (Test-Path $metadataJson)) {
    Log-Message "Creating sample metadata file at $metadataJson"
    @"
{
  "gdrive": {
    "type": "drive",
    "subfolder": "testfiles"
  },
  "onedrive": {
    "type": "onedrive",
    "subfolder": "documents/work"
  }
}
"@ | Set-Content -Path $metadataJson
}

Log-Message "Combining configuration files to create rclone.conf"

# Combine cloud.conf and pf.conf to create rclone.conf
Get-Content $cloudConf, $pfConf | Set-Content $rcloneConf
Log-Message "Combined configuration created at $rcloneConf"

# Extract PageFinder name, bucket, and prefix from pf.conf
# Format expected: [pfname]
#                  type = ...
#                  bucket = ...
#                  prefix = ...
$pfContent = Get-Content $pfConf
$pfName = ($pfContent | Select-String -Pattern "^\[(.+)\]" | ForEach-Object { $_.Matches.Groups[1].Value } | Select-Object -First 1)
$bucket = ($pfContent | Select-String -Pattern "bucket\s*=\s*(.+)" | ForEach-Object { $_.Matches.Groups[1].Value.Trim() } | Select-Object -First 1)
$prefix = ($pfContent | Select-String -Pattern "prefix\s*=\s*(.+)" | ForEach-Object { $_.Matches.Groups[1].Value.Trim() } | Select-Object -First 1)

# Process each cloud storage configuration in cloud.conf
Log-Message "Processing cloud storage configurations"

# Get all cloud storage section names
$cloudSections = Get-Content $cloudConf | Select-String -Pattern "^\[(.+)\]" | ForEach-Object { $_.Matches.Groups[1].Value }

# Process each cloud storage section
foreach ($cloudName in $cloudSections) {
    Log-Message "Processing cloud storage: $cloudName"
    
    # Get subfolder from metadata if available
    if (Test-Path $metadataJson) {
        # Extract subfolder for this cloud storage from metadata.json using proper JSON parsing
        $subfolder = ""
        try {
            $metadata = Get-Content $metadataJson | ConvertFrom-Json
            if ($metadata.$cloudName -and $metadata.$cloudName.subfolder) {
                $subfolder = $metadata.$cloudName.subfolder
            }
        } catch {
            Log-Message "Error parsing metadata JSON: $_"
        }
        
        if ($subfolder) {
            Log-Message "Found subfolder in metadata: $subfolder for $cloudName"
            $cloudPath = "${cloudName}:$subfolder"
        } else {
            Log-Message "No subfolder found in metadata for $cloudName"
            $cloudPath = "${cloudName}:"
        }
    } else {
        Log-Message "No metadata file found, using root path for $cloudName"
        $cloudPath = "${cloudName}:"
    }
    
    # Construct the destination path
    if (-not $prefix) {
        $pfPath = "${pfName}:$bucket/$pfName/$cloudName"
    } else {
        $pfPath = "${pfName}:$bucket/$prefix/$pfName/$cloudName"
    }
    
    Log-Message "Cloud path: $cloudPath"
    Log-Message "PageFinder path: $pfPath"
    
    # Construct the rclone command
    if ($executeMode) {
        $rcloneCmd = "$env:RCLONE_PATH sync `"$cloudPath`" `"$pfPath`" --config `"$rcloneConf`""
    } else {
        $rcloneCmd = "$env:RCLONE_PATH sync `"$cloudPath`" `"$pfPath`" --dry-run --config `"$rcloneConf`""
    }
    
    Log-Message "Executing command: $rcloneCmd"
    
    # Execute the rclone command and capture output
    try {
        $rcloneOutput = Invoke-Expression $rcloneCmd 2>&1
        $rcloneStatus = $LASTEXITCODE
        
        # Log the output
        if ($rcloneOutput) {
            Log-Message "Command output for $cloudName:"
            foreach ($line in $rcloneOutput) {
                Log-Message "  $line"
            }
        } else {
            Log-Message "Command for $cloudName produced no output"
        }
        
        # Log the result
        if ($rcloneStatus -eq 0) {
            if ($executeMode) {
                Log-Message "Synchronization for $cloudName completed successfully"
            } else {
                Log-Message "Dry run for $cloudName completed successfully"
            }
        } else {
            Log-Message "ERROR: Command for $cloudName failed with exit code $rcloneStatus"
            # Don't exit here, continue with other cloud storages
        }
    } catch {
        Log-Message "ERROR: Exception occurred while executing command: $_"
    }
}

Log-Message "----- Synchronization process finished -----"