# Idempotent migration runner: applies supabase/migrations/*.sql in order via
# dockerized psql, tracking applied files in public.schema_migrations.
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

# read JOBPILOT_USER_ID from .env
$userId = (Select-String -Path .\.env -Pattern '^JOBPILOT_USER_ID=(.+)$').Matches[0].Groups[1].Value.Trim()
if (-not $userId) { throw "JOBPILOT_USER_ID missing from .env - run scripts/generate-keys.ps1 first" }

function Invoke-Psql([string]$sql) {
    $sql | docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -t -A
    if ($LASTEXITCODE -ne 0) { throw "psql failed" }
}

Invoke-Psql "CREATE TABLE IF NOT EXISTS public.schema_migrations (filename text PRIMARY KEY, applied_at timestamptz DEFAULT now());" | Out-Null

$applied = (Invoke-Psql "SELECT filename FROM public.schema_migrations;") -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ }

Get-ChildItem .\supabase\migrations\*.sql | Sort-Object Name | ForEach-Object {
    $name = $_.Name
    if ($applied -contains $name) {
        Write-Output "skip   $name (already applied)"
        return
    }
    Write-Output "apply  $name"
    # -1 = single transaction: a mid-file failure rolls the whole migration
    # back, so it can be fixed and rerun instead of leaving partial schema
    Get-Content $_.FullName -Raw | docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -1 -v "jobpilot_user_id=$userId"
    if ($LASTEXITCODE -ne 0) { throw "migration $name failed" }
    Invoke-Psql "INSERT INTO public.schema_migrations (filename) VALUES ('$name');" | Out-Null
}
Write-Output "migrations complete"
