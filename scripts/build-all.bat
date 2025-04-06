@echo off
REM Build script for PageFinder Configuration on Windows
REM This script will build for Windows platforms

echo Building PageFinder Configuration for Windows...

REM Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: npm is not installed or not in PATH
    exit /b 1
)

REM Check if electron-builder is installed
call npm list -g electron-builder >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo WARNING: electron-builder is not installed globally
    echo Installing dependencies...
    call npm install
)

REM Clean existing builds
if exist "dist" (
    echo Cleaning previous builds...
    rmdir /s /q "dist"
)

REM Build for Windows
echo Building for Windows...
call npm run dist:win

echo.
echo Build completed successfully!
echo Output files are in the dist folder.