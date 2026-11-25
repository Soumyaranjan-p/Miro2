param(
    [int]$Seconds = 8,
    [int]$Height = 0,
    [string]$Color = "#FF1E7A64"
)

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$form = New-Object System.Windows.Forms.Form
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
$form.Bounds = New-Object System.Drawing.Rectangle(
    $screen.X,
    $screen.Y,
    $screen.Width,
    $(if ($Height -gt 0) { $Height } else { $screen.Height })
)
$form.BackColor = [System.Drawing.ColorTranslator]::FromHtml($Color)
$form.ShowInTaskbar = $false
$form.TopMost = $true
$form.Text = "Miro fullscreen probe"
$form.Show()
$form.Activate()

$deadline = (Get-Date).AddSeconds($Seconds)
while ((Get-Date) -lt $deadline) {
    [System.Windows.Forms.Application]::DoEvents()
    Start-Sleep -Milliseconds 40
}

$form.Close()
$form.Dispose()
Write-Output "Fullscreen probe finished."
