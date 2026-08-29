param(
    [string]$EnvFile = ".env",
    [string]$KeystorePath
)

$ErrorActionPreference = "Stop"

function Use-Jdk21IfAvailable {
    $javaHome = [Environment]::GetEnvironmentVariable("JAVA_HOME", "Process")
    if ($javaHome -and (Test-Path -LiteralPath (Join-Path $javaHome "bin\javac.exe"))) {
        $versionOutput = & (Join-Path $javaHome "bin\javac.exe") -version 2>&1
        if ($versionOutput -match "javac\s+2[1-9]\.") {
            return
        }
    }

    $candidates = @(
        "C:\Program Files\Android\openjdk\jdk-21.0.8",
        "C:\Program Files\Android\Android Studio\jbr"
    )

    foreach ($candidate in $candidates) {
        $javac = Join-Path $candidate "bin\javac.exe"
        if (-not (Test-Path -LiteralPath $javac)) {
            continue
        }

        $versionOutput = & $javac -version 2>&1
        if ($versionOutput -match "javac\s+2[1-9]\.") {
            $env:JAVA_HOME = $candidate
            $env:Path = "$candidate\bin;$env:Path"
            Write-Host "Using JDK for release build: $candidate"
            return
        }
    }
}

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
Use-Jdk21IfAvailable

$effectiveKeystorePath = if ($KeystorePath) { $KeystorePath } elseif ($env:KEYSTORE_PATH) { $env:KEYSTORE_PATH } else { "baa.keystore" }
$resolvedKeystore = Resolve-Path -LiteralPath $effectiveKeystorePath -ErrorAction Stop
$env:KEYSTORE_PATH = $resolvedKeystore.Path
Write-Host "Using release keystore: $($resolvedKeystore.Path)"

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
