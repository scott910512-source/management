import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../shared/errors';
import { isProd } from '../../../config/env';

/** async 핸들러 래퍼 - throw 된 에러를 next 로 전달 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    return;
  }
  // Multer / 기타 알려진 에러
  if (err instanceof Error) {
    if (!isProd) console.error(err);
    const message = err.message || '서버 오류가 발생했습니다.';
    res.status(400).json({ error: { code: 'ERROR', message } });
    return;
  }
  res.status(500).json({ error: { code: 'INTERNAL', message: '서버 오류가 발생했습니다.' } });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: '엔드포인트를 찾을 수 없습니다.' } });
}
