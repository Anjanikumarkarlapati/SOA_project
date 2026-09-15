<#
.SYNOPSIS
  Start, stop or check the AgriTech microservice stack.

.EXAMPLE
  ./scripts/stack.ps1 start     # build if needed, then launch every service in order
  ./scripts/stack.ps1 status
  ./scripts/stack.ps1 stop
#>
param(
    [ValidateSet('start', 'stop', 'status', 'restart')]
    [string]$Action = 'start',

    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $root '.run'

# Load local environment variables (kept out of Git) before starting child Java processes.
$envFile = Join-Path $root '.env'
if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
        $parts = $trimmed -split '=', 2
        if ($parts.Count -eq 2) {
            [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), 'Process')
        }
    }
}

# Eureka must be up before anything registers; the gateway last so its routes resolve.
$services = @(
    @{ Name = 'eureka-server';      Port = 8761 },
    @{ Name = 'auth-service';       Port = 8081 },
    @{ Name = 'sensor-service';     Port = 8082 },
    @{ Name = 'crop-service';       Port = 8083 },
    @{ Name = 'irrigation-service'; Port = 8084 },
    @{ Name = 'api-gateway';        Port = 8080 }
)

function Get-PortOwner([int]$Port) {
    try { (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop).OwningProcess }
    catch { $null }
}

function Wait-ForPort([int]$Port, [string]$Name, [int]$TimeoutSeconds = 90) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $health = Invoke-RestMethod "http://localhost:$Port/actuator/health" -TimeoutSec 2
            if ($health.status -eq 'UP') { return $true }
        } catch { Start-Sleep -Milliseconds 800 }
    }
    return $false
}

function Start-Stack {
    if (-not $SkipBuild) {
        Write-Host 'Building all modules...' -ForegroundColor Cyan
        & (Join-Path $root 'mvnw.cmd') -q -B install -DskipTests
        if ($LASTEXITCODE -ne 0) { throw 'Maven build failed' }
    }

    if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

    foreach ($service in $services) {
        if (Get-PortOwner $service.Port) {
            Write-Host ("{0,-20} already listening on {1}" -f $service.Name, $service.Port) -ForegroundColor Yellow
            continue
        }
        $jar = Join-Path $root "$($service.Name)/target/$($service.Name)-1.0.0.jar"
        if (-not (Test-Path $jar)) { throw "Missing $jar - run without -SkipBuild" }

        $log = Join-Path $logDir "$($service.Name).log"
        Start-Process -FilePath 'java' -ArgumentList @('-jar', $jar) `
            -RedirectStandardOutput $log -RedirectStandardError "$log.err" `
            -WindowStyle Hidden | Out-Null

        if (Wait-ForPort $service.Port $service.Name) {
            Write-Host ("{0,-20} UP on {1}" -f $service.Name, $service.Port) -ForegroundColor Green
        } else {
            throw "$($service.Name) did not become healthy - see $log"
        }
    }

    Write-Host ''
    Write-Host 'Eureka dashboard : http://localhost:8761' -ForegroundColor Cyan
    Write-Host 'API gateway      : http://localhost:8080' -ForegroundColor Cyan
    Write-Host 'Dashboard UI     : npm run dev --prefix frontend  (http://localhost:5173)' -ForegroundColor Cyan
    Write-Host ''
    Write-Host 'Services need ~30s to appear in each other''s registry snapshot.' -ForegroundColor DarkGray
}

function Stop-Stack {
    foreach ($service in ($services | Sort-Object { $_.Port } -Descending)) {
        $owner = Get-PortOwner $service.Port
        if ($owner) {
            Stop-Process -Id $owner -Force
            Write-Host ("{0,-20} stopped" -f $service.Name) -ForegroundColor DarkYellow
        }
    }
}

function Show-Status {
    foreach ($service in $services) {
        $owner = Get-PortOwner $service.Port
        $state = if ($owner) { "UP   (pid $owner)" } else { 'DOWN' }
        $color = if ($owner) { 'Green' } else { 'DarkGray' }
        Write-Host ("{0,-20} {1,-6} {2}" -f $service.Name, $service.Port, $state) -ForegroundColor $color
    }
}

switch ($Action) {
    'start'   { Start-Stack }
    'stop'    { Stop-Stack }
    'status'  { Show-Status }
    'restart' { Stop-Stack; Start-Stack }
}
