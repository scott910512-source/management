import { Router } from 'express';
import { container } from '../../../container';
import { asyncHandler } from '../middlewares/error';
import { authenticate } from '../middlewares/auth';

export const regionRouter = Router();

regionRouter.use(authenticate);

/** 전체 시군구 목록 (시도별 그룹은 클라이언트에서 구성) */
regionRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const regions = await container.repos.regionRepo.listAll();
    res.json(regions);
  }),
);

/** 지역 검색 ?q=안동 */
regionRouter.get(
  '/search',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (!q) {
      res.json([]);
      return;
    }
    const results = await container.repos.regionRepo.search(q);
    res.json(results);
  }),
);
