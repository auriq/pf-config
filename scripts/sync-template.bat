@echo off
setlocal enabledelayedexpansion

REM Sync script for PageFinder (Windows version)
REM This script is generated automatically by the PageFinder Configuration tool
REM Generated on: {{DATE}}

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
set RCLONE_PATH={{RCLONE_PATH}}
set CONFIG_PATH={{CONFIG_PATH}}
set LOG_DIR={{LOG_DIR}}
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
    call :log "ERROR: rclone not found at %RCLONE_PATH%"
    exit /b 1
)

REM Use environment variable for config if set
if defined RCLONE_CONFIG (
    set "CONFIG=%RCLONE_CONFIG%"
) else (
    set "CONFIG=%CONFIG_PATH%"
)

REM SECTION 1: PURGE OPERATIONS
REM This section handles all purge operations to ensure they are completed before any sync operations

REM Set up common variables
set DEST_PATH={{PF_REMOTE_NAME}}:{{BUCKET_NAME}}/user/{{PF_REMOTE_NAME}}
set CLOUD_REMOTES={{CLOUD_REMOTES}}

REM Function to purge a folder
:purge_folder
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

REM Check if folders to delete environment variable is set (for test connection)
if defined RCLONE_FOLDERS_TO_DELETE (
    call :log "Processing folders to delete from environment variable..."
    
    REM Process each folder to delete (simplified for batch script)
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
    call :log "Checking for folders to delete in destination..."
    
    REM List folders in the destination
    call :log "Listing folders in destination: %DEST_PATH%"
    call :log "Executing command: %RCLONE_PATH% lsd %DEST_PATH% --config %CONFIG%"
    
    REM Check each folder from the remote
    for /f "tokens=*" %%a in ('%RCLONE_PATH% lsd "%DEST_PATH%" --config "%CONFIG%" 2^>^&1') do (
        REM Extract folder name (last token)
        for %%f in (%%a) do set FOLDER=%%f
        
        REM Check if the folder exists in the remotes list
        echo %CLOUD_REMOTES% | findstr /C:"%FOLDER%" > nul
        if %ERRORLEVEL% neq 0 (
            set DELETE_PATH=%DEST_PATH%/%FOLDER%
            call :purge_folder "%FOLDER%" "!DELETE_PATH!"
        )
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
    
    REM This would need custom parsing of JSON in batch which is complex
    REM For this example, we'll use a simplified approach
    
    for %%r in (%RCLONE_REMOTES%) do (
        call :sync_remote "%%r" "%%r:" "%DEST_PATH%/%%r"
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
        REM Set source and destination paths
        call :sync_remote "%%r" "%%r:" "%DEST_PATH%/%%r"
    )
)

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

REM Function to sync a remote
:sync_remote
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