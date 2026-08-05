@echo off
setlocal

set "PRUMOQ_ROOT=%~dp0"
if "%PRUMOQ_ROOT:~-1%"=="\" set "PRUMOQ_ROOT=%PRUMOQ_ROOT:~0,-1%"
set "PRUMOQ_LOG_DIR=%TEMP%\prumoq-dev-logs"

if /I "%~1"=="stop" goto :stop

start "" /b powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -Command "$root = $env:PRUMOQ_ROOT; $logDirectory = $env:PRUMOQ_LOG_DIR; $null = New-Item -ItemType Directory -Path $logDirectory -Force; function Start-PrumoQService([string] $name, [string] $command, [int] $port) { if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) { return }; Start-Process -FilePath 'pnpm.cmd' -ArgumentList $command -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDirectory ($name + '.stdout.log')) -RedirectStandardError (Join-Path $logDirectory ($name + '.stderr.log')) }; Start-PrumoQService 'admin' 'web' 3000; Start-PrumoQService 'pwa' 'mobile:web' 8081"
exit /b

:stop
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -Command "$processIds = @{}; foreach ($connection in (Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue)) { if ($connection.LocalPort -eq 3000 -or $connection.LocalPort -eq 8081) { $processIds[$connection.OwningProcess] = $true } }; foreach ($processId in $processIds.Keys) { Stop-Process -Id $processId -Force }"
exit /b
