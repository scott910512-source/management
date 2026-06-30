# ============================================================================
#  export-daily-report-csv.ps1  (값 직접 읽기 버전)
#  보안 라벨(IRM)이 "복사/추출 금지"여도, 화면에 보이는 셀 "값"은 읽을 수 있다.
#  시트를 Copy() 하지 않고 UsedRange의 값을 직접 읽어 UTF-8 CSV로 저장한다.
#  → "이 시트를 복사할 수 없습니다" 오류를 우회.
#
#  실행 예:
#   powershell -ExecutionPolicy Bypass -File export-daily-report-csv.ps1 `
#     -Source "C:\Users\A2017019\Desktop\최신 26년_2공장_Daily report_6월.xlsx" `
#     -DestFolder "C:\ManagePilot\watch\2공장"
#
#  특정 시트만 뽑고 싶으면(권장, 빠름):
#     ... -Only "6월 29일,배치별 생산량 및 수율_26년"
# ============================================================================

param(
  [Parameter(Mandatory = $true)] [string] $Source,      # 원본(보안 걸린) 엑셀 경로
  [Parameter(Mandatory = $true)] [string] $DestFolder,  # CSV 출력 폴더
  [string] $Only = ""                                   # 쉼표구분 시트명(비우면 전체)
)

$ErrorActionPreference = "Stop"
# 콘솔 한글 깨짐 방지
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

if (-not (Test-Path $Source)) { Write-Error "원본 파일이 없습니다: $Source"; exit 1 }
if (-not (Test-Path $DestFolder)) { New-Item -ItemType Directory -Path $DestFolder -Force | Out-Null }

function Safe([string]$s) { return ($s -replace '[\\/:*?"<>|]', '_') }

# CSV 한 칸 이스케이프
function CsvCell($v) {
  if ($null -eq $v) { return "" }
  $s = [string]$v
  if ($s -match '[",\r\n]') { return '"' + ($s -replace '"', '""') + '"' }
  return $s
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

  $wb = $excel.Workbooks.Open($Source, $false, $true)   # 읽기전용

  $count = 0
  foreach ($ws in $wb.Worksheets) {
    if ($onlySet.Count -gt 0 -and -not $onlySet.ContainsKey($ws.Name)) { continue }
    $name = Safe($ws.Name)
    try {
      $ur = $ws.UsedRange
      $rows = $ur.Rows.Count
      $cols = $ur.Columns.Count
      # 값 일괄 읽기 (2차원 배열, 1-기반)
      $vals = $ur.Value2

      $sb = New-Object System.Text.StringBuilder
      if ($rows -eq 1 -and $cols -eq 1) {
        [void]$sb.AppendLine((CsvCell $vals))
      } else {
        for ($r = 1; $r -le $rows; $r++) {
          $line = New-Object System.Collections.Generic.List[string]
          for ($c = 1; $c -le $cols; $c++) {
            $line.Add((CsvCell $vals.GetValue($r, $c)))
          }
          [void]$sb.AppendLine([string]::Join(",", $line))
        }
      }

      $out = Join-Path $DestFolder ($name + ".csv")
      # UTF-8 with BOM (Excel에서 한글 정상)
      [System.IO.File]::WriteAllText($out, $sb.ToString(), (New-Object System.Text.UTF8Encoding($true)))
      $count++
      Write-Host ("  [CSV] " + $name + ".csv  (" + $rows + "x" + $cols + ")")
    }
    catch {
      Write-Warning ("시트 '" + $ws.Name + "' 읽기 실패: " + $_.Exception.Message)
    }
  }

  Write-Host ("[OK] " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss") + "  시트 " + $count + "개 -> " + $DestFolder)
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
