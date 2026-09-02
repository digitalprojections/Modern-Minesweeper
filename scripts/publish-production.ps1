param(
    [string]$PackageName = "link.created.minesweepermaui",
    [string]$Aab = "android\app\build\outputs\bundle\release\app-release.aab",
    [string]$ReleaseName = "Modern Minesweeper 1.0.3 (5)",
    [ValidateSet("completed", "draft")]
    [string]$Status = "completed",
    [string]$Credentials
)

$ErrorActionPreference = "Stop"

$argsList = @(
    "scripts\play_publisher.py",
    "--package", $PackageName,
    "publish",
    "--aab", $Aab,
    "--track", "production",
    "--release-name", $ReleaseName,
    "--status", $Status
)

if ($Credentials) {
    $argsList = @(
        "scripts\play_publisher.py",
        "--credentials", $Credentials,
        "--package", $PackageName,
        "publish",
        "--aab", $Aab,
        "--track", "production",
        "--release-name", $ReleaseName,
        "--status", $Status
    )
}

python @argsList
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
