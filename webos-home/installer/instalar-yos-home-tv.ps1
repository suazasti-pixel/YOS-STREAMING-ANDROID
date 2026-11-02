[CmdletBinding()]
param([string]$Ipk, [string]$Device)
$ErrorActionPreference = 'Stop'
$AppId = 'com.yos.launcher.home'
function Find-Ares([string]$Name) {
  foreach ($n in @("$Name.cmd", "$Name.exe", $Name)) {
    $c = Get-Command $n -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($c) { if ($c.Path) { return $c.Path }; if ($c.Source) { return $c.Source } }
  }
  return $null
}
function Invoke-Ares([string]$Name, [string[]]$CliArgs) {
  $exe = Find-Ares $Name
  if (-not $exe) { throw "No encuentro $Name. Instala webOS TV CLI de LG y abre PowerShell de nuevo." }
  & $exe @CliArgs
  if ($LASTEXITCODE -ne 0) { throw "$Name terminó con código $LASTEXITCODE." }
}
try {
  if (-not $Ipk) {
    $found = @(Get-ChildItem -LiteralPath $PSScriptRoot -Filter 'com.yos.launcher.home_*.ipk' -File)
    if ($found.Count -eq 1) { $Ipk = $found[0].FullName }
    elseif ($found.Count -gt 1) { throw 'Hay más de un IPK YOS Home; indica uno con -Ipk.' }
    else { throw 'No encuentro el archivo com.yos.launcher.home_*.ipk. Extrae el ZIP completo.' }
  }
  if (-not (Test-Path -LiteralPath $Ipk -PathType Leaf)) { throw "No existe el paquete $Ipk" }
  if ((Split-Path -Leaf $Ipk) -notmatch '^com\.yos\.launcher\.home_.+\.ipk$') { throw 'El archivo no corresponde a YOS Home.' }
  foreach ($tool in @('ares-setup-device','ares-device','ares-install','ares-launch')) { if (-not (Find-Ares $tool)) { throw "Falta $tool. Instala webOS TV CLI de LG: https://webostv.developer.lge.com/develop/tools/cli-dev-guide" } }
  Invoke-Ares 'ares-setup-device' @('--list')
  if ([string]::IsNullOrWhiteSpace($Device)) { $Device = Read-Host 'Nombre exacto del TV registrado en ares-setup-device' }
  if ([string]::IsNullOrWhiteSpace($Device)) { throw 'No indicaste el nombre del TV.' }
  Invoke-Ares 'ares-device' @('--system-info','--device',$Device)
  Invoke-Ares 'ares-install' @('--device',$Device,$Ipk)
  Invoke-Ares 'ares-launch' @('--device',$Device,$AppId)
  Write-Host 'YOS Home se instaló y abrió en el TV.' -ForegroundColor Green
} catch {
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host 'Activa Developer Mode y Key Server; el TV y PC deben estar en la misma red.' -ForegroundColor Yellow
  exit 1
}
