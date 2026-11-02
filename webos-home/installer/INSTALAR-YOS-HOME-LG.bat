@echo off
setlocal
title YOS Home LG - Instalador webOS
color 0B
cd /d "%~dp0"
where powershell.exe >nul 2>&1
if errorlevel 1 (echo No se encontro PowerShell.& pause& exit /b 1)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar-yos-home-tv.ps1" %*
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" echo La instalacion fallo. Revisa Developer Mode, Key Server y la conexion de red.
pause
exit /b %RC%
