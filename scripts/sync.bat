@echo off
setlocal enabledelayedexpansion

REM Sync script for PageFinder (Windows version)
REM This script is generated automatically by the PageFinder Configuration tool
REM Generated on: %DATE% %TIME%

REM Default options
set DRY_RUN=--dry-run
set VERBOSE=

REM Parse command line options
:parse_args
if "%~1"=="" goto :done_parsing
if "%~1"=="-e" (
    set DRY_RUN=
    shift
    goto :parse_args
)
if "%~1"=="-v" (
    set VERBOSE=-v
    shift
    goto :parse_args
)
shift
goto :parse_args

:done_parsing

REM Configuration
set RCLONE_PATH=rclone.exe
set CONFIG_PATH=%USERPROFILE%\.config\pf-config\rclone.conf
set LOG_DIR=%~dp0..\logs
set TIMESTAMP=%DATE:~10,4%%DATE:~4,2%%DATE:~7,2%_%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set LOG_FILE=%LOG_DIR%\sync_detail.log
set EVENT_LOG=%LOG_DIR%\sync_events.log

REM Create log directory if it doesn't exist
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM Log header
echo. >> "%LOG_FILE%"
echo ===== PageFinder Sync Job Started at %DATE% %TIME% ===== >> "%LOG_FILE%"
echo Using config file: %CONFIG_PATH% >> "%LOG_FILE%"

if defined DRY_RUN (
    echo Mode: DRY RUN (no changes will be made) >> "%LOG_FILE%"
) else (
    echo Mode: EXECUTE (changes will be made) >> "%LOG_FILE%"
)

if defined VERBOSE (
    echo Verbose: YES >> "%LOG_FILE%"
) else (
    echo Verbose: NO >> "%LOG_FILE%"
)
echo. >> "%LOG_FILE%"

REM Append to event log
if defined DRY_RUN (
    if defined VERBOSE (
        echo [%DATE% %TIME%] Sync job started. Mode: DRY-RUN Verbose: YES >> "%EVENT_LOG%"
    ) else (
        echo [%DATE% %TIME%] Sync job started. Mode: DRY-RUN Verbose: NO >> "%EVENT_LOG%"
    )
) else (
    if defined VERBOSE (
        echo [%DATE% %TIME%] Sync job started. Mode: EXECUTE Verbose: YES >> "%EVENT_LOG%"
    ) else (
        echo [%DATE% %TIME%] Sync job started. Mode: EXECUTE Verbose: NO >> "%EVENT_LOG%"
    )
)

REM Function to log messages
:log
echo [%DATE% %TIME%] %~1 >> "%LOG_FILE%"
echo [%DATE% %TIME%] %~1
exit /b

REM Check if rclone exists
where /q %RCLONE_PATH%
if %ERRORLEVEL% neq 0 (
    call :log "ERROR: rclone not found in PATH. Please install rclone and make sure it's in your PATH."
    exit /b 1
)

REM Use environment variable for config if set
if defined RCLONE_CONFIG (
    set "CONFIG=%RCLONE_CONFIG%"
) else (
    set "CONFIG=%CONFIG_PATH%"
)

REM Set up common variables
set DEST_PATH=pf-user-2:asi-essentia-ai-new/user/pf-user-2
set CLOUD_REMOTES=gg koi g3

REM SECTION 1: PURGE OPERATIONS
call :log "----------------------------------------"
call :log "Checking for folders to delete in destination..."

if defined RCLONE_FOLDERS_TO_DELETE (
    REM Process folders to delete from environment variable
    call :log "Processing folders to delete from environment variable..."
    
    for %%f in (%RCLONE_FOLDERS_TO_DELETE%) do (
        if not "%%f"=="" (
            set DELETE_PATH=%DEST_PATH%/%%f
            call :purge_folder "%%f" "!DELETE_PATH!"
        )
    )
) else if defined RCLONE_DELETE (
    REM Use environment variable for delete path
    set DELETE_PATH=%RCLONE_DELETE%
    
    REM Extract folder name from delete path
    for %%f in (%DELETE_PATH%) do set FOLDER=%%~nxf
    call :purge_folder "!FOLDER!" "%DELETE_PATH%"
) else (
    REM List folders in the destination
    call :log "Listing folders in destination: %DEST_PATH%"
    call :log "Executing command: %RCLONE_PATH% lsd %DEST_PATH% --config %CONFIG%"
    
    REM Get the list of folders
    for /f "tokens=*" %%a in ('%RCLONE_PATH% lsd "%DEST_PATH%" --config "%CONFIG%" 2^>^&1') do (
        REM Extract folder name (last token)
        for %%f in (%%a) do set FOLDER=%%f
        
        REM Check if the folder exists in the remotes list
        call :check_folder "!FOLDER!" "%CLOUD_REMOTES%"
    )
)

