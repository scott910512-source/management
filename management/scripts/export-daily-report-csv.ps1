# ============================================================================
#  export-daily-report-csv.ps1   (ASCII-safe source)
#  Export the IRM-protected Daily Report sheets to plain UTF-8 CSV.
#  CSV cannot carry a sensitivity label, so it is always readable by server.
#
#  This file is intentionally ASCII-only. Korean sheet-name patterns are
#  built from Unicode code points so the script never breaks regardless of
#  how the .ps1 file is saved/encoded.
#
#  Default (no -Only): auto-pick latest date sheet -> daily-latest.csv
#                      and the batch-yield sheet   -> batch-yield.csv
#
#  Run:
#    powershell -ExecutionPolicy Bypass -File export-daily-report-csv.ps1 `
#      -Source "E:\...\Daily report_6.xlsx" -DestFolder "C:\ManagePilot\watch\2gongjang"
# ============================================================================

param(
  [Parameter(Mandatory = $true)] [string] $Source,
  [Parameter(Mandatory = $true)] [string] $DestFolder,
  [string] $Only = ""
)

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

if (-not (Test-Path $DestFolder)) { New-Item -ItemType Directory -Path $DestFolder -Force | Out-Null }

# Korean characters as Unicode code points (encoding-proof)
$WOL = [char]0xC6D4    # month
$IL  = [char]0xC77C    # day
$BAE = [char]0xBC30; $CHI = [char]0xCE58; $BYEOL = [char]0xBCC4   # batch-by
$SU  = [char]0xC218; $YUL = [char]0xC728                          # yield
$DATE_RE  = '^\s*(\d{1,2})\s*' + $WOL + '\s*(\d{1,2})\s*' + $IL
$BATCH_RE = $BAE + $CHI + $BYEOL + '.*' + $SU + $YUL
$FWSP_RE  = '[' + [char]0x3000 + ' ]'   # full-width + normal space class

function Safe([string]$s) { return ($s -replace '[\\/:*?"<>|]', '_') }

function CsvCell($v) {
  if ($null -eq $v) { return "" }
  $s = [string]$v
  if ($s -match '[",\r\n]') { return '"' + ($s -replace '"', '""') + '"' }
  return $s
}

function Export-SheetCsv($ws, $outPath) {
  $ur = $ws.UsedRange
  $rows = $ur.Rows.Count
  $cols = $ur.Columns.Count
  $vals = $ur.Value2
  $sb = New-Object System.Text.StringBuilder
  if ($rows -eq 1 -and $cols -eq 1) {
    [void]$sb.AppendLine((CsvCell $vals))
  } else {
    for ($r = 1; $r -le $rows; $r++) {
      $line = New-Object System.Collections.Generic.List[string]
      for ($c = 1; $c -le $cols; $c++) { $line.Add((CsvCell $vals.GetValue($r, $c))) }
      [void]$sb.AppendLine([string]::Join(",", $line))
    }
  }
  [System.IO.File]::WriteAllText($outPath, $sb.ToString(), (New-Object System.Text.UTF8Encoding($true)))
  return "$rows x $cols"
}

$onlySet = @{}
if ($Only.Trim().Length -gt 0) {
  foreach ($n in $Only.Split(',')) { $onlySet[$n.Trim()] = $true }
}

$excel = $null
$wb = $null
try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $excel.AutomationSecurity = 3

  $wb = $excel.Workbooks.Open($Source, $false, $true)   # read-only

  $count = 0

  if ($onlySet.Count -gt 0) {
    foreach ($ws in $wb.Worksheets) {
      if (-not $onlySet.ContainsKey($ws.Name)) { continue }
      try {
        $out = Join-Path $DestFolder ((Safe($ws.Name)) + ".csv")
        $dim = Export-SheetCsv $ws $out
        $count++; Write-Host ("  [CSV] " + $ws.Name + ".csv  (" + $dim + ")")
      } catch { Write-Warning ("sheet '" + $ws.Name + "' failed: " + $_.Exception.Message) }
    }
  }
  else {
    $latestWs = $null; $latestKey = -1
    $batchWs = $null
    foreach ($ws in $wb.Worksheets) {
      $n = ($ws.Name -replace $FWSP_RE, ' ').Trim()
      if ($n -match $DATE_RE) {
        $key = [int]$matches[1] * 100 + [int]$matches[2]
        if ($key -gt $latestKey) { $latestKey = $key; $latestWs = $ws }
      }
      elseif ($n -match $BATCH_RE) {
        $batchWs = $ws
      }
    }

    if ($latestWs) {
      try {
        $out = Join-Path $DestFolder "daily-latest.csv"
        $dim = Export-SheetCsv $latestWs $out
        $count++; Write-Host ("  [CSV] daily-latest.csv  <= '" + $latestWs.Name + "'  (" + $dim + ")")
      } catch { Write-Warning ("date sheet failed: " + $_.Exception.Message) }
    } else { Write-Warning "date sheet (e.g. 6 wol 29 il) not found." }

    if ($batchWs) {
      try {
        $out = Join-Path $DestFolder "batch-yield.csv"
        $dim = Export-SheetCsv $batchWs $out
        $count++; Write-Host ("  [CSV] batch-yield.csv  <= '" + $batchWs.Name + "'  (" + $dim + ")")
      } catch { Write-Warning ("batch sheet failed: " + $_.Exception.Message) }
    } else { Write-Warning "batch-yield sheet not found." }
  }

  Write-Host ("[OK] " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss") + "  " + $count + " file(s) -> " + $DestFolder)
}
catch {
  Write-Error $_
  exit 1
}
finally {
  if ($wb)    { try { $wb.Close($false) } catch {} }
  if ($excel) { try { $excel.Quit() } catch {} ; [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) }
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
