# Build the AAMC RPL Teams app package.
#
# Run from the teams-app folder:
#   powershell -ExecutionPolicy Bypass -File .\build.ps1
#
# Produces:
#   teams-app\appPackage\color.png   (192x192 AAMC blue square with "RPL" text)
#   teams-app\appPackage\outline.png (32x32 white outline silhouette, transparent)
#   teams-app\AAMC-RPL-Teams.zip     (sideload-ready app package)

[CmdletBinding()]
param(
  [switch]$SkipIcons,
  [switch]$SkipZip
)

$ErrorActionPreference = 'Stop'
$root        = Split-Path -Parent $MyInvocation.MyCommand.Path
$pkgDir      = Join-Path $root 'appPackage'
$colorPath   = Join-Path $pkgDir 'color.png'
$outlinePath = Join-Path $pkgDir 'outline.png'
$manifest    = Join-Path $pkgDir 'manifest.json'
$zipPath     = Join-Path $root  'AAMC-RPL-Teams.zip'

if (-not (Test-Path $manifest)) {
  throw "manifest.json not found at $manifest"
}

# -- 1. Icons -----------------------------------------------------------------
if (-not $SkipIcons) {
  Write-Host 'Generating icons...' -ForegroundColor Cyan
  Add-Type -AssemblyName System.Drawing

  # Color icon: 192x192, AAMC blue, centered "RPL" text.
  $bmp = New-Object System.Drawing.Bitmap 192, 192
  $g   = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $brandBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 11, 110, 169))
  $g.FillRectangle($brandBrush, 0, 0, 192, 192)
  $font  = New-Object System.Drawing.Font 'Segoe UI', 58, ([System.Drawing.FontStyle]::Bold)
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $fmt   = New-Object System.Drawing.StringFormat
  $fmt.Alignment     = [System.Drawing.StringAlignment]::Center
  $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
  $g.DrawString('RPL', $font, $white, (New-Object System.Drawing.RectangleF 0, 0, 192, 192), $fmt)
  $bmp.Save($colorPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $font.Dispose(); $white.Dispose(); $brandBrush.Dispose()

  # Outline icon: 32x32, transparent, white rounded square.
  $bmp2 = New-Object System.Drawing.Bitmap 32, 32
  $g2   = [System.Drawing.Graphics]::FromImage($bmp2)
  $g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g2.Clear([System.Drawing.Color]::Transparent)
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), 2.5
  $g2.DrawRectangle($pen, 6, 6, 20, 20)
  $g2.DrawLine($pen, 11, 13, 21, 13)
  $g2.DrawLine($pen, 11, 19, 21, 19)
  $bmp2.Save($outlinePath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g2.Dispose(); $bmp2.Dispose(); $pen.Dispose()

  Write-Host "  color.png   -> $colorPath"   -ForegroundColor Green
  Write-Host "  outline.png -> $outlinePath" -ForegroundColor Green
}

# -- 2. Zip -------------------------------------------------------------------
if (-not $SkipZip) {
  if (-not (Test-Path $colorPath))   { throw "Missing $colorPath (run without -SkipIcons)." }
  if (-not (Test-Path $outlinePath)) { throw "Missing $outlinePath (run without -SkipIcons)." }

  Write-Host 'Packaging zip...' -ForegroundColor Cyan
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  Compress-Archive -Path $manifest, $colorPath, $outlinePath -DestinationPath $zipPath
  Write-Host "  Package  -> $zipPath" -ForegroundColor Green
}

Write-Host ''
Write-Host 'Done. Upload AAMC-RPL-Teams.zip via Teams -> Apps -> Manage your apps -> Upload a custom app.' -ForegroundColor Yellow
