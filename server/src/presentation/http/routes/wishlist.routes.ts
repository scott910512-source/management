import { Router } from 'express';
import { container } from '../../../container';
import { asyncHandler } from '../middlewares/error';
import { authenticate } from '../middlewares/auth';

export const wishlistRouter = Router();
wishlistRouter.use(authenticate);

wishlistRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const list = await container.wishlistService.list(req.user!.id);
    res.json(list);
  }),
);

wishlistRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { regionId } = req.body ?? {};
    const item = await container.wishlistService.add(req.user!.id, regionId);
    res.status(201).json(item);
  }),
);

wishlistRouter.delete(
  '/:regionId',
  asyncHandler(async (req, res) => {
    await container.wishlistService.remove(req.user!.id, req.params.regionId);
    res.json({ ok: true });
  }),
);
