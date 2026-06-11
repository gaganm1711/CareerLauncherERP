@echo off
title Career Launcher ERP 2.0 - Unified Control Panel
color 0B
cls

:: Check if the script is run with options directly (for shortcut bypass)
if "%1"=="--start-desktop" goto start_desktop_direct
if "%1"=="--start-browser" goto start_browser_direct
if "%1"=="--backup" goto db_backup_direct

:menu
cls
echo ====================================================================
echo      CAREER LAUNCHER ERP 2.0 - UNIFIED CONTROL PANEL
echo ====================================================================
echo.
echo  1. Start ERP System (Desktop Mode - Auto-starts in 3 seconds)
echo  2. Start ERP System (Browser/Network Mode)
echo  3. Open Database Studio (SQLite Viewer)
echo  4. Run Database Cloud Backup (OneDrive / Google Drive)
echo  5. Run First-Time Setup (Install dependencies / config)
echo  6. Create Desktop Shortcut
echo  7. Exit
echo.
echo ====================================================================
choice /C 1234567 /T 3 /D 1 /M "Select an option [1-7]: "
set opt=%errorlevel%

if %opt%==1 goto start_desktop
if %opt%==2 goto start_browser
if %opt%==3 goto db_viewer
if %opt%==4 goto db_backup
if %opt%==5 goto first_time_setup
if %opt%==6 goto create_shortcut
if %opt%==7 exit

:start_desktop
cls
echo ====================================================================
echo    STARTING CAREER LAUNCHER ERP 2.0 - DESKTOP MODE
echo ====================================================================
echo.
:: Run silent backup before launch
call :do_backup_silent

:: Verify node_modules exist, if not run setup automatically
if not exist "%~dp0node_modules" (
    echo [INFO] dependencies not found. Launching installer setup first...
    timeout /t 2 >nul
    goto first_time_setup
)

echo [INFO] Booting dev environment...
npm run dev
echo.
echo [INFO] Application session closed.
pause
goto menu

:start_desktop_direct
call :do_backup_silent
if not exist "%~dp0node_modules" goto first_time_setup
npm run dev
exit /b

:start_browser
cls
echo ====================================================================
echo    STARTING CAREER LAUNCHER ERP 2.0 - BROWSER MODE
echo ====================================================================
echo.
:: Run silent backup before launch
call :do_backup_silent

:: Verify node_modules exist, if not run setup automatically
if not exist "%~dp0node_modules" (
    echo [INFO] dependencies not found. Launching installer setup first...
    timeout /t 2 >nul
    goto first_time_setup
)

echo [INFO] Starting Backend API and Vite Frontend concurrently...
echo [INFO] Access the ERP locally at: http://localhost:3000
echo.
npx concurrently "npm run dev:frontend" "npm run dev:backend"
echo.
echo [INFO] Server session closed.
pause
goto menu

:start_browser_direct
call :do_backup_silent
if not exist "%~dp0node_modules" goto first_time_setup
npx concurrently "npm run dev:frontend" "npm run dev:backend"
exit /b

:db_viewer
cls
echo ====================================================================
echo    CAREER LAUNCHER ERP 2.0 - SQLITE DATABASE STUDIO
echo ====================================================================
echo.
echo  [INFO] Launching Prisma Studio for local SQLite data...
echo  [INFO] Once loaded, your browser will open: http://localhost:5555
echo.
set "DATABASE_URL=file:%APPDATA%\career-launcher-erp\dev.db"
npx prisma studio --schema=prisma/schema.sqlite.prisma
echo.
echo  [INFO] Database studio closed.
pause
goto menu

:db_backup
cls
echo ====================================================================
echo    CAREER LAUNCHER ERP 2.0 - DATABASE CLOUD SYNC
echo ====================================================================
echo.
call :do_backup
pause
goto menu

:db_backup_direct
call :do_backup_silent
exit /b

:first_time_setup
cls
echo ====================================================================
echo      CAREER LAUNCHER ERP 2.0 - FIRST-TIME SETUP WIZARD
echo ====================================================================
echo.

:: 1. Verify Node.js is installed
echo  [STEP 1/6] Verifying Node.js environment...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    color 0E
    echo [WARNING] Node.js is NOT installed on this computer!
    echo           The ERP system requires Node.js to run.
    echo.
    set /p install_node="Would you like to automatically download and install Node.js (v20 LTS) now? (Y/N): "
    if /I "%install_node%"=="Y" (
        echo.
        echo  [INFO] Downloading Node.js LTS Installer...
        powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi' -OutFile '%temp%\node_install.msi'"
        if %errorlevel% neq 0 (
            color 0C
            echo  [ERROR] Failed to download Node.js installer. Please check your internet connection.
            pause
            goto menu
        )
        echo  [INFO] Launching Node.js installation wizard. Please complete the installer...
        msiexec /i "%temp%\node_install.msi"
        echo.
        color 0A
        echo  [SUCCESS] Node.js installation package finished.
        echo           IMPORTANT: Please restart this script to complete the setup.
        echo.
        pause
        goto menu
    ) else (
        color 0C
        echo  [ERROR] Cannot proceed without Node.js. Exiting installer.
        pause
        goto menu
    )
)
color 0B
echo  [SUCCESS] Node.js is active. Version:
node -v
echo.

