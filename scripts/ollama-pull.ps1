# Pulls the local models once (persisted in the ollama-data volume).
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
docker compose exec ollama ollama pull qwen2.5:3b-instruct
docker compose exec ollama ollama pull bge-m3
docker compose exec ollama ollama list
