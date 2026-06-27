import { Router } from 'express';
import { container } from '../../../container';
import { asyncHandler } from '../middlewares/error';
import { authenticate } from '../middlewares/auth';

export const exportRouter = Router();
exportRouter.use(authenticate);

/** 엑셀(xlsx) 내보내기 */
exportRouter.get(
  '/excel',
  asyncHandler(async (req, res) => {
    const buffer = await container.exportService.toExcel(req.user!.id);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="travel-korea-visits.xlsx"');
    res.send(buffer);
  }),
);

/** JSON 백업 내보내기 */
exportRouter.get(
  '/backup',
  asyncHandler(async (req, res) => {
    const data = await container.exportService.toJson(req.user!.id);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="travel-korea-backup.json"');
    res.send(JSON.stringify(data, null, 2));
  }),
);

/** JSON 백업 복원 */
exportRouter.post(
  '/restore',
  asyncHandler(async (req, res) => {
    const result = await container.exportService.importJson(req.user!.id, req.body);
    res.json(result);
  }),
);
