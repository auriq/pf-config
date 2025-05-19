# Purge workspace script for Windows
# Detects and purges orphaned folders in PageFinder storage

# Get the directory of the current script
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir

# Load environment variables
if (Test-Path (Join-Path $scriptDir "env-loader.ps1")) {
    . (Join-Path $scriptDir "env-loader.ps1")
    Write-Host "Using SCRIPTS_PATH from environment: $env:SCRIPTS_PATH"
} else {
    Write-Host "Error: env-loader.ps1 not found"
    exit 1
}

# Debug info
Write-Host "===== PURGE SCRIPT DEBUG INFO ====="
Write-Host "Current directory: $(Get-Location)"
Write-Host "Script path: $($MyInvocation.MyCommand.Path)"
Write-Host "Script arguments: $args"
Write-Host "Environment variables:"
Get-ChildItem env: | ForEach-Object { Write-Host "$($_.Name)=$($_.Value)" }

# Initialize variables
$executeMode = $false
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$workdir = $env:WORKSPACE_DIR
$logFile = Join-Path $workdir "purge.log"

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

    # 結果を格納するハッシュテーブル
    $ini = @{}
    $currentSection = $null

    # ファイルを1行ずつ読み込む
    Get-Content $FilePath | ForEach-Object {
        $line = $_.Trim()

        # セクションの判定
        if ($line -match '^\[(.+)\]$') {
            $currentSection = $matches[1]
            $ini[$currentSection] = @{}
        }
        # キーと値の判定
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
Set-Content -Path $logFile -Value "[$timestamp] Purge log initialized"
Log-Message "----- Starting orphan detection and purge process -----"

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
    $pfConfContent = Read-IniFile -FilePath $pfConfPath
} else {
    Log-Message "Error: cloud.conf not found at $cloudConfPath"
    exit 1
}

if (Test-Path $pfConfPath) {
    $pfConf = Get-Content -Path $pfConfPath -Raw
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

# Define PageFinder base path
$pfBasePath = -join ($pfName + ":" + $pfConfData.bucket + "/" + $pfConfData.prefix + "/" + $pfName)
Log-Message "PageFinder base path: $pfBasePath"

# Find folders in destination
Log-Message "Finding folders in destination..."
Log-Message "Using rclone config: $rcloneConfPath"

# Execute rclone lsd command to list directories
$rcloneArgs = @(
    "lsd",
    $pfBasePath,
    "--config",
    $rcloneConfPath
)

Log-Message "Executing: $env:RCLONE_PATH $($rcloneArgs -join ' ')"

try {
    $output = & $env:RCLONE_PATH $rcloneArgs 2>&1
    $outputStr = $output | Out-String
    Log-Message "Parsing destination folders output..."
    Log-Message "Output: $outputStr"

    # Parse output to get folder names
    $destFolders = @()
    foreach ($line in $output) {
        if ($line -match "\s+\d+\s+[\d-]+\s+[\d:]+\s+-?\d+\s+(.+)") {
            $folderName = $matches[1]
            $destFolders += $folderName
            Log-Message "Found folder: $folderName"
        }
    }

    Log-Message "Destination folders found: $($destFolders -join ', ')"

    # Find source remote names from cloud.conf
    Log-Message "Finding source remote names from cloud.conf..."
    $remoteNames = @()

    $cloudConfContent = Get-Content -Path $cloudConfPath
    foreach ($line in $cloudConfContent) {
        if ($line -match "^\[([^\]]+)\]") {
            $remoteName = $matches[1]
            $remoteNames += $remoteName
            Log-Message "Found remote: $remoteName"
        }
    }

    Log-Message "Source remotes found: $($remoteNames -join ', ')"

    # Compare names to find orphans
    Log-Message "Comparing names to find orphans..."
    $orphans = @()

    foreach ($destFolder in $destFolders) {
        if ($remoteNames -notcontains $destFolder) {
            $orphans += $destFolder
            Log-Message "Found orphan: $destFolder"
        }
    }

    if ($orphans.Count -eq 0) {
        Log-Message "No orphans found"
    } else {
        Log-Message "Found $($orphans.Count) orphans: $($orphans -join ', ')"

        # Process orphans
        foreach ($orphan in $orphans) {
            $orphanPath = "$pfBasePath/$orphan"
            Log-Message "Processing orphan: $orphanPath"

            # Construct purge command
            $purgeArgs = @(
                "purge",
                $orphanPath,
                "--config",
                $rcloneConfPath
            )

            if (-not $executeMode) {
                Log-Message "Would purge orphan: $orphanPath (dry run)"
            } else {
                Log-Message "Purging orphan: $orphanPath"
                try {
                    $purgeOutput = & $env:RCLONE_PATH $purgeArgs 2>&1
                    $purgeOutputStr = $purgeOutput | Out-String
                    Log-Message "Purge output: $purgeOutputStr"
                    Log-Message "Successfully purged orphan: $orphanPath"
                } catch {
                    Log-Message "Error purging orphan: $_"
                }
            }
        }
    }
} catch {
    Log-Message "Error executing rclone command: $_"
}

Log-Message "----- Orphan detection and purge process finished -----"