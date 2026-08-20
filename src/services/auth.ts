import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Admin, IAdmin } from '../models';
import { config } from '../config';
import { logger, redact } from '../utils/logger';
import { emailSchema, roleSchema } from '../utils/validation';

const MAX_FAILED = 5;
const LOCK_MS = 15 * 60 * 1000;
const TOKEN_TTL = '8h';

export type AdminRole = 'OWNER' | 'ADMIN' | 'SUPPORT';

export interface AdminToken {
  id: string;
  email: string;
  role: AdminRole;
  name: string;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(admin: IAdmin): string {
  const payload: AdminToken = {
    id: admin._id.toString(),
    email: admin.email,
    role: admin.role,
    name: admin.name,
  };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): AdminToken | null {
  try {
    return jwt.verify(token, config.jwtSecret) as AdminToken;
  } catch {
    return null;
  }
}

export interface LoginResult {
  success: boolean;
  token?: string;
  admin?: Omit<IAdmin, 'passwordHash'>;
  error?: string;
  locked?: boolean;
}

export async function login(
  email: string,
  password: string,
  ip?: string,
): Promise<LoginResult> {
  const parsed = emailSchema.safeParse(email?.toLowerCase().trim());
  if (!parsed.success) return { success: false, error: 'Invalid email' };

  const admin = await Admin.findOne({ email: parsed.data });
  if (!admin) return { success: false, error: 'Invalid credentials' };
  if (!admin.active) return { success: false, error: 'Account disabled' };

  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    return { success: false, error: 'Account locked', locked: true };
  }

  const ok = await verifyPassword(password, admin.passwordHash);
  if (!ok) {
    admin.failedAttempts += 1;
    if (admin.failedAttempts >= MAX_FAILED) {
      admin.lockedUntil = new Date(Date.now() + LOCK_MS);
    }
    await admin.save();
    logger.warn({ email: redact(email), ip }, 'Failed admin login');
    return { success: false, error: 'Invalid credentials' };
  }

  admin.failedAttempts = 0;
  admin.lockedUntil = undefined;
  admin.lastLogin = new Date();
  admin.lastLoginIp = ip;
  await admin.save();

  const token = signToken(admin);
  const { passwordHash, ...safe } = admin.toObject();
  return { success: true, token, admin: safe as unknown as Omit<IAdmin, 'passwordHash'> };
}

export async function createAdmin(input: {
  email: string;
  password: string;
  name: string;
  role: AdminRole;
}): Promise<IAdmin> {
  const email = emailSchema.parse(input.email.toLowerCase().trim());
  const role = roleSchema.parse(input.role);
  const existing = await Admin.findOne({ email });
  if (existing) throw new Error('Admin already exists');
  const passwordHash = await hashPassword(input.password);
  return Admin.create({ email, passwordHash, name: input.name, role, active: true });
}

export async function ensureOwnerAdmin(): Promise<void> {
  const count = await Admin.countDocuments({ role: 'OWNER' });
  if (count > 0) return;
  await createAdmin({
    email: config.adminEmail,
    password: config.adminPassword,
    name: 'Owner',
    role: 'OWNER',
  });
  logger.info({ email: redact(config.adminEmail) }, 'Initial owner admin created');
}

export const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  OWNER: ['*'],
  ADMIN: [
    'dashboard:view',
    'customers:read',
    'customers:write',
    'keys:read',
    'keys:write',
    'keys:generate',
    'keys:revoke',
    'keys:suspend',
    'keys:activate',
    'keys:assign',
    'payments:read',
    'payments:approve',
    'payments:reject',
    'tickets:read',
    'tickets:write',
    'tickets:resolve',
    'tickets:close',
    'faq:read',
    'faq:write',
    'messages:read',
    'messages:write',
    'admins:read',
    'admins:write',
    'audit:read',
    'settings:read',
    'settings:write',
    'system:read',
  ],
  SUPPORT: [
    'dashboard:view',
    'customers:read',
    'customers:write',
    'keys:read',
    'tickets:read',
    'tickets:write',
    'tickets:resolve',
    'faq:read',
    'messages:read',
    'messages:write',
    'audit:read',
  ],
};

export function hasPermission(role: AdminRole, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role];
  return perms.includes('*') || perms.includes(permission);
}
