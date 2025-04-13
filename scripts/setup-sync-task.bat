@echo off
REM PageFinder Configuration - Task Scheduler Setup Script (Windows Batch Wrapper)
REM This script is a wrapper for setup-sync-task.ps1

setlocal

REM Check if time argument was provided
if "%1"=="" (
    echo Error: Missing time argument.
    echo Usage: %0 HH:MM
    echo   HH:MM - Time to run sync.ps1 in 24-hour format (e.g., 14:30 for 2:30 PM)
    exit /b 1
)

REM Get the directory of this batch file
set SCRIPT_DIR=%~dp0

REM Run the PowerShell script with the appropriate parameters
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%setup-sync-task.ps1" %1

endlocal