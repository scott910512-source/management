import type { Request, Response, NextFunction } from 'express';
import { tokenService } from '../../../infrastructure/auth/jwt';
import { ForbiddenError, UnauthorizedError } from '../../../shared/errors';
import type { Role } from '../../../domain/entities/types';

export interface AuthUser {
  id: string;
  role: Role;
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** Bearer 토큰 검증 → req.user 주입 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError();
  }
  const token = header.slice('Bearer '.length);
  try {
    const payload = tokenService.verify(token);
    req.user = { id: payload.sub, role: payload.role, name: payload.name };
    next();
  } catch {
    throw new UnauthorizedError('토큰이 유효하지 않습니다.');
  }
}

/** 관리자 전용 가드 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) throw new UnauthorizedError();
  if (req.user.role !== 'ADMIN') throw new ForbiddenError('관리자 권한이 필요합니다.');
  next();
}
