import { Router, Request, Response } from 'express';
import { auditService } from '../services';
import { authRequired, requirePermission } from '../middleware/auth';
import { validateQuery } from '../middleware/validate';
import { paginationSchema } from '../utils/validation';

const router = Router();

router.get(
  '/',
  authRequired,
  requirePermission('audit:read'),
  validateQuery(paginationSchema),
  async (req: Request, res: Response) => {
    const result = await auditService.searchAuditLogs({
      search: req.query.search as string,
      action: req.query.action as string,
      page: Number(req.query.page),
      limit: Number(req.query.limit),
    });
    res.json(result);
  },
);

export default router;
