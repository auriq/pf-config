@echo off
setlocal enabledelayedexpansion

REM Build script for PageFinder Configuration on Windows
REM This script will build for Windows platforms

echo === PageFinder Configuration Build Script ===
echo This script will build the application for Windows.
echo.

REM Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: npm is not installed or not in PATH
    exit /b 1
)

REM Check if ImageMagick is installed for icon generation
where convert >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo WARNING: ImageMagick is not installed. Icon generation will be skipped.
    echo Install ImageMagick with: choco install imagemagick
    set SKIP_ICON_GENERATION=true
) else (
    set SKIP_ICON_GENERATION=false
)

REM Create build directory if it doesn't exist
if not exist "build" mkdir build

REM Create placeholder icon if it doesn't exist
if not exist "build\icon.png" (
    echo Creating placeholder icon...
    node scripts\create-placeholder-icon.js
    if %ERRORLEVEL% neq 0 (
        echo WARNING: Failed to create placeholder icon.
    )
)

REM Generate icons for different platforms
if exist "build\icon.png" (
    echo Generating icons for different platforms...
    node scripts\generate-icons.js
    if %ERRORLEVEL% neq 0 (
        echo WARNING: Failed to generate platform-specific icons.
    )
)

REM Check if electron-builder is installed
call npm list -g electron-builder >nul 2>nul
if %ERRORLEVEL% neq 0 (
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