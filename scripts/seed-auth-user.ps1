# Creates the single dashboard user in GoTrue with id = JOBPILOT_USER_ID so
# auth.uid() matches the user_id DEFAULT on every table. Idempotent.
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot

$envMap = @{}
Get-Content (Join-Path $repo '.env') | ForEach-Object {
    if ($_ -match '^([A-Z0-9_]+)=(.*)$') { $envMap[$Matches[1]] = $Matches[2].Trim() }
}
$required = 'JOBPILOT_USER_ID','JOBPILOT_LOGIN_EMAIL','JOBPILOT_LOGIN_PASSWORD','SERVICE_ROLE_KEY','SUPABASE_PUBLIC_URL'
foreach ($k in $required) { if (-not $envMap[$k]) { throw "$k missing from .env" } }

$headers = @{
    apikey        = $envMap['SERVICE_ROLE_KEY']
    Authorization = "Bearer $($envMap['SERVICE_ROLE_KEY'])"
}
$body = @{
    id            = $envMap['JOBPILOT_USER_ID']
    email         = $envMap['JOBPILOT_LOGIN_EMAIL']
    password      = $envMap['JOBPILOT_LOGIN_PASSWORD']
    email_confirm = $true
} | ConvertTo-Json

try {
    $resp = Invoke-RestMethod -Method Post -Uri "$($envMap['SUPABASE_PUBLIC_URL'])/auth/v1/admin/users" -Headers $headers -Body $body -ContentType 'application/json'
    Write-Output "Created auth user $($resp.id) ($($resp.email))"
} catch {
    $err = $_.ErrorDetails.Message
    if ($err -match 'already been registered|already exists|duplicate') {
        Write-Output "Auth user already exists - OK"
    } else {
        throw
    }
}
