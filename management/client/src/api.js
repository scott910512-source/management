// REST API 클라이언트. 동일 출처 세션 쿠키 + 공장(X-Plant) 헤더 사용.
const BASE = '/api';

// 현재 선택된 공장(멀티 사이트). localStorage에 보존.
let currentPlant = '';
try {
  currentPlant = localStorage.getItem('plant') || '';
} catch {
  currentPlant = '';
}
export function setPlant(p) {
  currentPlant = p || '';
  try {
    localStorage.setItem('plant', currentPlant);
  } catch {
    /* ignore */
  }
}
export function getPlant() {
  return currentPlant;
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (currentPlant) headers['X-Plant'] = encodeURIComponent(currentPlant); // 헤더는 ASCII만 허용 → 인코딩
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || (data && data.message) || '요청을 처리하지 못했습니다.');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),
  patch: (p, body) => request(p, { method: 'PATCH', body }),
  del: (p) => request(p, { method: 'DELETE' }),
};

// CSV 다운로드: 동일 출처 GET(쿠키 자동). 공장은 쿼리로 전달.
export function downloadCsv(path) {
  const sep = path.includes('?') ? '&' : '?';
  const url = currentPlant ? `${BASE}${path}${sep}plant=${encodeURIComponent(currentPlant)}` : BASE + path;
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
