param(
    [string]$TargetDir = "$env:USERPROFILE\.local\bin"
)

$ErrorActionPreference = "Stop"

$sourceDir = Join-Path (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path "tools\global"
$targetPath = [System.IO.Path]::GetFullPath($TargetDir)

New-Item -ItemType Directory -Force -Path $targetPath | Out-Null

foreach ($tool in @(
    "minesweeper-release-aab.ps1",
    "minesweeper-release-aab.cmd",
    "minesweeper-open-testing.ps1",
    "minesweeper-open-testing.cmd"
)) {
    Copy-Item -LiteralPath (Join-Path $sourceDir $tool) -Destination (Join-Path $targetPath $tool) -Force
}

Write-Host "Installed Modern Minesweeper tools to $targetPath"
Write-Host "Available commands: minesweeper-release-aab, minesweeper-open-testing"