:: 2. Interactive Environment Settings Configuration
echo  [STEP 2/6] Configuring Environment Credentials...
set /p config_env="Would you like to write/update system credentials in .env? (Y/N): "
if /I "%config_env%"=="Y" (
    echo.
    set /p pg_url="Enter Neon PostgreSQL URL (Press Enter to keep current or skip): "
    set /p twilio_sid="Enter Twilio Account SID: "
    set /p twilio_token="Enter Twilio Auth Token: "
    set /p twilio_from="Enter Twilio From Phone Number (e.g. +14244048817): "
    echo.
    echo [INFO] Writing credentials to .env file...
    
    :: Backup old .env if it exists
    if exist "%~dp0.env" (
        copy /Y "%~dp0.env" "%~dp0.env.bak" >nul
    )
    
    :: Write new environment variables
    if not "%pg_url%"=="" (
        echo DATABASE_URL="%pg_url%"> "%~dp0.env"
    ) else if exist "%~dp0.env.bak" (
        :: Keep old database url
        powershell -Command "Select-String -Path '%~dp0.env.bak' -Pattern 'DATABASE_URL' | ForEach-Object { $_.Line }" > "%~dp0.env"
    ) else (
        echo DATABASE_URL="postgresql://user:password@neon-domain/dbname?sslmode=require"> "%~dp0.env"
    )
    
    echo PORT=5000>> "%~dp0.env"
    echo JWT_SECRET="career-launcher-default-secret-key-123">> "%~dp0.env"
    echo TWILIO_ACCOUNT_SID="%twilio_sid%">> "%~dp0.env"
    echo TWILIO_AUTH_TOKEN="%twilio_token%">> "%~dp0.env"
    echo TWILIO_FROM_NUMBER="%twilio_from%">> "%~dp0.env"
    echo  [SUCCESS] Environment credentials configured in .env.
) else (
    echo [INFO] Skipping environment configuration.
    if not exist "%~dp0.env" (
        echo [INFO] Creating default .env file...
        echo DATABASE_URL="postgresql://user:password@neon-domain/dbname?sslmode=require"> "%~dp0.env"
        echo PORT=5000>> "%~dp0.env"
        echo JWT_SECRET="career-launcher-default-secret-key-123">> "%~dp0.env"
        echo TWILIO_ACCOUNT_SID="ACyouraccountidhereplaceholder0000">> "%~dp0.env"
        echo TWILIO_AUTH_TOKEN="yourtwiliotokenplaceholder000000">> "%~dp0.env"
        echo TWILIO_FROM_NUMBER="+15550000000">> "%~dp0.env"
    )
)
echo.

:: 3. Installing dependencies
echo  [STEP 3/6] Installing Node dependencies...
cd /d "%~dp0"
call npm install
if %errorlevel% neq 0 (
    color 0C
    echo  [ERROR] Failed to install project dependencies.
    pause
    goto menu
)
echo  [SUCCESS] Dependencies installed.
echo.

:: 4. Generating Prisma Clients
echo  [STEP 4/6] Generating Prisma client libraries...
call npm run prisma:generate
if %errorlevel% neq 0 (
    color 0C
    echo  [ERROR] Failed to generate Prisma client engines.
    pause
    goto menu
)
echo  [SUCCESS] SQLite and PostgreSQL Prisma clients generated.
echo.

:: 5. SQLite Schema Deployment
echo  [STEP 5/6] Deploying SQLite Database tables...
if not exist "%APPDATA%\career-launcher-erp" mkdir "%APPDATA%\career-launcher-erp"

set "DATABASE_URL=file:%APPDATA%\career-launcher-erp\dev.db"
call npx prisma db push --schema=prisma/schema.sqlite.prisma
if %errorlevel% neq 0 (
    color 0C
    echo  [ERROR] Failed to push database schema to local SQLite.
    pause
    goto menu
)
echo  [SUCCESS] Local database tables initialized.
echo.

:: 6. Setup Shortcut
echo  [STEP 6/6] Finalizing setup...
call :do_create_shortcut
echo.
color 0A
echo ====================================================================
echo             ERP SYSTEM INSTALLED SUCCESSFULLY!
echo ====================================================================
echo.
echo  Default Credentials for login:
echo    Username: admin
echo    Password: admin123
echo.
pause
goto menu

:create_shortcut
cls
echo ====================================================================
echo    CAREER LAUNCHER ERP 2.0 - SHORTCUT CREATION
echo ====================================================================
echo.
call :do_create_shortcut
pause
goto menu

:: --- SUBROUTINES ---

