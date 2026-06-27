import { Router } from 'express';
import { authRouter } from './auth.routes';
import { regionRouter } from './region.routes';
import { visitRouter } from './visit.routes';
import { wishlistRouter } from './wishlist.routes';
import { photoRouter } from './photo.routes';
import { statsRouter } from './stats.routes';
import { badgeRouter } from './badge.routes';
import { adminRouter } from './admin.routes';
import { exportRouter } from './export.routes';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => res.json({ status: 'ok' }));
apiRouter.use('/auth', authRouter);
apiRouter.use('/regions', regionRouter);
apiRouter.use('/visits', visitRouter);
apiRouter.use('/wishlist', wishlistRouter);
apiRouter.use('/photos', photoRouter);
apiRouter.use('/stats', statsRouter);
apiRouter.use('/badges', badgeRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/export', exportRouter);
