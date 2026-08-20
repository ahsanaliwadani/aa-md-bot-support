import { z } from 'zod';

export const phoneSchema = z
  .string()
  .min(7, 'Phone number too short')
  .max(20, 'Phone number too long')
  .regex(/^\+?[\d\s-]+$/, 'Invalid phone number');

export const emailSchema = z.string().email('Invalid email');

export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const roleSchema = z.enum(['OWNER', 'ADMIN', 'SUPPORT']);

export const keySchema = z
  .string()
  .regex(/^AA-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/, 'Invalid key format');

export const ticketCategorySchema = z.enum([
  'Access Key',
  'Connection',
  'Pairing',
  'Bot Offline',
  'Commands',
  'Media Download',
  'AI',
  'View Once',
  'Anti Delete',
  'Performance',
  'Payment',
  'Other',
]);

export const ticketStatusSchema = z.enum([
  'OPEN',
  'WAITING_FOR_USER',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
]);

export const ticketPrioritySchema = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);

export const paymentStatusSchema = z.enum([
  'PENDING',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'REFUNDED',
]);

export const keyStatusSchema = z.enum([
  'PENDING',
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
  'EXPIRED',
]);

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.string().optional(),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
