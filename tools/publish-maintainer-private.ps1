[CmdletBinding()]
param(
  [string]$Repository = "chincika/lifeafter-assistant-maintainer",
  [string]$Notes = "Private maintainer update.",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$workspace = Split-Path -Parent $PSScriptRoot
$packagePath = Join-Path $workspace "apps/maintainer/package.json"

Push-Location $workspace
try {
  $repositoryJson = & gh repo view $Repository --json nameWithOwner,visibility,isPrivate,url 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw "Cannot access $Repository. Check the GitHub CLI login."
  }
  $repositoryInfo = $repositoryJson | ConvertFrom-Json
  if (-not $repositoryInfo.isPrivate -or $repositoryInfo.visibility -ne "PRIVATE") {
    throw "Publishing refused: $Repository is not private."
  }

  $package = Get-Content -LiteralPath $packagePath -Raw -Encoding UTF8 | ConvertFrom-Json
  $version = [string]$package.version
  if (-not $version) {
    throw "The maintainer package does not have a version."
  }

  if (-not $SkipBuild) {
    $previousNodeOptions = $env:NODE_OPTIONS
    try {
      $env:NODE_OPTIONS = "--use-system-ca"
      & pnpm --filter "@lifeafter-assistant/maintainer" dist:portable
      if ($LASTEXITCODE -ne 0) {
        throw "Maintainer packaging failed."
      }
    } finally {
      $env:NODE_OPTIONS = $previousNodeOptions
    }
  }

  $releaseDirectory = Join-Path $workspace "apps/maintainer/release"
  $artifacts = @(Get-ChildItem -LiteralPath $releaseDirectory -File -Filter "*-$version-portable.exe")
  if ($artifacts.Count -ne 1) {
    throw "Expected one maintainer artifact for version $version, found $($artifacts.Count)."
  }
  $artifact = $artifacts[0].FullName

  $tag = "v$version"
  $assetName = "LifeAfter-Assistant-Maintainer-$version-portable.exe"
  $upload = Join-Path ([IO.Path]::GetTempPath()) $assetName
  Copy-Item -LiteralPath $artifact -Destination $upload -Force
  try {
    & gh release view $tag --repo $Repository 1>$null 2>$null
    $releaseExists = $LASTEXITCODE -eq 0
    if ($releaseExists) {
      & gh release upload $tag $upload --repo $Repository --clobber
      if ($LASTEXITCODE -ne 0) {
        throw "Uploading the maintainer asset failed."
      }
      & gh release edit $tag --repo $Repository --title "Maintainer v$version" --notes $Notes --latest
      if ($LASTEXITCODE -ne 0) {
        throw "Updating the private release failed."
      }
    } else {
      & gh release create $tag $upload --repo $Repository --target main --title "Maintainer v$version" --notes $Notes --latest
      if ($LASTEXITCODE -ne 0) {
        throw "Creating the private maintainer release failed."
      }
    }

    $releaseJson = & gh release view $tag --repo $Repository --json url,assets
    if ($LASTEXITCODE -ne 0) {
      throw "Cannot verify the private maintainer release."
    }
    $release = $releaseJson | ConvertFrom-Json
    $asset = @($release.assets | Where-Object { $_.name -eq $assetName })
    if ($asset.Count -ne 1) {
      throw "The private release does not contain exactly one $assetName asset."
    }
    $expectedDigest = "sha256:$((Get-FileHash -Algorithm SHA256 -LiteralPath $artifact).Hash.ToLowerInvariant())"
    if ($asset[0].digest -ne $expectedDigest) {
      throw "The private release asset digest does not match the local build."
    }
    Write-Output "Private maintainer release: $($release.url)"
    Write-Output "Asset digest: $expectedDigest"
  } finally {
    Remove-Item -LiteralPath $upload -Force -ErrorAction SilentlyContinue
  }
} finally {
  Pop-Location
}
