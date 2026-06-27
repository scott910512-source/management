# -*- coding: utf-8 -*-
"""
전역 핫키(Global Hotkey) 관리 모듈 — Windows 전용, 외부 라이브러리 불필요.

표준 라이브러리 ctypes 로 Win32 RegisterHotKey API 를 직접 호출합니다.
별도 pip 설치(keyboard, pynput 등)가 필요 없어 오프라인 VDI 에서 그대로 동작합니다.

사용 예:
    mgr = HotkeyManager()
    mgr.add("ctrl+alt+1", lambda: print("hi"))
    mgr.start()
    ...
    mgr.stop()
"""

import sys
import ctypes
import threading
from ctypes import wintypes

# ---- Win32 상수 -----------------------------------------------------------
MOD_ALT = 0x0001
MOD_CONTROL = 0x0002
MOD_SHIFT = 0x0004
MOD_WIN = 0x0008
MOD_NOREPEAT = 0x4000  # 키를 누르고 있어도 1번만 발생

WM_HOTKEY = 0x0312
WM_QUIT = 0x0012

# 특수 키 → 가상 키 코드(Virtual-Key Code)
_SPECIAL_KEYS = {
    "space": 0x20, "enter": 0x0D, "return": 0x0D, "esc": 0x1B, "escape": 0x1B,
    "tab": 0x09, "backspace": 0x08, "delete": 0x2E, "del": 0x2E,
    "insert": 0x2D, "ins": 0x2D, "home": 0x24, "end": 0x23,
    "pageup": 0x21, "pagedown": 0x22, "pgup": 0x21, "pgdn": 0x22,
    "up": 0x26, "down": 0x28, "left": 0x25, "right": 0x27,
    "plus": 0xBB, "minus": 0xBD, "comma": 0xBC, "period": 0xBE,
    "grave": 0xC0, "tilde": 0xC0,
}


def _load_user32():
    """Windows 가 아니면 import 시점이 아니라 사용 시점에 명확히 알려준다."""
    if not sys.platform.startswith("win"):
        raise OSError("HotkeyManager 는 Windows 에서만 동작합니다 (현재: %s)" % sys.platform)
    user32 = ctypes.windll.user32
    user32.RegisterHotKey.argtypes = [wintypes.HWND, ctypes.c_int, wintypes.UINT, wintypes.UINT]
    user32.RegisterHotKey.restype = wintypes.BOOL
    user32.UnregisterHotKey.argtypes = [wintypes.HWND, ctypes.c_int]
    user32.UnregisterHotKey.restype = wintypes.BOOL
    user32.GetMessageW.argtypes = [ctypes.POINTER(wintypes.MSG), wintypes.HWND, wintypes.UINT, wintypes.UINT]
    user32.GetMessageW.restype = ctypes.c_int
    user32.PostThreadMessageW.argtypes = [wintypes.DWORD, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
    user32.PostThreadMessageW.restype = wintypes.BOOL
    return user32


class HotkeyManager:
    """전역 핫키 등록/해제 및 콜백 디스패치를 전담하는 클래스."""

    def __init__(self):
        self._bindings = {}      # id -> (mods, vk, callback, spec)
        self._next_id = 1
        self._thread = None
        self._thread_id = None
        self._ready = threading.Event()
        self.failed = []         # 등록 실패한 핫키 스펙 목록 (예: 다른 앱이 선점)

    # -- 파싱 ---------------------------------------------------------------
    @staticmethod
    def _keycode(key):
        key = key.lower()
        if len(key) == 1:
            # 0-9, a-z 는 가상 키 코드가 대문자 ASCII 와 동일
            return ord(key.upper())
        if key.startswith("f") and key[1:].isdigit():
            n = int(key[1:])
            if 1 <= n <= 24:
                return 0x70 + (n - 1)  # VK_F1 = 0x70
        if key in _SPECIAL_KEYS:
            return _SPECIAL_KEYS[key]
        raise ValueError("알 수 없는 키: %r" % key)

    @classmethod
    def parse(cls, spec):
        """'ctrl+alt+1' -> (modifiers, vk) 로 변환."""
        mods = 0
        vk = None
        for part in spec.split("+"):
            p = part.strip().lower()
            if not p:
                continue
            if p in ("ctrl", "control"):
                mods |= MOD_CONTROL
            elif p == "alt":
                mods |= MOD_ALT
            elif p == "shift":
                mods |= MOD_SHIFT
            elif p in ("win", "super", "meta", "cmd"):
                mods |= MOD_WIN
            else:
                vk = cls._keycode(p)
        if vk is None:
            raise ValueError("핫키에 일반 키가 없습니다: %r" % spec)
        return mods | MOD_NOREPEAT, vk

    # -- 등록 ---------------------------------------------------------------
    def add(self, spec, callback):
        """핫키 스펙과 콜백을 등록 큐에 추가. start() 호출 전에 모두 add 한다."""
        mods, vk = self.parse(spec)
        hid = self._next_id
        self._next_id += 1
        self._bindings[hid] = (mods, vk, callback, spec)
        return hid

    # -- 스레드 루프 --------------------------------------------------------
    def _run(self):
        user32 = _load_user32()
        kernel32 = ctypes.windll.kernel32
        self._thread_id = kernel32.GetCurrentThreadId()

        registered = []
        for hid, (mods, vk, _cb, spec) in self._bindings.items():
            if user32.RegisterHotKey(None, hid, mods, vk):
                registered.append(hid)
            else:
                self.failed.append(spec)
        self._ready.set()

        msg = wintypes.MSG()
        # hWnd=None 으로 등록했으므로 이 스레드 메시지 큐로 WM_HOTKEY 가 들어온다.
        while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) > 0:
            if msg.message == WM_HOTKEY:
                binding = self._bindings.get(msg.wParam)
                if binding:
                    try:
                        binding[2]()  # callback
                    except Exception as exc:  # 콜백 오류가 루프를 죽이지 않도록
                        sys.stderr.write("핫키 콜백 오류 (%s): %s\n" % (binding[3], exc))

        for hid in registered:
            user32.UnregisterHotKey(None, hid)

    def start(self, timeout=3.0):
        """백그라운드 스레드에서 메시지 루프 시작."""
        if self._thread and self._thread.is_alive():
            return
        self._ready.clear()
        self.failed = []
        self._thread = threading.Thread(target=self._run, name="HotkeyLoop", daemon=True)
        self._thread.start()
        self._ready.wait(timeout)
        return self.failed

    def stop(self):
        """메시지 루프 종료(WM_QUIT)."""
        if self._thread_id:
            user32 = _load_user32()
            user32.PostThreadMessageW(self._thread_id, WM_QUIT, 0, 0)
        if self._thread:
            self._thread.join(timeout=2.0)
        self._thread = None
        self._thread_id = None
