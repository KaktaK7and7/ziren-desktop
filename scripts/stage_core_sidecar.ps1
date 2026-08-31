param(
    [Parameter(Mandatory = $true)]
    [string]$CoreExe,
    [string]$CoreMetadata = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repo

if (-not (Test-Path $CoreExe)) {
    throw "Core executable not found: $CoreExe"
}

$targetTriple = (rustc --print host-tuple).Trim()
if (-not $targetTriple) {
    throw "Could not resolve Rust host target triple"
}

$binaryDir = Join-Path $repo "src-tauri\binaries"
New-Item -ItemType Directory -Force -Path $binaryDir | Out-Null

$extension = if ($IsWindows) { ".exe" } else { "" }
$destination = Join-Path $binaryDir ("assistant-core-" + $targetTriple + $extension)
Copy-Item -Force $CoreExe $destination

$actualHash = (Get-FileHash -Algorithm SHA256 $destination).Hash.ToLowerInvariant()

if ($CoreMetadata -and (Test-Path $CoreMetadata)) {
    $metadata = Get-Content $CoreMetadata -Raw | ConvertFrom-Json
    if ($metadata.artifact -ne "assistant-core.exe") {
        throw "Unexpected Core metadata artifact"
    }
    if ($metadata.sha256 -ne $actualHash) {
        throw "Core sidecar hash mismatch: metadata=$($metadata.sha256), staged=$actualHash"
    }
}

Write-Host "Staged Core sidecar: $destination"
Write-Host "Target triple: $targetTriple"
Write-Host "SHA256: $actualHash"
