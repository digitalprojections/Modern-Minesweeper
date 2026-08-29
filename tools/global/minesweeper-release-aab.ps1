param(
    [string]$ProjectRoot = $env:MINESWEEPER_PROJECT_ROOT,
    [string]$EnvFile = ".env",
    [string]$KeystorePath = "C:\Users\denta\source\repos\baa.keystore"
)

$ErrorActionPreference = "Stop"

if (-not $ProjectRoot) {
    $ProjectRoot = "C:\Users\denta\source\repos\Modern-Minesweeper"
}

$resolvedProjectRoot = Resolve-Path -LiteralPath $ProjectRoot -ErrorAction Stop
$projectPath = $resolvedProjectRoot.Path
$scriptPath = Join-Path $projectPath "scripts\build-release-aab.ps1"

if (-not (Test-Path -LiteralPath $scriptPath)) {
    throw "Modern Minesweeper release script was not found at: $scriptPath"
}

Push-Location $projectPath
try {
    & $scriptPath -EnvFile $EnvFile -KeystorePath $KeystorePath
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
    Pop-Location
}
