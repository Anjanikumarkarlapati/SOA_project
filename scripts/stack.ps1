<#
.SYNOPSIS
Start, stop, restart, or check the AgriTech microservice stack.

.EXAMPLE
.\scripts\stack.ps1 start
.\scripts\stack.ps1 status
.\scripts\stack.ps1 stop
.\scripts\stack.ps1 start -Replicas   # also a 2nd sensor/crop/irrigation instance, to show Eureka load balancing
#>

param(
    [ValidateSet('start', 'stop', 'status', 'restart')]
    [string]$Action = 'start',

    [switch]$SkipBuild,

    [switch]$Replicas
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $root '.run'

# Load variables from .env, if present.
$envFile = Join-Path $root '.env'
if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
        $trimmed = $line.Trim()

        if (-not $trimmed -or $trimmed.StartsWith('#')) {
            continue
        }

        $parts = $trimmed -split '=', 2
        if ($parts.Count -eq 2) {
            [Environment]::SetEnvironmentVariable(
                $parts[0].Trim(),
                $parts[1].Trim(),
                'Process'
            )
        }
    }
}

# Every instance of a service shares one H2 file DB here, so load-balanced replicas agree.
$env:AGRITECH_DATA_DIR = Join-Path $logDir 'data'

$services = @(
    @{ Name = 'eureka-server';      Port = 8761 },
    @{ Name = 'auth-service';       Port = 8081 },
    @{ Name = 'sensor-service';     Port = 8082 },
    @{ Name = 'crop-service';       Port = 8083 },
    @{ Name = 'irrigation-service'; Port = 8084 },
    @{ Name = 'api-gateway';        Port = 8080 }
)

# Second instances: same Eureka name, different port. Timed jobs stay on the primary only.
$replicaServices = @(
    @{ Name = 'sensor-service';     Port = 18082; Label = 'sensor-service#2' },
    @{ Name = 'crop-service';       Port = 18083; Label = 'crop-service#2' },
    @{ Name = 'irrigation-service'; Port = 18084; Label = 'irrigation-service#2' }
)

function Get-PortOwner {
    param([int]$Port)

    try {
        return (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop |
            Select-Object -First 1).OwningProcess
    }
    catch {
        return $null
    }
}

function Wait-ForPort {
    param(
        [int]$Port,
        [string]$Name,
        [int]$TimeoutSeconds = 90
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    while ((Get-Date) -lt $deadline) {
        try {
            $health = Invoke-RestMethod `
                -Uri "http://localhost:$Port/actuator/health" `
                -TimeoutSec 2

            if ($health.status -eq 'UP') {
                return $true
            }
        }
        catch {
            Start-Sleep -Milliseconds 800
        }
    }

    return $false
}

function Start-Stack {
    if (-not $SkipBuild) {
        Write-Host 'Building all modules...' -ForegroundColor Cyan

        # JVM warnings on stderr must not abort under ErrorActionPreference=Stop; exit code decides.
        & { $ErrorActionPreference = 'Continue'; & (Join-Path $root 'mvnw.cmd') -q -B install -DskipTests 2>&1 | Out-Host }

        if ($LASTEXITCODE -ne 0) {
            throw 'Maven build failed.'
        }
    }

    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir | Out-Null
    }

    $toStart = if ($Replicas) { $services + $replicaServices } else { $services }

    foreach ($service in $toStart) {
        $label = if ($service.Label) { $service.Label } else { $service.Name }
        $existingProcess = Get-PortOwner $service.Port

        if ($existingProcess) {
            Write-Host (
                "{0,-20} already listening on port {1}" -f
                $label, $service.Port
            ) -ForegroundColor Yellow
            continue
        }

        $jar = Join-Path $root "$($service.Name)\target\$($service.Name)-1.0.0.jar"

        if (-not (Test-Path $jar)) {
            throw "Missing JAR: $jar. Run without -SkipBuild."
        }

        $log = Join-Path $logDir "$label.log"
        $errorLog = Join-Path $logDir "$label.err.log"

        Write-Host (
            "Starting {0} on port {1}..." -f
            $label, $service.Port
        ) -ForegroundColor Cyan

        $javaArgs = @('-jar', $jar)
        if ($service.Label) {
            $javaArgs += @("--server.port=$($service.Port)", '--agritech.jobs.enabled=false')
        }

        Start-Process `
            -FilePath 'java' `
            -ArgumentList $javaArgs `
            -RedirectStandardOutput $log `
            -RedirectStandardError $errorLog `
            -WindowStyle Hidden | Out-Null

        if (Wait-ForPort -Port $service.Port -Name $label) {
            Write-Host (
                "{0,-20} UP on port {1}" -f
                $label, $service.Port
            ) -ForegroundColor Green
        }
        else {
            throw "$label did not become healthy. Check $log"
        }
    }

    Write-Host ''
    Write-Host 'Eureka dashboard : http://localhost:8761' -ForegroundColor Cyan
    Write-Host 'API gateway      : http://localhost:8080' -ForegroundColor Cyan
    Write-Host 'Postman base URL : http://localhost:8080' -ForegroundColor Cyan
    Write-Host ''
    Write-Host 'Wait about 30 seconds for all API gateway routes to register.' -ForegroundColor DarkGray
}

function Stop-Stack {
    foreach ($service in $replicaServices) {
        $owner = Get-PortOwner $service.Port
        if ($owner) {
            Stop-Process -Id $owner -Force
            Write-Host ("{0,-20} stopped" -f $service.Label) -ForegroundColor DarkYellow
        }
    }

    foreach ($service in ($services | Sort-Object { $_.Port } -Descending)) {
        $owner = Get-PortOwner $service.Port

        if ($owner) {
            Stop-Process -Id $owner -Force

            Write-Host (
                "{0,-20} stopped" -f $service.Name
            ) -ForegroundColor DarkYellow
        }
        else {
            Write-Host (
                "{0,-20} already stopped" -f $service.Name
            ) -ForegroundColor DarkGray
        }
    }
}

function Show-Status {
    foreach ($service in $services) {
        $owner = Get-PortOwner $service.Port

        if ($owner) {
            $state = "UP (PID $owner)"
            $color = 'Green'
        }
        else {
            $state = 'DOWN'
            $color = 'DarkGray'
        }

        Write-Host (
            "{0,-20} {1,-6} {2}" -f
            $service.Name, $service.Port, $state
        ) -ForegroundColor $color
    }

    foreach ($service in $replicaServices) {
        $owner = Get-PortOwner $service.Port
        if ($owner) {
            Write-Host ("{0,-20} {1,-6} UP (PID {2})" -f $service.Label, $service.Port, $owner) -ForegroundColor Green
        }
    }
}

switch ($Action) {
    'start' {
        Start-Stack
    }
    'stop' {
        Stop-Stack
    }
    'status' {
        Show-Status
    }
    'restart' {
        Stop-Stack
        Start-Stack
    }
}
