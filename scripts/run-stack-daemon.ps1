param([switch]$Replicas)
Set-ExecutionPolicy -Scope Process Bypass
& "$PSScriptRoot\stack.ps1" stop
if ($Replicas) {
    & "$PSScriptRoot\stack.ps1" start -SkipBuild -Replicas
} else {
    & "$PSScriptRoot\stack.ps1" start -SkipBuild
}
Write-Host "All services started! Keeping daemon alive..."
while ($true) {
    Start-Sleep -Seconds 60
}
