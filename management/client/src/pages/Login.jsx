import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Field, TextInput, useToast } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(id.trim(), password);
      toast.ok('로그인되었습니다.');
      navigate('/hub');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card card card-pad">
        <div className="auth-logo">
          {/* TotalPilot 아이콘 — 공장+화살표 통합 */}
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:'100%',height:'100%'}}>
            <polygon points="4,24 28,8 52,24" fill="rgba(255,255,255,0.2)" stroke="#fff" strokeWidth="3" strokeLinejoin="round"/>
            <rect x="4" y="24" width="48" height="26" rx="2" stroke="#fff" strokeWidth="3"/>
            <rect x="21" y="34" width="14" height="16" rx="2" fill="#fff"/>
            <rect x="6" y="30" width="11" height="9" rx="1" fill="rgba(255,255,255,0.7)"/>
            <rect x="39" y="30" width="11" height="9" rx="1" fill="rgba(255,255,255,0.7)"/>
            <circle cx="44" cy="14" r="9" fill="#0071e3"/>
            <text x="44" y="18" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#fff">T</text>
          </svg>
        </div>
        <h2>TotalPilot</h2>
        <p className="sub">생산 통합관리 시스템</p>
        <form onSubmit={submit}>
          <Field label="아이디" required>
            <TextInput value={id} onChange={(e) => setId(e.target.value)} placeholder="아이디" autoFocus />
          </Field>
          <Field label="비밀번호" required error={error}>
            <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" />
          </Field>
          <button className="btn" style={{ width: '100%', marginTop: 6 }} disabled={busy || !id || !password}>
            {busy ? '로그인 중…' : '로그인'}
          </button>
        </form>
        <div className="auth-foot">
          계정이 없으신가요? <Link to="/signup">사용 신청</Link>
        </div>
        <div className="seed-tip">
          사용 및 에러 문의<br />
          <b>생산2팀 임종수 PL</b>
        </div>
      </div>
    </div>
  );
}
