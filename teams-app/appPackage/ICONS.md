# App package icons

Teams requires two PNG icons here:

- `color.png` — **192 × 192**, full-color brand icon shown in the Teams app list and store.
- `outline.png` — **32 × 32**, transparent background, single-color white silhouette used in the Teams left rail.

## How to add them

1. Create or export both PNGs at the exact pixel sizes above.
2. Drop them into this folder with the exact filenames `color.png` and `outline.png`.
3. Re-zip `manifest.json + color.png + outline.png` (see `../README.md`).

You can reuse the existing artwork under `public/RPL Bot artwork/` — just resize and export.

## Quick placeholder (PowerShell + .NET)

If you need placeholders to get past sideload validation while you design proper artwork, run this in PowerShell from this folder:

```powershell
Add-Type -AssemblyName System.Drawing
function New-Png($path, $size, [System.Drawing.Color]$fill) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g   = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear($fill)
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
New-Png "$PSScriptRoot\color.png"   192 ([System.Drawing.Color]::FromArgb(255,11,110,169))
New-Png "$PSScriptRoot\outline.png"  32 ([System.Drawing.Color]::Transparent)
```
