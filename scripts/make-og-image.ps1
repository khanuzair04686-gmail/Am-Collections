# Resize a PNG/JPG into the 1200x630 social sharing card the storefront metadata points at.
# Uses Windows GDI+ (System.Drawing) so no npm image dependency is needed.
param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Destination,
  [int]$Width = 1200,
  [int]$Height = 630,
  [long]$Quality = 82
)

Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Image]::FromFile((Resolve-Path $Source).Path)
$canvas = New-Object System.Drawing.Bitmap($Width, $Height)
$gfx = [System.Drawing.Graphics]::FromImage($canvas)
$gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$gfx.Clear([System.Drawing.Color]::Black)

# cover-crop: scale so the source fills the canvas, then centre the overflow
$scale = [Math]::Max($Width / $src.Width, $Height / $src.Height)
$drawW = [int]($src.Width * $scale)
$drawH = [int]($src.Height * $scale)
$gfx.DrawImage($src, [int](($Width - $drawW) / 2), [int](($Height - $drawH) / 2), $drawW, $drawH)

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters(1)
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, $Quality)

if (Test-Path $Destination) { Remove-Item $Destination -Force }
$canvas.Save((Join-Path (Get-Location).Path $Destination), $codec, $params)

$gfx.Dispose()
$canvas.Dispose()
$src.Dispose()

Write-Output "saved $Destination ($Width x $Height)"
