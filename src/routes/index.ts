import { Router } from 'express';
import authRoutes from './auth';
import dashboardRoutes from './dashboard';
import customerRoutes from './customers';
import accessKeyRoutes from './accessKeys';
import paymentRoutes from './payments';
import ticketRoutes from './tickets';
import faqRoutes from './faqs';
import auditLogRoutes from './auditLogs';
import settingsRoutes from './settings';
import adminRoutes from './admins';
import healthRoutes from './health';
import messageRoutes from './messages';

const router = Router();

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/customers', customerRoutes);
router.use('/access-keys', accessKeyRoutes);
router.use('/payments', paymentRoutes);
router.use('/tickets', ticketRoutes);
router.use('/faqs', faqRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/settings', settingsRoutes);
router.use('/admins', adminRoutes);
router.use('/messages', messageRoutes);

export default router;
