@echo off
setlocal enabledelayedexpansion

cd /d D:\RadarPRO-App

echo.
echo  ============================================
echo   RADARPRO ^| AUTO DEPLOY
echo  ============================================
echo.

:: Check git is available
where git >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Git not found. Is Git installed?
    pause & exit /b
)

:: Show current branch
for /f %%i in ('git rev-parse --abbrev-ref HEAD') do set BRANCH=%%i
echo  Branch  : %BRANCH%

:: Count changed files
for /f %%i in ('git status --short ^| find /c /v ""') do set CHANGES=%%i
echo  Changes : %CHANGES% file(s)
echo.

if "%CHANGES%"=="0" (
    echo  Nothing to commit. No changes detected.
    echo.
    pause & exit /b
)

:: Show what's changing
echo  Files changed:
git status --short
echo.

:: Auto-generate commit message with timestamp
for /f "tokens=1-3 delims=/ " %%a in ("%DATE%") do set TODAY=%%c-%%a-%%b
for /f "tokens=1-2 delims=: " %%a in ("%TIME%") do set NOW=%%a:%%b
set NOW=%NOW: =0%
set COMMITMSG=update %TODAY% %NOW%

echo  Commit  : "%COMMITMSG%"
echo.

echo  [1/3] Staging all changes...
git add .
if errorlevel 1 ( echo  FAILED at git add & pause & exit /b )

echo  [2/3] Committing...
git commit -m "%COMMITMSG%"
if errorlevel 1 ( echo  FAILED at git commit & pause & exit /b )

echo  [3/3] Pushing to GitHub...
git push origin %BRANCH%
if errorlevel 1 ( echo  FAILED at git push & pause & exit /b )

echo.
echo  ============================================
echo   SUCCESS! All done.
echo.
echo   Next step:
echo   1. Go to render.com
echo   2. Open your frontend service
echo   3. Click: Manual Deploy
echo          ^> Deploy latest commit
echo  ============================================
echo.
pause
