@echo off
echo Building Cafe Kiosk Lock application...
call npm install
call npm run dist
echo.
echo Build completed! Check the dist folder for the installer.
echo.
pause 