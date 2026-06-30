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
#  기본(스마트) 동작: -Only 를 주지 않으면 자동으로 아래 2개만 내보낸다.
#     - 최신 날짜시트("N월 N일" 중 가장 최근) -> daily-latest.csv
#     - 배치별 수율 시트(연도 무관)          -> batch-yield.csv
#   날짜가 매일 바뀌고 연도(26년→27년)가 바뀌어도 패턴으로 자동 인식한다.
#   출력 파일명이 고정이라 폴더에 파일이 쌓이지 않고 매번 갱신된다.
#
#  특정 시트를 원래 이름으로 뽑고 싶으면:
#     ... -Only "6월 29일,배치별 생산량 및 수율_26년"
# ============================================================================

param(
  [Parameter(Mandatory = $true)] [string] $Source,      # 원본(보안 걸린) 엑셀 경로
  [Parameter(Mandatory = $true)] [string] $DestFolder,  # CSV 출력 폴더
  [string] $Only = ""                                   # 지정 시트명(비우면 스마트 자동선택)
)

$ErrorActionPreference = "Stop"
# 콘솔 한글 깨짐 방지
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# 주의: 공유폴더(예: E:\전사...)는 PowerShell의 Test-Path가 "Access is denied"로
# 막혀도 Excel은 열 수 있는 경우가 있다. 그래서 Source 존재검사는 하지 않고
# 바로 Excel.Open() 에 맡긴다(열기 실패 시 아래 catch에서 안내).
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

# 한 시트(ws)를 지정 경로(outPath)로 CSV 저장
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

$excel = $null
$wb = $null
try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $excel.AutomationSecurity = 3

  $wb = $excel.Workbooks.Open($Source, $false, $true)   # 읽기전용

  $count = 0

  if ($onlySet.Count -gt 0) {
    # ── 지정 시트만 (원래 시트명 그대로 저장) ──
    foreach ($ws in $wb.Worksheets) {
      if (-not $onlySet.ContainsKey($ws.Name)) { continue }
      try {
        $out = Join-Path $DestFolder ((Safe($ws.Name)) + ".csv")
        $dim = Export-SheetCsv $ws $out
        $count++; Write-Host ("  [CSV] " + $ws.Name + ".csv  (" + $dim + ")")
      } catch { Write-Warning ("시트 '" + $ws.Name + "' 읽기 실패: " + $_.Exception.Message) }
    }
  }
  else {
    # ── 스마트 자동 선택: 최신 날짜시트 + 배치시트 (이름 바뀌어도 패턴 인식) ──
    #   날짜시트:  "N월 N일..."  →  (월*100+일) 최대값 = 가장 최근
    #   배치시트:  "배치별 ... 수율 ..."  (연도 무관)
    $latestWs = $null; $latestKey = -1
    $batchWs = $null
    foreach ($ws in $wb.Worksheets) {
      $n = ($ws.Name -replace '[　 ]', ' ').Trim()
      if ($n -match '^\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일') {
        $key = [int]$matches[1] * 100 + [int]$matches[2]
        if ($key -gt $latestKey) { $latestKey = $key; $latestWs = $ws }
      }
      elseif ($n -match '배치별.*수율') {
        $batchWs = $ws
      }
    }

    if ($latestWs) {
      try {
        $out = Join-Path $DestFolder "daily-latest.csv"
        $dim = Export-SheetCsv $latestWs $out
        $count++; Write-Host ("  [CSV] daily-latest.csv  <= '" + $latestWs.Name + "'  (" + $dim + ")")
      } catch { Write-Warning ("날짜시트 읽기 실패: " + $_.Exception.Message) }
    } else { Write-Warning "날짜 시트(예: 6월 29일)를 찾지 못했습니다." }

    if ($batchWs) {
      try {
        $out = Join-Path $DestFolder "batch-yield.csv"
        $dim = Export-SheetCsv $batchWs $out
        $count++; Write-Host ("  [CSV] batch-yield.csv  <= '" + $batchWs.Name + "'  (" + $dim + ")")
      } catch { Write-Warning ("배치시트 읽기 실패: " + $_.Exception.Message) }
    } else { Write-Warning "배치별 수율 시트를 찾지 못했습니다." }
  }

  Write-Host ("[OK] " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss") + "  " + $count + "개 파일 -> " + $DestFolder)
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
