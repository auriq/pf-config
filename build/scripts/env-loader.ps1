# PageFinder Configuration - Environment Loader (Windows PowerShell Version)
# This script loads environment variables from the .env file
# It should be dot-sourced by other scripts, not executed directly

# Get the absolute path to the project root directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = (Get-Item $scriptPath).Parent.FullName
$envFile = Join-Path $projectRoot ".env"

# Function to log messages
function Log-EnvLoader {
    param([string]$message)
    Write-Host "[ENV LOADER] $message"
}

# Check if .env file exists
if (-not (Test-Path $envFile)) {
    Log-EnvLoader "Warning: .env file not found at $envFile"
    Log-EnvLoader "Using default environment variables"
    
    # Set default values
    $env:RCLONE_PATH = "rclone.exe"
    $env:WORKSPACE_DIR = "$env:APPDATA\pf-config"
} else {
    Log-EnvLoader "Loading environment variables from $envFile"
    
    # Read .env file and set variables
    Get-Content $envFile | ForEach-Object {
        # Skip comments and empty lines
        if (-not ($_ -match "^#" -or $_ -eq "")) {
            # Extract variable name and value
            if ($_ -match "^([A-Za-z0-9_]+)=(.*)$") {
                $name = $matches[1]
                $value = $matches[2]
                
                # Remove quotes if present
                $value = $value -replace '^"(.*)"$', '$1'
                $value = $value -replace "^'(.*)'$", '$1'
                
                # Set the environment variable
                Set-Item -Path "env:$name" -Value $value
                Log-EnvLoader "Set $name=$value"
            }
        }
    }
}

# Ensure RCLONE_PATH and WORKSPACE_DIR are set
if ([string]::IsNullOrEmpty($env:RCLONE_PATH)) {
    Log-EnvLoader "RCLONE_PATH not set, using default: rclone.exe"
    $env:RCLONE_PATH = "rclone.exe"
}

if ([string]::IsNullOrEmpty($env:WORKSPACE_DIR)) {
    Log-EnvLoader "WORKSPACE_DIR not set, using default: %APPDATA%\pf-config"
    $env:WORKSPACE_DIR = "$env:APPDATA\pf-config"
}

# Ensure workspace directory exists
if (-not (Test-Path $env:WORKSPACE_DIR)) {
    New-Item -ItemType Directory -Path $env:WORKSPACE_DIR -Force | Out-Null
}

Log-EnvLoader "Environment loaded successfully"
Log-EnvLoader "RCLONE_PATH=$env:RCLONE_PATH"
Log-EnvLoader "WORKSPACE_DIR=$env:WORKSPACE_DIR"