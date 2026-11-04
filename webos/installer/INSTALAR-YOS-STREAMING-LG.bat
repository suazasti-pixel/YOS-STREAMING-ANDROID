@echo off
setlocal
title YOS Streaming LG - Instalador para webOS
color 0B
cd /d "%~dp0"

set "PS1=%~dp0instalar-yos-streaming-tv.ps1"
if not exist "%PS1%" (
    echo.
    echo [ERROR] No se encontro instalar-yos-streaming-tv.ps1.
    echo Extrae el ZIP completo antes de ejecutar este instalador.
    echo.
    pause
    exit /b 1
)

where powershell.exe >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] No se encontro Windows PowerShell.
    echo.
    pause
    exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -Ipk "%~dp0com.yos.streaming.tv_1.8.0_all.ipk" %*
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
    echo No se pudo completar la instalacion. Revisa el mensaje anterior.
) else (
    echo Proceso finalizado.
)
echo.
pause
exit /b %RC%
