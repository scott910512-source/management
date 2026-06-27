# ⚡ VDI 단축키 런처 (vdi-launcher)

Windows VDI 환경에서 **전역 핫키**와 **런처 창**으로 웹사이트·프로그램·폴더를
바로 실행하는 파이썬 도구입니다.

> **외부 라이브러리 0개.** 파이썬 표준 라이브러리(`ctypes`, `tkinter`,
> `webbrowser`, `subprocess`)만 사용하므로 **오프라인 wheel 다운로드가 필요 없고**,
> 서드파티 라이브러리의 인증·안정성 부담도 없습니다. Windows 에 파이썬만
> 설치돼 있으면 그대로 동작합니다.

---

## ✨ 기능

| 방식 | 설명 |
|------|------|
| **전역 핫키** | 어떤 창에 있든 `Ctrl+Alt+1` 등을 누르면 즉시 실행 (Win32 `RegisterHotKey`) |
| **런처 창** | `Ctrl+Alt+Space` 로 창을 띄우고 숫자키(1~9) 또는 마우스 클릭으로 실행 |
| **설정 파일** | `config.json` 만 고치면 실행 항목을 자유롭게 추가/변경 (재시작 없이 "새로고침") |

지원하는 실행 종류(`type`):

| type | 의미 | 예시 `target` |
|------|------|--------------|
| `url` | 기본 브라우저로 웹사이트 열기 | `https://portal.example.com` |
| `program` | 프로그램 실행(인수 `args` 지원) | `chrome`, `notepad.exe`, `C:\\...\\app.exe` |
| `folder` / `file` | 폴더·파일을 기본 연결 프로그램으로 열기 | `C:\\Users`, `C:\\report.xlsx` |
| `command` | 셸 명령 실행 | `cmd /c ipconfig` |

> **프로그램은 '이름만'으로도 실행됩니다.** Windows `ShellExecute` 를 사용하므로
> `chrome`, `winword`(워드), `excel`, `iexplore` 처럼 시스템에 등록된 앱은
> 전체 경로 없이 이름만 적어도 실행됩니다. 등록돼 있지 않은 사내 프로그램은
> **전체 경로**(예: `C:\\Program Files\\MyApp\\myapp.exe`)로 적어주세요.
> 실행이 안 되면 "ShellExecute 실패" 메시지로 원인을 알려줍니다.

---

## 🚀 사용 방법

### 1) 파일 배치
VDI 안의 아무 폴더에나 이 `vdi-launcher` 폴더를 통째로 둡니다.

### 2) 설정 수정 — `config.json`
```json
{
  "toggle_hotkey": "ctrl+alt+space",
  "items": [
    { "name": "사내 포털", "type": "url",     "target": "https://portal.example.com", "hotkey": "ctrl+alt+1" },
    { "name": "메모장",    "type": "program", "target": "notepad.exe",                "hotkey": "ctrl+alt+2" },
    { "name": "D드라이브", "type": "program", "target": "explorer.exe", "args": ["D:\\"], "hotkey": "ctrl+alt+3" }
  ]
}
```
- `toggle_hotkey`: 런처 창을 켜고/끄는 전역 핫키
- 각 항목의 `hotkey`: 생략 가능. 넣으면 전역 핫키로도 바로 실행됩니다.
- 경로의 역슬래시는 JSON 규칙상 `\\` 로 두 번 씁니다.

### 3) 실행
```bat
:: 콘솔창 없이 백그라운드 실행 (권장)
start_launcher.bat

:: 또는 디버그용 (콘솔 출력 보임)
python launcher.py
```

### 4) (선택) 로그인 시 자동 실행
1. `Win+R` → `shell:startup` 입력 → 시작프로그램 폴더 열림
2. `start_launcher.bat` 의 **바로가기**를 그 폴더에 복사
→ VDI 로그인 시 런처가 자동으로 백그라운드 대기 상태가 됩니다.

---

## ⌨️ 핫키 표기법

`config.json` 의 `hotkey` 문자열은 `+` 로 조합합니다.

- 수정자: `ctrl`, `alt`, `shift`, `win`
- 일반 키: `a`~`z`, `0`~`9`, `f1`~`f12`,
  `space`, `enter`, `esc`, `tab`, `home`, `end`,
  `up`/`down`/`left`/`right`, `insert`, `delete` 등

예) `ctrl+alt+1`, `ctrl+shift+p`, `win+f2`, `ctrl+alt+space`

> 💡 핫키 **하나에 최소 1개의 수정자**(ctrl/alt/shift/win)를 넣는 걸 권장합니다.
> Windows 가 단독 키 핫키는 잘 안 잡습니다.

---

## 🧩 구성 파일

| 파일 | 역할 |
|------|------|
| `launcher.py` | 메인 프로그램 — 런처 창(tkinter) + 실행 로직 |
| `hotkeys.py` | 전역 핫키 관리 모듈 (`ctypes` 로 Win32 API 직접 호출) |
| `config.json` | 사용자 설정 — 실행 항목·핫키 정의 |
| `start_launcher.bat` | 콘솔 없이 백그라운드 실행용 배치 |

---

## ❓ 자주 묻는 문제

**핫키가 안 먹어요 / "핫키 등록 실패" 경고가 떠요**
다른 프로그램이 같은 조합을 이미 쓰고 있을 때 발생합니다.
`config.json` 에서 다른 조합으로 바꾸고 런처 창의 **새로고침** 버튼을 누르세요.

**관리자 권한이 필요한가요?**
아니요. `RegisterHotKey` 는 일반 사용자 권한으로 동작합니다.
다만 **관리자 권한으로 실행 중인 다른 창**에 포커스가 있을 때는,
같은 권한 수준이 아니면 핫키가 그 창에서 안 잡힐 수 있습니다(Windows UIPI 정책).

**창을 닫으면 종료되나요?**
아니요. 닫기(X)·Esc 는 창을 **숨기기**만 합니다(핫키는 계속 동작).
완전히 끄려면 작업관리자에서 `pythonw.exe` 를 종료하세요.

**인터넷이 안 되는 폐쇄망인데 설치할 게 있나요?**
없습니다. 표준 라이브러리만 쓰므로 파이썬만 있으면 됩니다.
(`tkinter` 는 Windows 용 공식 파이썬 설치 시 기본 포함됩니다.)
