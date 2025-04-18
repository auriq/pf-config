# Sync workspace script for Windows
# Synchronizes cloud storage with PageFinder

# Get the directory of the current script
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
#$rootDir = Split-Path -Parent $scriptDir

# Load environment variables
if (Test-Path (Join-Path $scriptDir "env-loader.ps1")) {
    . (Join-Path $scriptDir "env-loader.ps1")
    Write-Host "Using SCRIPTS_PATH from environment: $env:SCRIPTS_PATH"
} else {
    Write-Host "Error: env-loader.ps1 not found"
    exit 1
}

# Debug info
Write-Host "===== SYNC SCRIPT DEBUG INFO ====="
Write-Host "Current directory: $(Get-Location)"
Write-Host "Script path: $($MyInvocation.MyCommand.Path)"
Write-Host "Script arguments: $args"
Write-Host "Environment variables:"
Get-ChildItem env: | ForEach-Object { Write-Host "$($_.Name)=$($_.Value)" }

# Initialize variables
$executeMode = $false
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$workdir = $env:WORKSPACE_DIR
$logFile = Join-Path $workdir "sync.log"

# Check for execute flag
if ($args -contains "-e") {
    $executeMode = $true
}

# Function to log messages
function Log-Message {
    param (
        [string]$message
    )

    $logTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$logTime] $message"

    # Write to console and log file
    Write-Host $logEntry
    Add-Content -Path $logFile -Value $logEntry
}

# Function to parse ini conf file
function Read-IniFile {
    param (
        [string]$FilePath
    )

    $ini = @{}
    $currentSection = $null

    Get-Content $FilePath | ForEach-Object {
        $line = $_.Trim()

        if ($line -match '^\[(.+)\]$') {
            $currentSection = $matches[1]
            $ini[$currentSection] = @{}
        }

        elseif ($line -match '^(.+?)=(.+)$' -and $currentSection) {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            $ini[$currentSection][$key] = $value
        }
    }

    return $ini
}

# Initialize log file
Write-Host "Script started at $timestamp"
Write-Host "Working directory: $workdir"
Write-Host "Log file: $logFile"

# Create log file header
Set-Content -Path $logFile -Value "[$timestamp] Sync log initialized"
Log-Message "----- Starting synchronization process -----"

# Check if in dry-run or execute mode
if (-not $executeMode) {
    Log-Message "Dry-run mode enabled (use -e to execute)"
} else {
    Log-Message "Execute mode enabled"
}

# Combine configuration files
Log-Message "Combining configuration files to create rclone.conf"
$cloudConfPath = Join-Path $workdir "cloud.conf"
$pfConfPath = Join-Path $workdir "pf.conf"
$rcloneConfPath = Join-Path $workdir "rclone.conf"

if (Test-Path $cloudConfPath) {
    $cloudConf = Get-Content -Path $cloudConfPath -Raw
} else {
    Log-Message "Error: cloud.conf not found at $cloudConfPath"
    exit 1
}

if (Test-Path $pfConfPath) {
    $pfConf = Get-Content -Path $pfConfPath -Raw
    $pfConfContent = Read-IniFile -FilePath $pfConfPath
} else {
    Log-Message "Error: pf.conf not found at $pfConfPath"
    exit 1
}

# Combine configurations
$combinedConf = $cloudConf + "`n" + $pfConf
Set-Content -Path $rcloneConfPath -Value $combinedConf
Log-Message "Combined configuration created at $rcloneConfPath"

# parse pf.conf
$pfName = $pfConfContent.Keys
$pfConfData = $pfConfContent[$pfName]

# Process cloud storage configurations
Log-Message "Processing cloud storage configurations"
$remoteMetaPath = Join-Path $workdir "remote-meta.json"

if (Test-Path $remoteMetaPath) {
    $remoteMeta = Get-Content -Path $remoteMetaPath -Raw | ConvertFrom-Json
} else {
    Log-Message "Error: remote-meta.json not found at $remoteMetaPath"
    exit 1
}

# Get properties of the remote-meta.json object
$remoteNames = $remoteMeta | Get-Member -MemberType NoteProperty | Select-Object -ExpandProperty Name

foreach ($remoteName in $remoteNames) {
    Log-Message "Processing cloud storage: $remoteName"

    $remote = $remoteMeta.$remoteName
    $subfolder = $remote.subfolder

    if ($subfolder) {
        Log-Message "Found subfolder in metadata: $subfolder for $remoteName"

        # Construct paths
        $cloudPath = "$($remoteName):$subfolder"
        $pfPath = -join ($pfName + ":" + $pfConfData.bucket + "/" + $pfConfData.prefix + "/" + $remoteName)

        Log-Message "Cloud path: $cloudPath"
        Log-Message "PageFinder path: $pfPath"

        # Construct rclone command
        $rcloneArgs = @(
            "sync",
            $cloudPath,
            $pfPath
        )

        if (-not $executeMode) {
            $rcloneArgs += "--dry-run"
        }

        $rcloneArgs += "--config"
        $rcloneArgs += $rcloneConfPath

        # Execute rclone command
        $rcloneCmd = "$env:RCLONE_PATH $($rcloneArgs -join ' ')"
        Log-Message "Executing command: $rcloneCmd"

        try {
            $output = & $env:RCLONE_PATH $rcloneArgs 2>&1
            $outputStr = $output | Out-String

            Log-Message "Command output for $remoteName"
            Log-Message "  $($outputStr -replace "`n", "`n  ")"

            if (-not $executeMode) {
                Log-Message "Dry run for $remoteName completed successfully"
            } else {
                Log-Message "Sync for $remoteName completed successfully"
            }
        } catch {
            Log-Message "Error executing rclone command: $_"
        }
    } else {
        Log-Message "No subfolder found in metadata for $remoteName, skipping"
    }
}

Log-Message "----- Synchronization process finished -----"