REM Add a separator line in the log
call :log "----------------------------------------"
call :log "Purge operations completed. Starting sync operations."
call :log "----------------------------------------"

REM SECTION 2: SYNC OPERATIONS
REM This section handles all sync operations after purge operations are completed

if defined RCLONE_REMOTES (
    REM Process remotes from environment variable
    call :log "Processing remotes from environment variable..."
    REM Try to use PowerShell for JSON parsing if available
    where /q powershell
    if %ERRORLEVEL% equ 0 (
        call :log "Using PowerShell to parse JSON remotes data"
        
        REM Create a temporary PowerShell script to parse the JSON
        echo $remotes = $env:RCLONE_REMOTES ^| ConvertFrom-Json > "%TEMP%\parse_remotes.ps1"
        echo foreach($remote in $remotes) { >> "%TEMP%\parse_remotes.ps1"
        echo   Write-Host "REMOTE_NAME=$($remote.name)" >> "%TEMP%\parse_remotes.ps1"
        echo   Write-Host "SOURCE=$($remote.source)" >> "%TEMP%\parse_remotes.ps1"
        echo   Write-Host "DEST=$($remote.dest)" >> "%TEMP%\parse_remotes.ps1"
        echo } >> "%TEMP%\parse_remotes.ps1"
        
        REM Execute the PowerShell script and process the output
        for /f "tokens=*" %%a in ('powershell -ExecutionPolicy Bypass -File "%TEMP%\parse_remotes.ps1"') do (
            set "%%a"
            if defined REMOTE_NAME if defined SOURCE if defined DEST (
                call :sync_remote "!REMOTE_NAME!" "!SOURCE!" "!DEST!"
                set "REMOTE_NAME="
                set "SOURCE="
                set "DEST="
            )
        )
        
        REM Clean up temporary script
        del "%TEMP%\parse_remotes.ps1"
    ) else (
        call :log "PowerShell not available. JSON parsing in batch script is limited."
        call :log "Using simplified approach for remotes."
    )
    
) else if defined RCLONE_SOURCE if defined RCLONE_DEST (
    REM Use environment variables for source and destination
    set SOURCE=%RCLONE_SOURCE%
    set DEST=%RCLONE_DEST%
    
    REM Extract remote name from source
    for /f "tokens=1 delims=:" %%r in ("%SOURCE%") do set REMOTE_NAME=%%r
    
    call :sync_remote "%REMOTE_NAME%" "%SOURCE%" "%DEST%"
) else (
    REM Use configured sync commands for all remotes in CLOUD_REMOTES
    for %%r in (%CLOUD_REMOTES%) do (
        set REMOTE=%%r
        
        REM For Windows, we'll use a simplified approach without grep
        REM This would need more robust implementation in production
        
        REM Check if there's a subfolder path set for this remote
        set "METADATA_PATH=%USERPROFILE%\.config\pf-config\remotes-metadata.json"
        set "SUBFOLDER="
        
        if exist "!METADATA_PATH!" (
            where /q powershell
            if %ERRORLEVEL% equ 0 (
                call :log "Using PowerShell to parse metadata for remote %%r"
                
                REM Create a temporary PowerShell script to extract subfolder
                echo $json = Get-Content -Raw "!METADATA_PATH!" ^| ConvertFrom-Json > "%TEMP%\parse_metadata.ps1"
                echo if ($json.remotes.'%%r'.subfolder) { >> "%TEMP%\parse_metadata.ps1"
                echo   Write-Host $json.remotes.'%%r'.subfolder >> "%TEMP%\parse_metadata.ps1"
                echo } >> "%TEMP%\parse_metadata.ps1"
                
                REM Execute the PowerShell script and get the subfolder
                for /f "tokens=*" %%s in ('powershell -ExecutionPolicy Bypass -File "%TEMP%\parse_metadata.ps1"') do (
                    set "SUBFOLDER=%%s"
                    call :log "Found subfolder in metadata for %%r: !SUBFOLDER!"
                )
                
                REM Clean up temporary script
                del "%TEMP%\parse_metadata.ps1"
            ) else (
                call :log "PowerShell not available. Using default configuration for remote %%r"
            )
        )
        
        REM Set source path based on subfolder and remote type
        if defined SUBFOLDER (
            call :log "Using subfolder !SUBFOLDER! for remote %%r"
            set "SOURCE_PATH=%%r:!SUBFOLDER!"
        ) else (
            set "SOURCE_PATH=%%r:"
        )
        
        REM Set destination path
        set "DEST_PATH=pf-user-2:asi-essentia-ai-new/user/pf-user-2/%%r"
        
        call :sync_remote "%%r" "!SOURCE_PATH!" "!DEST_PATH!"
    )
)

