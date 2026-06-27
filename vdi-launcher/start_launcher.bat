@echo off
rem VDI 런처를 콘솔창 없이 백그라운드로 실행합니다.
rem 이 파일의 바로가기를 만들어 시작프로그램(shell:startup)에 넣으면
rem 로그인 시 자동으로 런처가 뜹니다.
cd /d "%~dp0"
start "" pythonw.exe "%~dp0launcher.py"
