param(
    [string]$EnvFile = ".env",
    [string]$KeystorePath = "baa.keystore"
)

$ErrorActionPreference = "Stop"

function Import-DotEnvFile {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return
    }

    Get-Content -LiteralPath $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) {
            return
        }

        $separatorIndex = $line.IndexOf("=")
        if ($separatorIndex -lt 1) {
            return
        }

        $name = $line.Substring(0, $separatorIndex).Trim()
        $value = $line.Substring($separatorIndex + 1).Trim().Trim('"').Trim("'")
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

Import-DotEnvFile -Path $EnvFile

if (-not $env:KEYSTORE_PATH) {
    $resolvedKeystore = Resolve-Path -LiteralPath $KeystorePath -ErrorAction Stop
    $env:KEYSTORE_PATH = $resolvedKeystore.Path
}

$missing = @()
foreach ($name in @("STORE_PASSWORD", "KEY_ALIAS", "KEY_PASSWORD")) {
    if (-not [Environment]::GetEnvironmentVariable($name, "Process")) {
        $missing += $name
    }
}

if ($missing.Count -gt 0) {
    throw "Missing release signing environment variables: $($missing -join ', ')"
}

npm.cmd run android:sync
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Push-Location android
try {
    .\gradlew.bat bundleRelease --console=plain
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
    Pop-Location
}
