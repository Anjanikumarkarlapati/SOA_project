<#
.SYNOPSIS
Create the local PostgreSQL role + database for AgriTech and point .env at it.

.EXAMPLE
.\scripts\db-setup.ps1
Asks for the 'postgres' superuser password (the one set in the PostgreSQL installer),
creates role + database 'agritech' if missing, gives the role a fresh random password,
and writes DB_URL / DB_USERNAME / DB_PASSWORD into .env (old DB_* lines are commented
out, the previous file is kept as .env.bak). Safe to re-run.
#>

param(
    [string]$DbHost = 'localhost',
    [int]$Port = 5432,
    [string]$Name = 'agritech'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'

# psql is usually not on PATH on Windows; take the newest installed version.
$psql = (Get-Command psql -ErrorAction SilentlyContinue).Source
if (-not $psql) {
    $psql = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue |
        Sort-Object { [int]$_.Directory.Parent.Name } -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $psql) {
    throw "psql not found. Install PostgreSQL 16+ (winget install PostgreSQL.PostgreSQL.16) and re-run."
}
Write-Host "Using $psql"

# A pre-set PGPASSWORD (non-interactive runs) is used as-is; otherwise ask.
if (-not $env:PGPASSWORD) {
    $secure = Read-Host "Password for superuser 'postgres' (set in the PostgreSQL installer)" -AsSecureString
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}

# Hex only, so the .env loader in stack.ps1 and the SQL literal need no escaping.
$bytes = New-Object byte[] 16
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$appPassword = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''

# Piped on stdin, not argv, so the password never shows up in the process list.
$sql = @'
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '__NAME__') THEN CREATE ROLE __NAME__ LOGIN; END IF;
END $$;
ALTER ROLE __NAME__ WITH LOGIN PASSWORD '__PW__';
SELECT 'CREATE DATABASE __NAME__ OWNER __NAME__'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '__NAME__') \gexec
'@ -replace '__NAME__', $Name -replace '__PW__', $appPassword

try {
    $sql | & $psql -h $DbHost -p $Port -U postgres -d postgres -v ON_ERROR_STOP=1 -q -w
    if ($LASTEXITCODE -ne 0) {
        throw "Could not create role/database. If the password was rejected, it is the one chosen in the PostgreSQL installer."
    }

    $env:PGPASSWORD = $appPassword
    & $psql -h $DbHost -p $Port -U $Name -d $Name -w -tA -c "select 'Connected as ' || current_user || ' to ' || current_database()"
    if ($LASTEXITCODE -ne 0) { throw "Created the database but could not log in as $Name." }
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

# Merge into .env: keep every other line, comment out the old DB_* ones, keep a backup.
$lines = @()
if (Test-Path $envFile) {
    Copy-Item $envFile "$envFile.bak" -Force
    $lines = Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*DB_(URL|USERNAME|PASSWORD)\s*=') { "# replaced by db-setup: $_" } else { $_ }
    }
}
$lines += @(
    "DB_URL=jdbc:postgresql://${DbHost}:${Port}/${Name}",
    "DB_USERNAME=$Name",
    "DB_PASSWORD=$appPassword"
)
Set-Content -Path $envFile -Value $lines -Encoding ascii

Write-Host ".env now points at postgresql://${DbHost}:${Port}/${Name} (previous file: .env.bak)"
Write-Host "Next: .\scripts\stack.ps1 restart"
