param(
    [string]$ProjectRoot = $env:MINESWEEPER_PROJECT_ROOT,
    [string]$PackageName = "link.created.minesweepermaui",
    [string]$Aab = "android\app\build\outputs\bundle\release\app-release.aab",
    [string]$Track = "beta",
    [string]$ReleaseName = "Modern Minesweeper 1.0 (1)",
    [ValidateSet("completed", "draft")]
    [string]$Status = "completed",
    [string]$Credentials
)

$ErrorActionPreference = "Stop"

if (-not $ProjectRoot) {
    $ProjectRoot = "C:\Users\denta\source\repos\Modern-Minesweeper"
}

$resolvedProjectRoot = Resolve-Path -LiteralPath $ProjectRoot -ErrorAction Stop
$projectPath = $resolvedProjectRoot.Path
$scriptPath = Join-Path $projectPath "scripts\publish-open-testing.ps1"

if (-not (Test-Path -LiteralPath $scriptPath)) {
    throw "Modern Minesweeper Open Testing publisher was not found at: $scriptPath"
}

$publishArgs = @{
    PackageName = $PackageName
    Aab = $Aab
    Track = $Track
    ReleaseName = $ReleaseName
    Status = $Status
}

if ($Credentials) {
    $publishArgs.Credentials = $Credentials
}

Push-Location $projectPath
try {
    & $scriptPath @publishArgs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
    Pop-Location
}
