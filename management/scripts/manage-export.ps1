# ============================================================================
#  manage-export.ps1   (PURE ASCII - safe to save in any encoding)
#  ManagePilot - protected Daily Report (IRM) -> plain CSV
#  Reads plant paths from  manage-config.txt  (UTF-8) next to this file.
#  Builds current-month filename ({M}/{MM}/{YY}/{YYYY}); no folder listing.
# ============================================================================
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# --- read config (forced UTF-8, so Korean paths never break) ---
$cfgPath = Join-Path $PSScriptRoot 'manage-config.txt'
if (-not (Test-Path $cfgPath)) { Write-Error ("manage-config.txt not found next to script: " + $cfgPath); exit 1 }
$Jobs = @()
foreach ($ln in [System.IO.File]::ReadAllLines($cfgPath, [System.Text.Encoding]::UTF8)) {
  $t = $ln.Trim()
  if ($t -eq '' -or $t.StartsWith('#')) { continue }
  $parts = $t.Split('|')
  if ($parts.Count -lt 3) { continue }
  $Jobs += @{ Name = $parts[0].Trim(); Src = $parts[1].Trim(); Dst = $parts[2].Trim() }
}
if ($Jobs.Count -eq 0) { Write-Error "No jobs in manage-config.txt (need: Name|SourcePattern|DestFolder)"; exit 1 }

# --- sheet patterns (Korean as code points -> ASCII source) ---
$WOL = [char]0xC6D4; $IL = [char]0xC77C
$BAE = [char]0xBC30; $CHI = [char]0xCE58; $BYEOL = [char]0xBCC4; $SU = [char]0xC218; $YUL = [char]0xC728
$DATE_RE  = '^\s*(\d{1,2})\s*' + $WOL + '\s*(\d{1,2})\s*' + $IL
$BATCH_RE = $BAE + $CHI + $BYEOL + '.*' + $SU + $YUL
$FWSP_RE  = '[' + [char]0x3000 + ' ]'

function CsvCell($v) {
  if ($null -eq $v) { return "" }
  $s = [string]$v
  if ($s -match '[",\r\n]') { return '"' + ($s -replace '"', '""') + '"' }
  return $s
}
function Export-SheetCsv($ws, $outPath) {
  $ur = $ws.UsedRange
  $rows = $ur.Rows.Count; $cols = $ur.Columns.Count; $vals = $ur.Value2
  $sb = New-Object System.Text.StringBuilder
  if ($rows -eq 1 -and $cols -eq 1) { [void]$sb.AppendLine((CsvCell $vals)) }
  else {
    for ($r = 1; $r -le $rows; $r++) {
      $line = New-Object System.Collections.Generic.List[string]
      for ($c = 1; $c -le $cols; $c++) { $line.Add((CsvCell $vals.GetValue($r, $c))) }
      [void]$sb.AppendLine([string]::Join(",", $line))
    }
  }
  [System.IO.File]::WriteAllText($outPath, $sb.ToString(), (New-Object System.Text.UTF8Encoding($true)))
  return "$rows x $cols"
}
function Build-Names($pattern) {
  $names = @()
  foreach ($off in 0, -1, -2) {
    $d = (Get-Date).AddMonths($off)
    $p = $pattern -replace '\{MM\}', $d.ToString('MM') -replace '\{M\}', ([string]$d.Month) -replace '\{YYYY\}', ([string]$d.Year) -replace '\{YY\}', $d.ToString('yy')
    if ($names -notcontains $p) { $names += $p }
  }
  return $names
}
function Run-Job($job) {
  Write-Host ("[" + $job.Name + "] ...")
  $names = Build-Names $job.Src
  Write-Host ("  try: " + ($names -join ' | '))
  if (-not (Test-Path $job.Dst)) { New-Item -ItemType Directory -Path $job.Dst -Force | Out-Null }
  $excel = $null; $wb = $null
  try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false; $excel.DisplayAlerts = $false; $excel.AutomationSecurity = 3
    foreach ($cf in $names) {
      try { $wb = $excel.Workbooks.Open($cf, $false, $true, [Type]::Missing, [Type]::Missing, [Type]::Missing, $true); Write-Host ("  [SRC] " + $cf); break }
      catch { Write-Warning ("  open failed: " + (Split-Path $cf -Leaf) + " -> " + $_.Exception.Message) }
    }
    if ($null -eq $wb) { Write-Warning ("  no file opened for " + $job.Name); return }
    $latestWs = $null; $latestKey = -1; $batchWs = $null
    foreach ($ws in $wb.Worksheets) {
      $n = ($ws.Name -replace $FWSP_RE, ' ').Trim()
      if ($n -match $DATE_RE) { $key = [int]$matches[1] * 100 + [int]$matches[2]; if ($key -gt $latestKey) { $latestKey = $key; $latestWs = $ws } }
      elseif ($n -match $BATCH_RE) { $batchWs = $ws }
    }
    if ($latestWs) { try { $dim = Export-SheetCsv $latestWs (Join-Path $job.Dst 'daily-latest.csv'); Write-Host ("  [CSV] daily-latest.csv <= '" + $latestWs.Name + "' (" + $dim + ")") } catch { Write-Warning ("  daily failed: " + $_.Exception.Message) } }
    else { Write-Warning "  date sheet not found" }
    if ($batchWs) { try { $dim = Export-SheetCsv $batchWs (Join-Path $job.Dst 'batch-yield.csv'); Write-Host ("  [CSV] batch-yield.csv <= '" + $batchWs.Name + "' (" + $dim + ")") } catch { Write-Warning ("  batch failed: " + $_.Exception.Message) } }
    else { Write-Warning "  batch-yield sheet not found" }
    $wb.Close($false); $wb = $null
  }
  catch { Write-Warning ("  " + $_.Exception.Message) }
  finally {
    if ($wb) { try { $wb.Close($false) } catch {} }
    if ($excel) { try { $excel.Quit() } catch {}; [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) }
    [GC]::Collect(); [GC]::WaitForPendingFinalizers()
  }
}

foreach ($job in $Jobs) { Run-Job $job }
Write-Host ("[OK] " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + " done")
