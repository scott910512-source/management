import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { describe, test, expect, vi } from 'vitest';
import Login from '../src/pages/Login';
import { ToastProvider } from '../src/components/ui';

const mockLogin = vi.fn().mockResolvedValue({ id: 'admin', role: 'admin' });
vi.mock('../src/auth/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

function renderLogin() {
  return render(
    <BrowserRouter>
      <ToastProvider>
        <Login />
      </ToastProvider>
    </BrowserRouter>,
  );
}

describe('로그인 화면', () => {
  test('아이디/비밀번호 입력 후 제출하면 login 호출', async () => {
    renderLogin();
    await userEvent.type(screen.getByPlaceholderText('아이디'), 'admin');
    await userEvent.type(screen.getByPlaceholderText('비밀번호'), 'admin1234');
    await userEvent.click(screen.getByRole('button', { name: /로그인/ }));
    expect(mockLogin).toHaveBeenCalledWith('admin', 'admin1234');
  });
});
