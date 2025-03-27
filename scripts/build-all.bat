@echo off
REM This script builds the application for Windows
REM It will create a placeholder icon, generate icons for different platforms,
REM and then build the application for Windows

echo === PageFinder Configuration Build Script ===
echo This script will build the application for Windows.
echo.

REM Check if ImageMagick is installed
where convert >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Warning: ImageMagick is not installed. Icon generation will be skipped.
    echo Install with Chocolatey: choco install imagemagick
    set SKIP_ICON_GENERATION=true
) else (
    set SKIP_ICON_GENERATION=false
)

REM Create build directory if it doesn't exist
if not exist build mkdir build

REM Create placeholder icon if it doesn't exist and ImageMagick is installed
if not exist build\icon.png (
    if "%SKIP_ICON_GENERATION%"=="false" (
        echo Creating placeholder icon...
        call scripts\create-placeholder-icon.sh
    )
)

REM Generate icons for different platforms if ImageMagick is installed
if exist build\icon.png (
    if "%SKIP_ICON_GENERATION%"=="false" (
        echo Generating icons for different platforms...
        call scripts\generate-icons.sh
    )
)

REM Install dependencies
echo Installing dependencies...
call npm install

REM Build for Windows
echo Building for Windows...
call npm run dist:win

echo.
echo Build complete! Check the 'dist' directory for the output.