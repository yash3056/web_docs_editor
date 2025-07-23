@echo off
title Web Docs Editor - Electron
echo Starting Web Docs Editor in Electron...
echo.
echo To stop the application, simply close the window.
echo The server will shutdown automatically.
echo.
npm run electron
echo.
echo Application closed successfully.
pause

@REM @echo off
@REM echo Building Web Docs Editor for Windows...
@REM npm run build
@REM echo Build completed! Check the dist-windows folder.
@REM pause
