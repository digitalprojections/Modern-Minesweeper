param(
    [string]$EnvFile = ".env",
    [string]$KeystorePath = "android\keystores\minesweeper-upload-key.jks",
    [string]$CertificatePath = "android\keystores\minesweeper-upload-certificate.pem",
    [string]$KeyAlias = "minesweeper-upload",
    [string]$DistinguishedName = "CN=Modern Minesweeper, OU=Android, O=Created Link, L=Tokyo, ST=Tokyo, C=JP",
    [switch]$Force
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

function Find-Keytool {
    $candidates = @(
        "C:\Program Files\Android\openjdk\jdk-21.0.8\bin\keytool.exe",
        "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe",
        "C:\Program Files\Java\jdk-17\bin\keytool.exe"
    )

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }

    $command = Get-Command keytool.exe -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    throw "keytool.exe was not found. Install JDK 21 or Android Studio JBR."
}

Import-DotEnvFile -Path $EnvFile

foreach ($name in @("STORE_PASSWORD", "KEY_PASSWORD")) {
    if (-not [Environment]::GetEnvironmentVariable($name, "Process")) {
        throw "Missing upload key environment variable: $name"
    }
}

$keytool = Find-Keytool
$resolvedKeystorePath = [System.IO.Path]::GetFullPath($KeystorePath)
$resolvedCertificatePath = [System.IO.Path]::GetFullPath($CertificatePath)

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $resolvedKeystorePath) | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $resolvedCertificatePath) | Out-Null

if ((Test-Path -LiteralPath $resolvedKeystorePath) -and -not $Force) {
    throw "Upload keystore already exists: $resolvedKeystorePath. Pass -Force to replace it."
}

if (Test-Path -LiteralPath $resolvedKeystorePath) {
    Remove-Item -LiteralPath $resolvedKeystorePath -Force
}

& $keytool -genkeypair `
    -v `
    -keystore $resolvedKeystorePath `
    -storepass $env:STORE_PASSWORD `
    -alias $KeyAlias `
    -keypass $env:KEY_PASSWORD `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -dname $DistinguishedName

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $keytool -export `
    -rfc `
    -keystore $resolvedKeystorePath `
    -storepass $env:STORE_PASSWORD `
    -alias $KeyAlias `
    -file $resolvedCertificatePath

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $keytool -list `
    -v `
    -keystore $resolvedKeystorePath `
    -storepass $env:STORE_PASSWORD `
    -alias $KeyAlias |
    Select-String -Pattern "SHA1:"

Write-Host "Upload keystore: $resolvedKeystorePath"
Write-Host "Upload certificate for Play Console reset: $resolvedCertificatePath"
Write-Host "Use KEYSTORE_PATH=$resolvedKeystorePath and KEY_ALIAS=$KeyAlias after Play accepts the reset."
