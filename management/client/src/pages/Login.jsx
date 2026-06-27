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
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card card card-pad">
        <div className="auth-logo">化</div>
        <h2>수불관리 시스템</h2>
        <p className="sub">화학공장 원·부재료 / Canister 관리</p>
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
