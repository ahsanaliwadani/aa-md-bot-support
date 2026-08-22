import { Router, Request, Response } from 'express';
import { paymentService } from '../services';
import { authRequired, requirePermission } from '../middleware/auth';
import { validateQuery, validateBody } from '../middleware/validate';
import { paginationSchema } from '../utils/validation';
import { z } from 'zod';
import { audit } from '../middleware/audit';
import { Admin, User } from '../models';
import { botManager } from '../bot/BotManager';

const router = Router();

router.get(
  '/',
  authRequired,
  requirePermission('payments:read'),
  validateQuery(paginationSchema),
  async (req: Request, res: Response) => {
    const result = await paymentService.searchPayments({
      search: req.query.search as string,
      status: req.query.status as string,
      page: Number(req.query.page),
      limit: Number(req.query.limit),
    });
    res.json(result);
  },
);

router.post(
  '/:paymentRequestId/approve',
  authRequired,
  requirePermission('payments:approve'),
  audit('PAYMENT_APPROVED', 'payment'),
  async (req: Request, res: Response) => {
    const admin = await Admin.findById(req.admin!.id);
    if (!admin) {
      res.status(404).json({ error: 'Admin not found' });
      return;
    }
    const result = await paymentService.approvePayment(
      req.params.paymentRequestId,
      admin._id,
    );
    if (!result.payment) {
      res.status(404).json({ error: 'Payment request not found' });
      return;
    }
    const customer = await User.findById(result.payment.customerId);
    if (customer && result.keyResult && botManager.isConnected()) {
      await botManager.sendText(customer.jid, `✅ *Payment Approved*\n\nThank you! Your payment for ${result.payment.paymentRequestId} has been approved.\n\n🔐 *Your Access Key*\n${result.keyResult.plainKey}\n\n📱 This key is assigned to: +${customer.phoneNumber}\n🖥️ Server: Your selected AA MD server\n\nPlease keep this key private. To activate it, reply *2* or type *activate* and paste the key exactly as shown.`);
    }
    res.json(result);
  },
);

router.post(
  '/:paymentRequestId/reject',
  authRequired,
  requirePermission('payments:reject'),
  audit('PAYMENT_REJECTED', 'payment'),
  validateBody(z.object({ notes: z.string().max(500).optional() })),
  async (req: Request, res: Response) => {
    const admin = await Admin.findById(req.admin!.id);
    if (!admin) {
      res.status(404).json({ error: 'Admin not found' });
      return;
    }
    const payment = await paymentService.rejectPayment(
      req.params.paymentRequestId,
      admin._id,
      req.body.notes,
    );
    if (!payment) {
      res.status(404).json({ error: 'Payment request not found' });
      return;
    }
    res.json({ payment });
  },
);

export default router;
