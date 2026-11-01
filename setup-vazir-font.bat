@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Linko - Download and Configure Vazir Font

cd /d "%~dp0"
if errorlevel 1 (
    echo [ERROR] Could not open the project directory.
    pause
    exit /b 1
)

set "FONT_VERSION=30.1.0"
set "FONT_BASE=https://cdn.jsdelivr.net/npm/vazir-font@%FONT_VERSION%/dist"
set "FONT_DIR=%~dp0public\assets\fonts"
set "LICENSE_URL=https://raw.githubusercontent.com/rastikerdar/vazir-font/master/OFL.txt"

if not exist "%FONT_DIR%" mkdir "%FONT_DIR%"
if errorlevel 1 goto :failed

echo.
echo ================================================
echo     Vazir Font - Download and Setup
echo ================================================
echo Version: %FONT_VERSION%
echo Destination: %FONT_DIR%
echo.

call :download "Vazir-Thin.woff2" "%FONT_BASE%/Vazir-Thin.woff2" 1000
if errorlevel 1 goto :failed
call :download "Vazir-Light.woff2" "%FONT_BASE%/Vazir-Light.woff2" 1000
if errorlevel 1 goto :failed
call :download "Vazir-Regular.woff2" "%FONT_BASE%/Vazir-Regular.woff2" 1000
if errorlevel 1 goto :failed
call :download "Vazir-Medium.woff2" "%FONT_BASE%/Vazir-Medium.woff2" 1000
if errorlevel 1 goto :failed
call :download "Vazir-Bold.woff2" "%FONT_BASE%/Vazir-Bold.woff2" 1000
if errorlevel 1 goto :failed
call :download "Vazir-Black.woff2" "%FONT_BASE%/Vazir-Black.woff2" 1000
if errorlevel 1 goto :failed
call :download "OFL.txt" "%LICENSE_URL%" 500
if errorlevel 1 goto :failed

if not exist "%~dp0src\styles\fonts.css" (
    echo [ERROR] src\styles\fonts.css is missing.
    goto :failed
)

echo.
echo [OK] Vazir font files and OFL license downloaded.
echo [OK] The project CSS is configured to use the local Vazir files.

if exist "%~dp0node_modules\" (
    echo.
    echo Rebuilding the Tailwind stylesheet...
    call npm run build:css
    if errorlevel 1 goto :build_warning
    echo [OK] Tailwind stylesheet rebuilt successfully.
) else (
    echo.
    echo [INFO] node_modules was not found. The current compiled style.css
    echo        already references Vazir. To rebuild it later, run:
    echo        npm install
    echo        npm run build:css
)

echo.
echo ================================================
echo Setup completed successfully.
echo Start the app with: npm run dev
echo Open: http://localhost:3000
echo ================================================
pause
exit /b 0

:download
set "FILE_NAME=%~1"
set "FILE_URL=%~2"
set "MIN_SIZE=%~3"
echo Downloading %FILE_NAME% ...

where curl.exe >nul 2>&1
if not errorlevel 1 (
    curl.exe --fail --location --silent --show-error --retry 3 --connect-timeout 20 --max-time 120 --output "%FONT_DIR%\%FILE_NAME%" "%FILE_URL%"
) else (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; $ErrorActionPreference='Stop'; try { Invoke-WebRequest -Uri '%FILE_URL%' -OutFile '%FONT_DIR%\%FILE_NAME%' -UseBasicParsing; exit 0 } catch { Write-Error $_; exit 1 }"
)
if errorlevel 1 exit /b 1

for %%F in ("%FONT_DIR%\%FILE_NAME%") do if %%~zF LSS %MIN_SIZE% (
    echo [ERROR] Downloaded file %FILE_NAME% is missing or too small.
    exit /b 1
)
exit /b 0

:build_warning
echo [WARNING] Font files were downloaded, but Tailwind build failed.
echo Run npm install and npm run build:css, then retry if necessary.
pause
exit /b 1

:failed
echo.
echo [ERROR] Font setup did not finish. Check your internet connection
 echo        and make sure the project files are complete, then retry.
pause
exit /b 1
