# Draws the sabrXwatches site icon (gold watch glyph on ink) at every size the
# browsers and Google ask for. No external dependencies - GDI+ only.
param(
  [string]$Destination = "icons"
)

Add-Type -AssemblyName System.Drawing

function New-SiteIcon {
  param([int]$Size, [string]$Path)

  $bmp = New-Object System.Drawing.Bitmap $Size, $Size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear([System.Drawing.Color]::FromArgb(255, 11, 15, 25))   # brand ink #0B0F19

  $gold = [System.Drawing.Color]::FromArgb(255, 201, 169, 110)  # brand gold #C9A96E
  $goldBrush = New-Object System.Drawing.SolidBrush $gold
  $cx = $Size / 2.0
  $cy = $Size / 2.0
  $r = $Size * 0.34

  # Watch case ring
  $ringWidth = [Math]::Max(2, [Math]::Round($Size * 0.055))
  $pen = New-Object System.Drawing.Pen $gold, $ringWidth
  $g.DrawEllipse($pen, [single]($cx - $r), [single]($cy - $r), [single](2 * $r), [single](2 * $r))

  # Crown nub at 3 o'clock
  $nubW = [Math]::Max(2, [Math]::Round($Size * 0.045))
  $nubH = [Math]::Max(3, [Math]::Round($Size * 0.11))
  $g.FillRectangle($goldBrush, [single]($cx + $r + $ringWidth * 0.35), [single]($cy - $nubH / 2), [single]$nubW, [single]$nubH)

  # Hour markers at 12 / 3 / 6 / 9
  $tick = [Math]::Max(1, [Math]::Round($Size * 0.028))
  $tr = $r * 0.78
  foreach ($deg in 0, 90, 180, 270) {
    $rad = [Math]::PI * ($deg - 90) / 180
    $tx = $cx + $tr * [Math]::Cos($rad)
    $ty = $cy + $tr * [Math]::Sin($rad)
    $g.FillEllipse($goldBrush, [single]($tx - $tick / 2), [single]($ty - $tick / 2), [single]$tick, [single]$tick)
  }

  # Hands: 10:10, the classic watch-photography pose
  $handWidth = [Math]::Max(2, [Math]::Round($Size * 0.042))
  $hourPen = New-Object System.Drawing.Pen $gold, $handWidth
  $minutePen = New-Object System.Drawing.Pen $gold, ([Math]::Max(1, [Math]::Round($Size * 0.028)))
  $hourLen = $r * 0.48
  $minLen = $r * 0.72
  foreach ($pair in @(@(300, $hourLen, $hourPen), @(60, $minLen, $minutePen))) {
    $rad = [Math]::PI * ($pair[0] - 90) / 180
    $g.DrawLine($pair[2], [single]$cx, [single]$cy, [single]($cx + $pair[1] * [Math]::Cos($rad)), [single]($cy + $pair[1] * [Math]::Sin($rad)))
  }
  $dot = [Math]::Max(2, [Math]::Round($Size * 0.05))
  $g.FillEllipse($goldBrush, [single]($cx - $dot / 2), [single]($cy - $dot / 2), [single]$dot, [single]$dot)

  $g.Dispose()
  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $bmp.Save([string]$Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "wrote $Path ($Size x $Size)"
}

Set-Location $PSScriptRoot\..
New-SiteIcon -Size 512 -Path "$Destination/icon-512.png"
New-SiteIcon -Size 192 -Path "$Destination/icon-192.png"
New-SiteIcon -Size 180 -Path "$Destination/apple-touch-icon.png"
New-SiteIcon -Size 32  -Path "$Destination/favicon-32.png"
New-SiteIcon -Size 16  -Path "$Destination/favicon-16.png"
