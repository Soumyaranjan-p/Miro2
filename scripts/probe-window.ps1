param(
    [string]$ProcessName = "miro",
    [string]$Screenshot
)

Add-Type @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class WinProbe
{
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

    [DllImport("user32.dll")]
    public static extern int GetWindowLong(IntPtr hWnd, int index);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder text, int maxCount);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int maxCount);

    public static List<IntPtr> TopLevelWindows(uint pid)
    {
        List<IntPtr> found = new List<IntPtr>();
        EnumWindows((hWnd, lParam) =>
        {
            uint owner;
            GetWindowThreadProcessId(hWnd, out owner);
            if (owner == pid) found.Add(hWnd);
            return true;
        }, IntPtr.Zero);
        return found;
    }
}
'@

$process = Get-Process -Name $ProcessName -ErrorAction Stop | Select-Object -First 1

foreach ($hwnd in [WinProbe]::TopLevelWindows([uint32]$process.Id)) {
    $rect = New-Object WinProbe+RECT
    [void][WinProbe]::GetWindowRect($hwnd, [ref]$rect)

    $class = New-Object System.Text.StringBuilder 256
    [void][WinProbe]::GetClassName($hwnd, $class, 256)

    $title = New-Object System.Text.StringBuilder 256
    [void][WinProbe]::GetWindowText($hwnd, $title, 256)

    $exStyle = [uint32][WinProbe]::GetWindowLong($hwnd, -20)

    [pscustomobject]@{
        Hwnd       = "0x{0:X}" -f $hwnd.ToInt64()
        Class      = $class.ToString()
        Title      = $title.ToString()
        Visible    = [WinProbe]::IsWindowVisible($hwnd)
        Position   = "{0},{1}" -f $rect.Left, $rect.Top
        Size       = "{0}x{1}" -f ($rect.Right - $rect.Left), ($rect.Bottom - $rect.Top)
        ExStyle    = "0x{0:X8}" -f $exStyle
        Topmost    = [bool]($exStyle -band 0x00000008)
        ToolWindow = [bool]($exStyle -band 0x00000080)
        NoActivate = [bool]($exStyle -band 0x08000000)
        Layered    = [bool]($exStyle -band 0x00080000)
    }
}

if ($Screenshot) {
    Add-Type -AssemblyName System.Drawing
    Add-Type -AssemblyName System.Windows.Forms

    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, $bitmap.Size)
    $bitmap.Save($Screenshot, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bitmap.Dispose()

    Write-Output "Screenshot: $Screenshot"
}
