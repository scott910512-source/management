# ============================================================================
#  export-daily-report.ps1
#  보안 라벨(IRM)/암호화가 걸린 Daily Report 엑셀을, 권한 있는 사용자 계정의
#  Excel(COM)로 열어 "암호 없는 일반 xlsx 사본"으로 다시 저장한다.
#  → 서버(SheetJS)는 이 사본을 읽으면 자물쇠 없이 전체 시트를 인식한다.
#
#  사용 전제:
#   - 이 스크립트를 "그 파일을 열 수 있는 본인 계정"으로 실행할 것
#   - Excel(데스크톱)이 설치되어 있을 것
#   - 작업 스케줄러로 N분마다 자동 실행 권장
#
#  실행 예:
#   powershell -ExecutionPolicy Bypass -File export-daily-report.ps1 `
#     -Source "C:\Users\A2017019\Desktop\최신 26년_2공장_Daily report_6월.xlsx" `
#     -DestFolder "C:\ManagePilot\watch\2공장"
# ============================================================================

param(
  [Parameter(Mandatory = $true)] [string] $Source,      # 원본(보안 걸린) 엑셀 전체 경로
  [Parameter(Mandatory = $true)] [string] $DestFolder,  # 서버가 감시할 출력 폴더
  [string] $DestName = "ManagePilot_Daily report.xlsx"  # 출력 파일명(키워드 포함 권장)
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Source)) { Write-Error "원본 파일이 없습니다: $Source"; exit 1 }
if (-not (Test-Path $DestFolder)) { New-Item -ItemType Directory -Path $DestFolder -Force | Out-Null }

$dest = Join-Path $DestFolder $DestName
$tmp  = Join-Path $DestFolder ("~tmp_" + [System.IO.Path]::GetRandomFileName() + ".xlsx")

$excel = $null
$wb = $null
try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $excel.AutomationSecurity = 3   # msoAutomationSecurityForceDisable (매크로 차단)

  # 읽기전용으로 열기 (원본 보호) — 본인 계정이므로 복호화되어 열림
  $wb = $excel.Workbooks.Open($Source, $false, $true)

  # 51 = xlOpenXMLWorkbook (.xlsx, 매크로 없음, 암호 없음)
  $wb.SaveAs($tmp, 51)
  $wb.Close($false)
  $wb = $null

  # 원자적 교체: 임시파일 → 최종파일 (서버가 반쯤 쓰인 파일을 읽지 않도록)
  if (Test-Path $dest) { Remove-Item $dest -Force }
  Move-Item $tmp $dest -Force

  Write-Host ("[OK] " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss") + "  ->  " + $dest)
}
catch {
  Write-Error $_
  if (Test-Path $tmp) { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
  exit 1
}
finally {
  if ($wb)    { try { $wb.Close($false) } catch {} }
  if ($excel) { try { $excel.Quit() } catch {} ; [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) }
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
