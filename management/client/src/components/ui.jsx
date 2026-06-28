import { createContext, useContext, useState, useCallback, useEffect } from 'react';

/* ===== 토스트 ===== */
const ToastCtx = createContext(null);
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  const toast = {
    ok: (m) => push(m, 'ok'),
    err: (m) => push(m, 'err'),
    info: (m) => push(m, 'info'),
  };
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span>{t.type === 'err' ? '⚠️' : t.type === 'ok' ? '✓' : 'ℹ️'}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export function useToast() {
  return useContext(ToastCtx);
}

/* ===== 모달 ===== */
export function Modal({ title, subtitle, children, onClose, footer, size }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div className={`modal ${size === 'lg' ? 'lg' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div style={{ minWidth: 0 }}>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {onClose && <button type="button" className="modal-x" onClick={onClose} aria-label="닫기" title="닫기">✕</button>}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ===== 확인 다이얼로그 ===== */
export function ConfirmDialog({ title, message, confirmLabel = '삭제', danger = true, onConfirm, onClose }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>취소</button>
          <button className={`btn ${danger ? 'danger' : ''}`} onClick={onConfirm}>{confirmLabel}</button>
        </>
      }
    >
      <p style={{ margin: 0, color: 'var(--text-2)' }}>{message}</p>
    </Modal>
  );
}

/* ===== 폼 필드 ===== */
export function Field({ label, required, hint, error, children }) {
  return (
    <div className="field">
      {label && (
        <label>
          {label}
          {required && <span className="req">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="err-text">{error}</span>}
    </div>
  );
}

export function TextInput(props) {
  return <input className="input" {...props} />;
}
export function Select({ children, ...props }) {
  return (
    <select className="select" {...props}>
      {children}
    </select>
  );
}

/* ===== 배지 ===== */
export function Badge({ children, color = '', dot = false }) {
  return <span className={`badge ${color} ${dot ? 'dot' : ''}`}>{children}</span>;
}

/* Canister 상태 → 색상 매핑 */
export function statusColor(status) {
  switch (status) {
    case '사용중': return 'blue';
    case '수령': return 'green';
    case '사용완료': return '';
    case '세정의뢰': return 'orange';
    case '사용금지': return 'red';
    default: return 'purple';
  }
}

/* ===== 막대 분포 ===== */
export function Bars({ data, color = '' }) {
  const entries = Object.entries(data || {});
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (!entries.length) return <div className="empty" style={{ padding: 20 }}>데이터 없음</div>;
  return (
    <div className="bars">
      {entries.map(([k, v]) => (
        <div className="bar-row" key={k}>
          <span className="bar-label" title={k}>{k}</span>
          <span className="bar-track"><span className={`bar-fill ${color}`} style={{ width: `${(v / max) * 100}%` }} /></span>
          <span className="bar-val">{v}</span>
        </div>
      ))}
    </div>
  );
}

/* ===== 로딩 ===== */
export function Loading() {
  return (
    <div className="center-load">
      <div className="spinner" />
    </div>
  );
}

/* ===== 빈 상태 ===== */
export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}
