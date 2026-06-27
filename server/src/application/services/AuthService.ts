import type { IUserRepository } from '../../domain/repositories';
import { passwordService } from '../../infrastructure/auth/password';
import { tokenService } from '../../infrastructure/auth/jwt';
import { BadRequestError, ConflictError, UnauthorizedError } from '../../shared/errors';

export interface AuthResult {
  token: string;
  user: { id: string; name: string; email: string; role: string };
}

export class AuthService {
  constructor(private readonly users: IUserRepository) {}

  async register(name: string, email: string, password: string): Promise<AuthResult> {
    if (!name || !email || !password) throw new BadRequestError('이름, 이메일, 비밀번호는 필수입니다.');
    if (password.length < 4) throw new BadRequestError('비밀번호는 4자 이상이어야 합니다.');

    const existing = await this.users.findByEmail(email);
    if (existing) throw new ConflictError('이미 가입된 이메일입니다.');

    const hashed = await passwordService.hash(password);
    // 첫 가입자는 자동으로 관리자
    const isFirst = (await this.users.count()) === 0;
    const user = await this.users.create({
      name,
      email,
      password: hashed,
      role: isFirst ? 'ADMIN' : 'USER',
    });
    return this.issue(user);
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedError('이메일 또는 비밀번호가 올바르지 않습니다.');
    const ok = await passwordService.compare(password, user.password);
    if (!ok) throw new UnauthorizedError('이메일 또는 비밀번호가 올바르지 않습니다.');
    return this.issue(user);
  }

  private issue(user: { id: string; name: string; email: string; role: any }): AuthResult {
    const token = tokenService.sign({ sub: user.id, role: user.role, name: user.name });
    return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
  }
}
