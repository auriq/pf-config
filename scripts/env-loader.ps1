# Environment loader script for Windows
# Loads environment variables from .env file

# Get the directory of the current script
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir

# Default .env file path
$envFile = Join-Path $rootDir ".env"

if (!(Test-Path $envFile -PathType Leaf)) {
    $rootDir = Split-Path -Parent $rootDir
    $envFile = Join-Path $rootDir ".env"
}

Write-Host "[ENV LOADER] Loading environment variables from $envFile"

if (Test-Path $envFile) {
    # Read the .env file
    $envContent = Get-Content $envFile

    # Process each line
    foreach ($line in $envContent) {
        # Skip comments and empty lines
        if ($line -match "^\s*#" -or $line -match "^\s*$") {
            continue
        }

        # Extract variable name and value
        if ($line -match "^\s*([^=]+)=(.*)$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()

            # Set environment variable
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
            Write-Host "[ENV LOADER] Exported $name=$value"
        }
    }

    # Special handling for SCRIPTS_PATH
    if ($env:WORKSPACE_DIR -and (Test-Path (Join-Path $env:WORKSPACE_DIR "scripts"))) {
        $workspaceScriptsPath = Join-Path $env:WORKSPACE_DIR "scripts"
        [Environment]::SetEnvironmentVariable("SCRIPTS_PATH", $workspaceScriptsPath, "Process")
        Write-Host "[ENV LOADER] Using scripts from workspace: SCRIPTS_PATH=$workspaceScriptsPath"
    }

    Write-Host "[ENV LOADER] Environment loaded successfully"
    Write-Host "[ENV LOADER] RCLONE_PATH=$env:RCLONE_PATH"
    Write-Host "[ENV LOADER] WORKSPACE_DIR=$env:WORKSPACE_DIR"
    Write-Host "[ENV LOADER] SCRIPTS_PATH=$env:SCRIPTS_PATH"
} else {
    Write-Host "[ENV LOADER] Error: .env file not found at $envFile"
    exit 1
}