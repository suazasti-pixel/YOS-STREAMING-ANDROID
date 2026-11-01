<#
Instalador guiado de YOS Xtream para televisores LG con webOS.

Requisitos previos:
  - Windows 10/11 y webOS TV CLI oficial de LG instalado.
  - El televisor y el PC en la misma red.
  - Developer Mode activo y el TV registrado en ares-setup-device.
  - El .ipk de YOS Xtream en esta carpeta, en dist/, o indicar su ruta.

Este script no lee ni almacena la passphrase del TV. La conexión segura y la
clave SSH se administran por la CLI oficial de webOS.
#>
[CmdletBinding()]
param(
    [string]$Ipk,
    [string]$Device,
    [switch]$DryRun,
    [switch]$NoPause
)

$ErrorActionPreference = 'Stop'
$AppId = 'com.yos.streaming.xtreamtv'

function Pause-IfNeeded {
    if (-not $NoPause -and -not [Console]::IsInputRedirected) {
        [void](Read-Host 'Pulsa ENTER para cerrar')
    }
}

function Find-AresCommand([string]$Name) {
    foreach ($candidate in @("$Name.cmd", "$Name.exe", $Name)) {
        $command = Get-Command $candidate -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($command) {
            if ($command.Path) { return $command.Path }
            if ($command.Source) { return $command.Source }
        }
    }
    return $null
}

function Invoke-Ares([string]$Name, [string[]]$Arguments) {
    $exe = Find-AresCommand $Name
    if (-not $exe) { throw "No encuentro $Name. Instala la webOS TV CLI oficial de LG y abre una nueva ventana." }
    & $exe @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Name termino con codigo $LASTEXITCODE." }
}

function Get-IpkPath {
    if ($Ipk) {
        if (-not (Test-Path -LiteralPath $Ipk -PathType Leaf)) { throw "No existe el IPK indicado: $Ipk" }
        $resolved = (Resolve-Path -LiteralPath $Ipk).Path
        if ((Split-Path -Leaf $resolved) -notmatch '^com\.yos\.streaming\.xtreamtv_.+\.ipk$') {
            throw 'El archivo no parece ser el paquete de YOS Xtream LG esperado.'
        }
        return $resolved
    }

    $candidateRoots = @($PSScriptRoot, (Join-Path $PSScriptRoot 'dist'))
    $packages = @()
    foreach ($root in $candidateRoots) {
        if (Test-Path -LiteralPath $root -PathType Container) {
            $packages += Get-ChildItem -LiteralPath $root -Filter 'com.yos.streaming.xtreamtv_*.ipk' -File -ErrorAction SilentlyContinue
        }
    }
    $packages = @($packages | Sort-Object LastWriteTime -Descending)

    if ($packages.Count -eq 1) { return $packages[0].FullName }
    if ($packages.Count -gt 1) {
        Write-Host 'Hay varios paquetes .ipk:' -ForegroundColor Cyan
        for ($i = 0; $i -lt $packages.Count; $i++) {
            Write-Host ("  {0}) {1} ({2:N1} MB)" -f ($i + 1), $packages[$i].Name, ($packages[$i].Length / 1MB))
        }
        $choice = Read-Host 'Escribe el numero del paquete YOS Xtream'
        $number = 0
        if (-not [int]::TryParse($choice, [ref]$number) -or $number -lt 1 -or $number -gt $packages.Count) {
            throw 'La seleccion del IPK no es valida.'
        }
        return $packages[$number - 1].FullName
    }

    $manualPath = Read-Host 'Pega la ruta completa del archivo .ipk de YOS Xtream'
    if (-not (Test-Path -LiteralPath $manualPath -PathType Leaf)) { throw "No existe el archivo indicado: $manualPath" }
    $resolved = (Resolve-Path -LiteralPath $manualPath).Path
    if ((Split-Path -Leaf $resolved) -notmatch '^com\.yos\.streaming\.xtreamtv_.+\.ipk$') {
        throw 'El archivo no parece ser el paquete de YOS Xtream LG esperado.'
    }
    return $resolved
}

try {
    Clear-Host
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor DarkCyan
    Write-Host '       INSTALADOR YOS XTREAM PARA TELEVISORES LG' -ForegroundColor White
    Write-Host '============================================================' -ForegroundColor DarkCyan
    Write-Host 'Usa la webOS TV CLI oficial; no guarda claves ni contrasenas.' -ForegroundColor Gray
    Write-Host ''

    foreach ($tool in @('ares-setup-device', 'ares-device', 'ares-install', 'ares-launch')) {
        if (-not (Find-AresCommand $tool)) {
            throw "Falta $tool. Instala la webOS TV CLI oficial de LG; guia: https://webostv.developer.lge.com/develop/tools/cli-dev-guide"
        }
    }

    $ipkPath = Get-IpkPath
    Write-Host ("Paquete: {0}" -f (Split-Path -Leaf $ipkPath)) -ForegroundColor Green
    Write-Host ''
    Write-Host 'Dispositivos registrados en webOS CLI:' -ForegroundColor Cyan
    Invoke-Ares 'ares-setup-device' @('--list')
    Write-Host ''

    if ([string]::IsNullOrWhiteSpace($Device)) {
        $Device = Read-Host 'Escribe el nombre exacto del televisor registrado (por ejemplo, myTV)'
    }
    if ([string]::IsNullOrWhiteSpace($Device)) { throw 'No se indico el nombre del dispositivo.' }

    Write-Host ''
    Write-Host 'Comprobando la conexion con el televisor...' -ForegroundColor Cyan
    Invoke-Ares 'ares-device' @('--system-info', '--device', $Device)

    if ($DryRun) {
        Write-Host ''
        Write-Host 'DRY RUN: conexion y paquete verificados; no se instalo nada.' -ForegroundColor Yellow
        exit 0
    }

    Write-Host ''
    Write-Host 'Instalando o actualizando YOS Xtream...' -ForegroundColor Cyan
    Invoke-Ares 'ares-install' @('--device', $Device, $ipkPath)

    Write-Host ''
    Write-Host 'Abriendo YOS Xtream en el televisor...' -ForegroundColor Cyan
    Invoke-Ares 'ares-launch' @('--device', $Device, $AppId)

    Write-Host ''
    Write-Host 'Listo: YOS Xtream se instalo y se abrio en el TV.' -ForegroundColor Green
    Write-Host 'Developer Mode es para pruebas; LG puede quitar las apps al vencer la sesion.' -ForegroundColor Gray
    exit 0
} catch {
    Write-Host ''
    Write-Host ("ERROR: {0}" -f $_.Exception.Message) -ForegroundColor Red
    Write-Host ''
    Write-Host 'Verifica que Developer Mode y Key Server esten activos y que el PC y el TV compartan la red.' -ForegroundColor Yellow
    Write-Host 'Si el TV aun no esta registrado, usa ares-setup-device y la guia oficial de LG.' -ForegroundColor Yellow
    Write-Host 'LG: https://webostv.developer.lge.com/develop/getting-started/developer-mode-app' -ForegroundColor Gray
    Pause-IfNeeded
    exit 1
}
