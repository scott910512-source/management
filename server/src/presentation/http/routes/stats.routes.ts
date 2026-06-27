import { Router } from 'express';
import { container } from '../../../container';
import { asyncHandler } from '../middlewares/error';
import { authenticate } from '../middlewares/auth';

export const statsRouter = Router();
statsRouter.use(authenticate);

statsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const stats = await container.statsService.getOverall(req.user!.id);
    res.json(stats);
  }),
);
