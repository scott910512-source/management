import { Router } from 'express';
import { container } from '../../../container';
import { asyncHandler } from '../middlewares/error';
import { authenticate } from '../middlewares/auth';

export const authRouter = Router();

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body ?? {};
    const result = await container.authService.register(name, email, password);
    res.status(201).json(result);
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};
    const result = await container.authService.login(email, password);
    res.json(result);
  }),
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await container.repos.userRepo.findById(req.user!.id);
    if (!user) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: '사용자를 찾을 수 없습니다.' } });
      return;
    }
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  }),
);
