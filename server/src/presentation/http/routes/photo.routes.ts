import { Router } from 'express';
import { container } from '../../../container';
import { asyncHandler } from '../middlewares/error';
import { authenticate } from '../middlewares/auth';
import { upload } from '../../../infrastructure/storage/upload';

export const photoRouter = Router();
photoRouter.use(authenticate);

/** 특정 방문의 사진 목록 */
photoRouter.get(
  '/visit/:visitId',
  asyncHandler(async (req, res) => {
    const photos = await container.photoService.list(req.params.visitId);
    res.json(photos);
  }),
);

/** 사진 업로드 (multipart/form-data, field: image) */
photoRouter.post(
  '/visit/:visitId',
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: '이미지 파일이 필요합니다.' } });
      return;
    }
    const photo = await container.photoService.add(
      req.user!.id,
      req.params.visitId,
      req.file.filename,
      req.body?.caption,
    );
    res.status(201).json(photo);
  }),
);

photoRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await container.photoService.delete(req.user!.id, req.params.id);
    res.json({ ok: true });
  }),
);
