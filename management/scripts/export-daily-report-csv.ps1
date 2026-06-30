# ============================================================================
#  export-daily-report-csv.ps1
#  보안 라벨(IRM)/암호화가 걸린 Daily Report 엑셀의 "모든 시트"를 각각
#  UTF-8 CSV로 내보낸다. CSV는 구조상 보안 라벨을 가질 수 없으므로(평문),
#  AIP가 라벨을 재적용하지 못한다 → 서버가 자물쇠 없이 읽을 수 있다.
#
#  사용 전제:
#   - "그 파일을 열 수 있는 본인 계정"으로 실행 (복호화는 Excel이 함)
#   - Excel 데스크톱 설치
#
#  실행 예:
#   powershell -ExecutionPolicy Bypass -File export-daily-report-csv.ps1 `
#     -Source "C:\Users\A2017019\Desktop\최신 26년_2공장_Daily report_6월.xlsx" `
#     -DestFolder "C:\ManagePilot\watch\2공장"
#
#  결과: DestFolder 안에 시트별 CSV 생성
#        예) "6월 29일.csv", "생산계획 실적(CpHf).csv" ...
# ============================================================================

param(
  [Parameter(Mandatory = $true)] [string] $Source,      # 원본(보안 걸린) 엑셀 전체 경로
  [Parameter(Mandatory = $true)] [string] $DestFolder   # CSV 출력 폴더
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path $Source)) { Write-Error "원본 파일이 없습니다: $Source"; exit 1 }
if (-not (Test-Path $DestFolder)) { New-Item -ItemType Directory -Path $DestFolder -Force | Out-Null }

# 파일명에 못 쓰는 문자 치환
function Safe([string]$s) { return ($s -replace '[\\/:*?"<>|]', '_') }

$xlCSVUTF8 = 62   # UTF-8 CSV (Excel 2016+). 한글 깨짐 방지.

$excel = $null
$wb = $null
try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $excel.AutomationSecurity = 3   # 매크로 차단

  $wb = $excel.Workbooks.Open($Source, $false, $true)   # 읽기전용

  $count = 0
  foreach ($ws in $wb.Worksheets) {
    $name = Safe($ws.Name)
    $tmpWb = $null
    try {
      # 시트를 새 단일시트 워크북으로 복제 → CSV 저장 (원본 보호)
      $ws.Copy()                       # 인자 없이 호출하면 새 워크북 생성
      $tmpWb = $excel.ActiveWorkbook
      $out = Join-Path $DestFolder ($name + ".csv")
      $tmpWb.SaveAs($out, $xlCSVUTF8)
      $tmpWb.Close($false)
      $tmpWb = $null
      $count++
      Write-Host ("  [CSV] " + $name + ".csv")
    }
    catch {
      Write-Warning ("시트 '" + $ws.Name + "' 내보내기 실패: " + $_)
      if ($tmpWb) { try { $tmpWb.Close($false) } catch {} }
    }
  }

  Write-Host ("[OK] " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss") + "  시트 " + $count + "개 내보냄 -> " + $DestFolder)
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
