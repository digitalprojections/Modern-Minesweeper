param(
    [string]$PackageName = "link.created.minesweepermaui",
    [string]$OutputDir = "play-listing\screenshots\phone"
)

$ErrorActionPreference = "Stop"

function Invoke-Adb {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$AdbArgs)

    & adb.exe @AdbArgs
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

function Capture-StoreShot {
    param(
        [string]$Name,
        [int]$Width,
        [int]$Height
    )

    $rawPath = Join-Path $rawDir "$Name.raw.png"
    $targetPath = Join-Path $outputPath "$Name.png"
    & adb.exe exec-out screencap -p > $rawPath
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    python "$PSScriptRoot\format-store-screenshot.py" $rawPath $targetPath --width $Width --height $Height
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    Write-Host "Captured $targetPath"
}

function Tap {
    param([int]$X, [int]$Y)

    Invoke-Adb -AdbArgs @("shell", "input", "tap", "$X", "$Y")
    Start-Sleep -Milliseconds 250
}

$root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$outputPath = Join-Path $root.Path $OutputDir
$rawDir = Join-Path $outputPath "raw"
New-Item -ItemType Directory -Force -Path $rawDir | Out-Null

$originalAccelerometer = (& adb.exe shell settings get system accelerometer_rotation).Trim()
$originalRotation = (& adb.exe shell settings get system user_rotation).Trim()

try {
    Invoke-Adb -AdbArgs @("shell", "settings", "put", "system", "accelerometer_rotation", "0")
    Invoke-Adb -AdbArgs @("shell", "settings", "put", "system", "user_rotation", "0")
    Invoke-Adb -AdbArgs @("shell", "am", "force-stop", $PackageName)
    Invoke-Adb -AdbArgs @("shell", "monkey", "-p", $PackageName, "-c", "android.intent.category.LAUNCHER", "1")
    Start-Sleep -Seconds 3
    Capture-StoreShot -Name "01-fresh-board-portrait" -Width 1080 -Height 1920

    Tap 130 760
    Start-Sleep -Seconds 1
    Capture-StoreShot -Name "02-first-clear-portrait" -Width 1080 -Height 1920

    Tap 900 535
    Tap 890 1460
    Tap 790 1460
    Start-Sleep -Seconds 1
    Capture-StoreShot -Name "03-marking-mode-portrait" -Width 1080 -Height 1920

    Invoke-Adb -AdbArgs @("shell", "settings", "put", "system", "user_rotation", "1")
    Start-Sleep -Seconds 2
    Capture-StoreShot -Name "04-gameplay-landscape" -Width 1920 -Height 1080

    Tap 320 520
    Tap 440 520
    Tap 560 520
    Start-Sleep -Seconds 1
    Capture-StoreShot -Name "05-wide-board-landscape" -Width 1920 -Height 1080

    Invoke-Adb -AdbArgs @("shell", "settings", "put", "system", "user_rotation", "0")
    Start-Sleep -Seconds 1
    Tap 560 535
    Start-Sleep -Seconds 1
    Capture-StoreShot -Name "06-new-round-portrait" -Width 1080 -Height 1920
}
finally {
    if ($originalAccelerometer) {
        & adb.exe shell settings put system accelerometer_rotation $originalAccelerometer | Out-Null
    }
    if ($originalRotation) {
        & adb.exe shell settings put system user_rotation $originalRotation | Out-Null
    }
}

Write-Host "Store screenshots saved in $outputPath"