REM Log completion
call :log "===== PageFinder Sync Job Completed at %DATE% %TIME% ====="

REM Append completion to event log
if defined DRY_RUN (
    if defined VERBOSE (
        echo [%DATE% %TIME%] Sync job completed. Mode: DRY-RUN Verbose: YES >> "%EVENT_LOG%"
    ) else (
        echo [%DATE% %TIME%] Sync job completed. Mode: DRY-RUN Verbose: NO >> "%EVENT_LOG%"
    )
) else (
    if defined VERBOSE (
        echo [%DATE% %TIME%] Sync job completed. Mode: EXECUTE Verbose: YES >> "%EVENT_LOG%"
    ) else (
        echo [%DATE% %TIME%] Sync job completed. Mode: EXECUTE Verbose: NO >> "%EVENT_LOG%"
    )
)

exit /b 0

:purge_folder
REM Function to purge a folder
set folder=%~1
set path=%~2

call :log "Folder %folder% does not exist in remotes list, deleting..."
if defined DRY_RUN (
    call :log "DRY RUN: Would delete folder %folder%"
    call :log "Executing command: %RCLONE_PATH% purge %path% --dry-run %VERBOSE% --config %CONFIG%"
    %RCLONE_PATH% purge "%path%" --dry-run %VERBOSE% --config "%CONFIG%" >> "%LOG_FILE%" 2>&1
) else (
    call :log "Executing command: %RCLONE_PATH% purge %path% %VERBOSE% --config %CONFIG%"
    %RCLONE_PATH% purge "%path%" %VERBOSE% --config "%CONFIG%" >> "%LOG_FILE%" 2>&1
    if %ERRORLEVEL% equ 0 (
        call :log "Folder %folder% deleted successfully"
    ) else (
        call :log "ERROR: Failed to delete folder %folder%"
    )
)
exit /b

:check_folder
REM Function to check if a folder should be deleted
set folder=%~1
set remotes=%~2

REM Simple check if folder is in the remotes list
echo %remotes% | findstr /C:"%folder%" > nul
if %ERRORLEVEL% neq 0 (
    set DELETE_PATH=%DEST_PATH%/%folder%
    call :purge_folder "%folder%" "!DELETE_PATH!"
)
exit /b

:sync_remote
REM Function to sync a remote
set remote_name=%~1
set source=%~2
set dest=%~3

call :log "Syncing %remote_name% to PageFinder..."
if defined DRY_RUN (
    call :log "DRY RUN: Would sync %source% to %dest%"
    call :log "Executing command: %RCLONE_PATH% sync %source% %dest% --dry-run %VERBOSE% --config %CONFIG%"
    %RCLONE_PATH% sync "%source%" "%dest%" --dry-run %VERBOSE% --config "%CONFIG%" >> "%LOG_FILE%" 2>&1
) else (
    call :log "Executing command: %RCLONE_PATH% sync %source% %dest% %VERBOSE% --config %CONFIG%"
    %RCLONE_PATH% sync "%source%" "%dest%" %VERBOSE% --config "%CONFIG%" >> "%LOG_FILE%" 2>&1
    if %ERRORLEVEL% equ 0 (
        call :log "Sync for %remote_name% completed successfully"
    ) else (
        call :log "ERROR: Sync for %remote_name% failed"
    )
)
exit /b

endlocal