:do_create_shortcut
set "TARGET_PATH=%~dp0Run_ERP.bat"
set "SHORTCUT_NAME=Career Launcher ERP 2.0"
echo  [INFO] Creating shortcut on your Desktop...
powershell -NoProfile -Command ^
    "$s = New-Object -ComObject WScript.Shell; " ^
    "$d = $s.SpecialFolders('Desktop'); " ^
    "$lnk = $s.CreateShortcut(\"$d\%SHORTCUT_NAME%.lnk\"); " ^
    "$lnk.TargetPath = '%TARGET_PATH%'; " ^
    "$lnk.WorkingDirectory = '%~dp0'; " ^
    "$lnk.Description = 'Launch Career Launcher ERP 2.0 System'; " ^
    "$lnk.IconLocation = 'shell32.dll,243'; " ^
    "$lnk.Save()"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to create desktop shortcut.
) else (
    echo [SUCCESS] Desktop shortcut created successfully on your Desktop!
)
exit /b

:do_backup
set "ONEDRIVE_DIR=%USERPROFILE%\OneDrive\Career_Launcher_ERP_Backups"
set "GDRIVE_DIR=G:\My Drive\Career_Launcher_ERP_Backups"
set "GDRIVE_ALT_DIR=%USERPROFILE%\Google Drive\Career_Launcher_ERP_Backups"
set "BACKED_UP=0"

for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'"`) do set "TIMESTAMP=%%i"
set "DB_FILE=%APPDATA%\career-launcher-erp\dev.db"

if not exist "%DB_FILE%" (
    echo [INFO] Local SQLite database file not found yet. Skipping backup.
    exit /b
)

:: OneDrive backup
if exist "%USERPROFILE%\OneDrive" (
    echo [INFO] OneDrive directory detected. Checking backup folder...
    if not exist "%ONEDRIVE_DIR%" mkdir "%ONEDRIVE_DIR%"
    copy /Y "%DB_FILE%" "%ONEDRIVE_DIR%\dev_backup_%TIMESTAMP%.db" >nul
    if %errorlevel% equ 0 (
        echo [SUCCESS] Backup copied to OneDrive folder.
        set "BACKED_UP=1"
    ) else (
        echo [ERROR] Failed to copy backup to OneDrive.
    )
)

:: Google Drive backup
if exist "G:\My Drive" (
    echo [INFO] Google Drive virtual drive G: detected.
    if not exist "%GDRIVE_DIR%" mkdir "%GDRIVE_DIR%"
    copy /Y "%DB_FILE%" "%GDRIVE_DIR%\dev_backup_%TIMESTAMP%.db" >nul
    if %errorlevel% equ 0 (
        echo [SUCCESS] Backup copied to Google Drive virtual drive.
        set "BACKED_UP=1"
    ) else (
        echo [ERROR] Failed to copy backup to Google Drive virtual drive.
    )
) else if exist "%USERPROFILE%\Google Drive" (
    echo [INFO] Google Drive folder detected.
    if not exist "%GDRIVE_ALT_DIR%" mkdir "%GDRIVE_ALT_DIR%"
    copy /Y "%DB_FILE%" "%GDRIVE_ALT_DIR%\dev_backup_%TIMESTAMP%.db" >nul
    if %errorlevel% equ 0 (
        echo [SUCCESS] Backup copied to Google Drive folder.
        set "BACKED_UP=1"
    ) else (
        echo [ERROR] Failed to copy backup to Google Drive folder.
    )
)

if "%BACKED_UP%"=="1" (
    echo [SUCCESS] Cloud backup synchronization completed!
) else (
    echo [WARNING] No active OneDrive or Google Drive desktop sync folder was found.
)
exit /b

:do_backup_silent
set "ONEDRIVE_DIR=%USERPROFILE%\OneDrive\Career_Launcher_ERP_Backups"
set "GDRIVE_DIR=G:\My Drive\Career_Launcher_ERP_Backups"
set "GDRIVE_ALT_DIR=%USERPROFILE%\Google Drive\Career_Launcher_ERP_Backups"
for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'"`) do set "TIMESTAMP=%%i"
set "DB_FILE=%APPDATA%\career-launcher-erp\dev.db"

if not exist "%DB_FILE%" exit /b

if exist "%USERPROFILE%\OneDrive" (
    if not exist "%ONEDRIVE_DIR%" mkdir "%ONEDRIVE_DIR%"
    copy /Y "%DB_FILE%" "%ONEDRIVE_DIR%\dev_backup_%TIMESTAMP%.db" >nul
)
if exist "G:\My Drive" (
    if not exist "%GDRIVE_DIR%" mkdir "%GDRIVE_DIR%"
    copy /Y "%DB_FILE%" "%GDRIVE_DIR%\dev_backup_%TIMESTAMP%.db" >nul
) else if exist "%USERPROFILE%\Google Drive" (
    if not exist "%GDRIVE_ALT_DIR%" mkdir "%GDRIVE_ALT_DIR%"
    copy /Y "%DB_FILE%" "%GDRIVE_ALT_DIR%\dev_backup_%TIMESTAMP%.db" >nul
)
exit /b
