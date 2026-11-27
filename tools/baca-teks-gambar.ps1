# scripts/_ocr2.ps1 — SEMENTARA. OCR bawaan Windows + kotak batas tiap baris.
# Dipakai karena vision model dinonaktifkan: dari gambar kita hanya bisa ambil
# teks dan POSISI (x,y,w,h) untuk menebak tata letak.
param([string]$Path)

Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await($op, $resultType) {
    $task = $asTaskGeneric.MakeGenericMethod($resultType).Invoke($null, @($op))
    $task.Wait(-1) | Out-Null
    $task.Result
}

[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null

$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($Path)) ([Windows.Storage.StorageFile])
$stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if (-not $engine) {
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('en-US'))
}
if (-not $engine) { Write-Output 'OCR_TIDAK_TERSEDIA'; exit 1 }

$hasil = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])

Write-Output ("DIMENSI: {0}x{1}" -f $decoder.PixelWidth, $decoder.PixelHeight)
Write-Output 'x,y,w,h | teks'

foreach ($line in $hasil.Lines) {
    $kata = @($line.Words)
    if ($kata.Count -eq 0) { continue }

    $minX = [double]::MaxValue
    $minY = [double]::MaxValue
    $maxX = 0.0
    $maxY = 0.0
    foreach ($k in $kata) {
        $r = $k.BoundingRect
        $x1 = [double]$r.X
        $y1 = [double]$r.Y
        $x2 = $x1 + [double]$r.Width
        $y2 = $y1 + [double]$r.Height
        if ($x1 -lt $minX) { $minX = $x1 }
        if ($y1 -lt $minY) { $minY = $y1 }
        if ($x2 -gt $maxX) { $maxX = $x2 }
        if ($y2 -gt $maxY) { $maxY = $y2 }
    }

    $w = [int]($maxX - $minX)
    $h = [int]($maxY - $minY)
    Write-Output ("{0},{1},{2},{3} | {4}" -f [int]$minX, [int]$minY, $w, $h, $line.Text)
}