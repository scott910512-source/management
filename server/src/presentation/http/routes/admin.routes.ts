import { Router } from 'express';
import { container } from '../../../container';
import { asyncHandler } from '../middlewares/error';
import { authenticate, requireAdmin } from '../middlewares/auth';

export const adminRouter = Router();
adminRouter.use(authenticate, requireAdmin);

adminRouter.get(
  '/users',
  asyncHandler(async (_req, res) => {
    const users = await container.adminService.listUsers();
    res.json(users);
  }),
);

adminRouter.patch(
  '/users/:id/role',
  asyncHandler(async (req, res) => {
    const { role } = req.body ?? {};
    const updated = await container.adminService.updateRole(req.params.id, role);
    res.json(updated);
  }),
);

adminRouter.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    await container.adminService.deleteUser(req.user!.id, req.params.id);
    res.json({ ok: true });
  }),
);
