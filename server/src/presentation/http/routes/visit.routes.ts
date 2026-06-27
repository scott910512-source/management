import { Router } from 'express';
import { container } from '../../../container';
import { asyncHandler } from '../middlewares/error';
import { authenticate } from '../middlewares/auth';

export const visitRouter = Router();
visitRouter.use(authenticate);

/** 내 방문 목록 */
visitRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const visits = await container.visitService.listMine(req.user!.id);
    res.json(visits);
  }),
);

/** 타임라인 (방문일 내림차순) */
visitRouter.get(
  '/timeline',
  asyncHandler(async (req, res) => {
    const visits = await container.visitService.timeline(req.user!.id);
    res.json(visits);
  }),
);

/** 공유 피드 (타인의 공개/그룹 기록) */
visitRouter.get(
  '/feed',
  asyncHandler(async (req, res) => {
    const visits = await container.visitService.listSharedFeed(req.user!.id);
    res.json(visits);
  }),
);

/** 방문 생성/수정 (지역당 1건 upsert) */
visitRouter.put(
  '/',
  asyncHandler(async (req, res) => {
    const { regionId, status, visitDate, memo, visibility } = req.body ?? {};
    const result = await container.visitService.upsert(req.user!.id, {
      regionId,
      status,
      visitDate,
      memo,
      visibility,
    });
    res.json(result);
  }),
);

/** 공유 대상 설정 */
visitRouter.post(
  '/:id/shares',
  asyncHandler(async (req, res) => {
    const userIds: string[] = Array.isArray(req.body?.userIds) ? req.body.userIds : [];
    await container.visitService.setShares(req.user!.id, req.params.id, userIds);
    res.json({ ok: true });
  }),
);

/** 방문 삭제 */
visitRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await container.visitService.delete(req.user!.id, req.params.id);
    res.json({ ok: true });
  }),
);
