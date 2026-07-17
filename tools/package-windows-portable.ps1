$ErrorActionPreference = "Stop"

$workspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$desktop = Join-Path $workspace "apps\desktop"
$release = Join-Path $desktop "release"
$unpacked = Join-Path $release "win-unpacked"
if (-not (Test-Path -LiteralPath $unpacked)) {
  throw "Missing win-unpacked build. Run electron-builder --dir first."
}

$version = (Get-Content -LiteralPath (Join-Path $desktop "package.json") -Raw -Encoding UTF8 | ConvertFrom-Json).version
$productName = -join ((0x660e, 0x65e5, 0x4e4b, 0x540e, 0x517b, 0x6210, 0x52a9, 0x624b) | ForEach-Object { [char]$_ })
$folderName = "$productName-$version-portable"
$staging = [System.IO.Path]::GetFullPath((Join-Path $release $folderName))
$zipPath = [System.IO.Path]::GetFullPath((Join-Path $release "$folderName.zip"))
$releasePath = [System.IO.Path]::GetFullPath($release)
if (-not $staging.StartsWith($releasePath, [System.StringComparison]::OrdinalIgnoreCase) -or
    -not $zipPath.StartsWith($releasePath, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Unsafe portable output path"
}

if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
New-Item -ItemType Directory -Path $staging | Out-Null
Copy-Item -Path (Join-Path $unpacked "*") -Destination $staging -Recurse -Force

$dataDirectory = Join-Path $staging "Data"
New-Item -ItemType Directory -Path $dataDirectory | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $staging "portable-mode.json"), "{`n  `"mode`": `"directory-portable`",`n  `"schemaVersion`": 1`n}`n", $utf8)
[System.IO.File]::WriteAllText((Join-Path $staging "README.txt"), "LifeAfter Growth Assistant - directory portable edition`r`n`r`nRun LifeAfterGrowthAssistant.exe.`r`nPersonal data, public content cache, and backups stay in the adjacent Data folder.`r`nWhen upgrading, keep the Data folder or copy it into the new program directory.`r`n", $utf8)
[System.IO.File]::WriteAllText((Join-Path $dataDirectory "KEEP-DATA.txt"), "This directory stores personal data, public content cache, and backups. Keep it when upgrading.`r`n", $utf8)

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$stream = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::CreateNew)
$archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create, $false, [System.Text.Encoding]::UTF8)
try {
  $archive.CreateEntry("$folderName/") | Out-Null
  foreach ($file in Get-ChildItem -LiteralPath $staging -File -Recurse) {
    $relative = $file.FullName.Substring($staging.Length + 1).Replace("\", "/")
    $entryName = "$folderName/$relative"
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally {
  $archive.Dispose()
  $stream.Dispose()
}

$zip = Get-Item -LiteralPath $zipPath
Write-Output "Portable folder: $staging"
Write-Output "Portable archive: $($zip.FullName) ($($zip.Length) bytes)"
