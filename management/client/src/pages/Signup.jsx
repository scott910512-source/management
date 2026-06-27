import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Field, TextInput, useToast } from '../components/ui';

export default function Signup() {
  const { signup } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ id: '', name: '', password: '', password2: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.password2) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    setBusy(true);
    try {
      await signup({ id: form.id.trim(), name: form.name.trim(), password: form.password });
      toast.ok('가입 신청 완료 — 관리자 승인 후 로그인할 수 있습니다.');
      navigate('/login');
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
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:'100%',height:'100%'}}>
            <polygon points="4,24 28,8 52,24" fill="rgba(255,255,255,0.2)" stroke="#fff" strokeWidth="3" strokeLinejoin="round"/>
            <rect x="4" y="24" width="48" height="26" rx="2" stroke="#fff" strokeWidth="3"/>
            <rect x="21" y="34" width="14" height="16" rx="2" fill="#fff"/>
            <rect x="6" y="30" width="11" height="9" rx="1" fill="rgba(255,255,255,0.7)"/>
            <rect x="39" y="30" width="11" height="9" rx="1" fill="rgba(255,255,255,0.7)"/>
          </svg>
        </div>
        <h2>사용 신청</h2>
        <p className="sub">신청 후 관리자 승인이 완료되면 로그인할 수 있습니다.</p>
        <form onSubmit={submit}>
          <Field label="아이디" required hint="영문/숫자 3~20자">
            <TextInput value={form.id} onChange={set('id')} placeholder="예: hong" autoFocus />
          </Field>
          <Field label="이름" required>
            <TextInput value={form.name} onChange={set('name')} placeholder="예: 홍길동" />
          </Field>
          <Field label="비밀번호" required hint="4자 이상">
            <TextInput type="password" value={form.password} onChange={set('password')} />
          </Field>
          <Field label="비밀번호 확인" required error={error}>
            <TextInput type="password" value={form.password2} onChange={set('password2')} />
          </Field>
          <button className="btn" style={{ width: '100%', marginTop: 6 }} disabled={busy || !form.id || !form.name || !form.password}>
            {busy ? '신청 중…' : '가입 신청'}
          </button>
        </form>
        <div className="auth-foot">
          이미 계정이 있으신가요? <Link to="/login">로그인</Link>
        </div>
      </div>
    </div>
  );
}
