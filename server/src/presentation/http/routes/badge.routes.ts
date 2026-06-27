import { Router } from 'express';
import { container } from '../../../container';
import { asyncHandler } from '../middlewares/error';
import { authenticate } from '../middlewares/auth';

export const badgeRouter = Router();
badgeRouter.use(authenticate);

badgeRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await container.badgeService.listForUser(req.user!.id);
    res.json(result);
  }),
);
