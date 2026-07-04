# Fills .env (copied from .env.example if absent) with generated secrets.
# Idempotent: only replaces values that are still "<generated>".
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repo '.env'
if (-not (Test-Path $envPath)) {
    Copy-Item (Join-Path $repo '.env.example') $envPath
    Write-Output "Created .env from .env.example"
}

function New-RandomString([int]$bytes) {
    $buf = New-Object byte[] $bytes
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    # base64url, no padding — safe in env files and URLs
    return [Convert]::ToBase64String($buf).TrimEnd('=').Replace('+','-').Replace('/','_')
}
function New-HexString([int]$bytes) {
    $buf = New-Object byte[] $bytes
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    return -join ($buf | ForEach-Object { $_.ToString('x2') })
}
function ConvertTo-Base64Url([byte[]]$bytes) {
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
}
function New-SupabaseJwt([string]$role, [string]$secret) {
    $header  = '{"alg":"HS256","typ":"JWT"}'
    $iat = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $exp = $iat + (10 * 365 * 24 * 3600)  # 10 years
    $payload = "{`"role`":`"$role`",`"iss`":`"supabase`",`"iat`":$iat,`"exp`":$exp}"
    $h = ConvertTo-Base64Url ([Text.Encoding]::UTF8.GetBytes($header))
    $p = ConvertTo-Base64Url ([Text.Encoding]::UTF8.GetBytes($payload))
    $hmac = New-Object Security.Cryptography.HMACSHA256
    $hmac.Key = [Text.Encoding]::UTF8.GetBytes($secret)
    $sig = ConvertTo-Base64Url ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes("$h.$p")))
    return "$h.$p.$sig"
}

$content = Get-Content $envPath -Raw

# JWT_SECRET must be generated before the keys signed with it
$jwtSecret = New-RandomString 40
if ($content -match '(?m)^JWT_SECRET=<generated>') {
    $content = $content -replace '(?m)^JWT_SECRET=<generated>', "JWT_SECRET=$jwtSecret"
} else {
    # keep existing secret so re-runs don't invalidate existing keys
    if ($content -match '(?m)^JWT_SECRET=(.+)$') { $jwtSecret = $Matches[1].Trim() }
}

$replacements = [ordered]@{
    'JOBPILOT_USER_ID'          = [guid]::NewGuid().ToString()
    'JOBPILOT_LOGIN_PASSWORD'   = New-RandomString 18
    'POSTGRES_PASSWORD'         = New-RandomString 24
    'ANON_KEY'                  = New-SupabaseJwt 'anon' $jwtSecret
    'SERVICE_ROLE_KEY'          = New-SupabaseJwt 'service_role' $jwtSecret
    'DASHBOARD_PASSWORD'        = New-RandomString 18
    'SECRET_KEY_BASE'           = New-RandomString 48
    'REALTIME_DB_ENC_KEY'       = New-HexString 8      # exactly 16 chars
    'PG_META_CRYPTO_KEY'        = New-RandomString 24
    'S3_PROTOCOL_ACCESS_KEY_ID' = New-HexString 16
    'S3_PROTOCOL_ACCESS_KEY_SECRET' = New-HexString 32
    'N8N_ENCRYPTION_KEY'        = New-RandomString 24
    'LITELLM_MASTER_KEY'        = "sk-$(New-RandomString 24)"
    'LANGFUSE_DB_PASSWORD'      = New-RandomString 24
    'LANGFUSE_SALT'             = New-RandomString 24
    'LANGFUSE_NEXTAUTH_SECRET'  = New-RandomString 24
}
foreach ($key in $replacements.Keys) {
    $pattern = "(?m)^$key=<generated>"
    if ($content -match $pattern) {
        $content = $content -replace $pattern, "$key=$($replacements[$key])"
        Write-Output "Generated $key"
    }
}

Set-Content -Path $envPath -Value $content -Encoding ascii -NoNewline
Write-Output "Done. Remaining manual values:"
Select-String -Path $envPath -Pattern '<manual' | ForEach-Object { $_.Line }
