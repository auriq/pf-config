@echo off
REM PageFinder Configuration - Synchronization Script (Windows Batch Wrapper)
REM This script is a wrapper for sync.ps1

setlocal

REM Check if execution mode is enabled
set EXECUTE_MODE=
if "%1"=="-e" set EXECUTE_MODE=-e

REM Get the directory of this batch file
set SCRIPT_DIR=%~dp0

REM Run the PowerShell script with the appropriate parameters
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%sync.ps1" %EXECUTE_MODE%

endlocal