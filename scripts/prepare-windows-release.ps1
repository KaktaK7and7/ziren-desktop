param(
    [Parameter(Mandatory = $true)]
    [string]$PayloadRoot,

    [switch]$BuildInstaller
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$payloadRoot = (Resolve-Path $PayloadRoot).Path
$targetTriple = "x86_64-pc-windows-msvc"
$coreSource = Join-Path $payloadRoot "build\windows-core\assistant-core.exe"
$modelSource = Join-Path $payloadRoot "build\release-assets\vosk-model-small-ru-0.22"
$coreTargetDir = Join-Path $repoRoot "src-tauri\binaries"
$coreTarget = Join-Path $coreTargetDir "assistant-core-$targetTriple.exe"
$resourceRoot = Join-Path $repoRoot "src-tauri\resources"
$modelTarget = Join-Path $resourceRoot "models\vosk\vosk-model-small-ru-0.22"
$releaseManifest = Join-Path $resourceRoot "release-manifest.json"

if (-not (Test-Path $coreSource -PathType Leaf)) {
    throw "Core release binary not found: $coreSource"
}

$coreInfo = Get-Item $coreSource
if ($coreInfo.Length -lt 1MB) {
    throw "Core release binary is unexpectedly small: $($coreInfo.Length) bytes"
}

if (-not (Test-Path $modelSource -PathType Container)) {
    throw "Verified Vosk model not found: $modelSource"
}

foreach ($marker in @("am", "conf", "graph")) {
    if (-not (Test-Path (Join-Path $modelSource $marker))) {
        throw "Vosk model is incomplete: missing $marker"
    }
}

New-Item -ItemType Directory -Path $coreTargetDir -Force | Out-Null
New-Item -ItemType Directory -Path (Split-Path $modelTarget -Parent) -Force | Out-Null
New-Item -ItemType Directory -Path $resourceRoot -Force | Out-Null

if (Test-Path $coreTarget) {
    Remove-Item $coreTarget -Force
}
if (Test-Path $modelTarget) {
    Remove-Item $modelTarget -Recurse -Force
}

Copy-Item $coreSource $coreTarget -Force
Copy-Item $modelSource $modelTarget -Recurse -Force

$coreHash = (Get-FileHash $coreTarget -Algorithm SHA256).Hash.ToLowerInvariant()
$modelFiles = Get-ChildItem $modelTarget -File -Recurse | Sort-Object FullName
if (-not $modelFiles) {
    throw "Staged Vosk model contains no files"
}

$manifest = [ordered]@{
    schema_version = 1
    release = "1.0.0-rc.1"
    target = $targetTriple
    core = [ordered]@{
        file = (Split-Path $coreTarget -Leaf)
        sha256 = $coreHash
        bytes = (Get-Item $coreTarget).Length
    }
    vosk = [ordered]@{
        model = "vosk-model-small-ru-0.22"
        file_count = $modelFiles.Count
        bytes = ($modelFiles | Measure-Object Length -Sum).Sum
    }
    staged_at_utc = [DateTime]::UtcNow.ToString("o")
}

$manifest | ConvertTo-Json -Depth 5 | Set-Content $releaseManifest -Encoding UTF8

Write-Host "Staged Core: $coreTarget" -ForegroundColor Green
Write-Host "Staged Vosk: $modelTarget" -ForegroundColor Green
Write-Host "Release manifest: $releaseManifest" -ForegroundColor Green

if ($BuildInstaller) {
    Push-Location $repoRoot
    try {
        npm ci
        npm run release:windows
        if ($LASTEXITCODE -ne 0) {
            throw "Tauri release build failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}
