@echo off
:: Script to terminate any running rclone processes started by this application

echo Searching for running rclone processes...
:: Find any running rclone.exe processes
tasklist /FI "IMAGENAME eq rclone.exe" /NH | findstr /i "rclone.exe" > nul
if %ERRORLEVEL% == 0 (
    echo Found rclone processes, terminating...
    taskkill /F /IM rclone.exe
    if %ERRORLEVEL% == 0 (
        echo Successfully terminated rclone processes.
    ) else (
        echo Failed to terminate some rclone processes.
    )
) else (
    echo No rclone processes found.
)

:: Find any Electron processes related to the app
echo Checking for related Electron processes...
tasklist /FI "WINDOWTITLE eq Cloud Storage Config*" /NH | findstr /i "electron.exe" > nul
if %ERRORLEVEL% == 0 (
    echo Found related Electron processes, terminating...
    :: Try to close them gracefully first
    taskkill /IM electron.exe /FI "WINDOWTITLE eq Cloud Storage Config*"
    if %ERRORLEVEL% == 0 (
        echo Successfully terminated Electron processes.
    ) else (
        echo Failed to terminate some Electron processes, trying force...
        taskkill /F /IM electron.exe /FI "WINDOWTITLE eq Cloud Storage Config*"
    )
) else (
    echo No related Electron processes found.
)

echo Cleanup complete.