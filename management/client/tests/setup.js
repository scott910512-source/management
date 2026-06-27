import '@testing-library/jest-dom';

// 일부 컴포넌트가 마운트 시 호출할 수 있는 fetch를 기본 스텁 처리한다.
if (!globalThis.fetch) {
  globalThis.fetch = () => Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) });
}
