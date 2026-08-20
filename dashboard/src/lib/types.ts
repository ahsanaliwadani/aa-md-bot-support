import { api } from './api';
import type { AdminInfo } from './auth';

export interface DashboardStats {
  totalCustomers: number;
  activeKeys: number;
  pendingPayments: number;
  openTickets: number;
  resolvedTickets: number;
  revokedKeys: number;
  botConnected: boolean;
  dbConnected: boolean;
}

export interface Customer {
  _id: string;
  customerId: string;
  jid: string;
  phoneNumber: string;
  country: string;
  name?: string;
  accessKeyStatus: string;
  paymentStatus: string;
  supportStatus: string;
  blocked: boolean;
  blockedReason?: string;
  tags: string[];
  notes: string;
  lastContact: string;
  createdAt: string;
}

export interface AccessKey {
  _id: string;
  keyId: string;
  displayId: string;
  assignedNumber?: string;
  status: string;
  activatedAt?: string;
  createdAt: string;
  customerId?: { customerId: string; phoneNumber: string; country: string };
  createdBy?: { name: string; email: string };
  history: Array<{ action: string; at: string; detail?: string }>;
}

export interface Payment {
  _id: string;
  paymentRequestId: string;
  amount: number;
  currency: string;
  country: string;
  status: string;
  submittedAt: string;
  reviewedAt?: string;
  customerId?: { customerId: string; phoneNumber: string; name?: string };
  reviewedBy?: { name: string; email: string };
  accessKeyId?: { keyId: string; displayId: string; status: string };
}

export interface Ticket {
  _id: string;
  ticketId: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  jid: string;
  phoneNumber: string;
  replies: Array<{ from: string; message: string; at: string }>;
  createdAt: string;
  assignedTo?: { name: string; email: string };
  customerId?: { customerId: string; phoneNumber: string };
}

export interface FAQ {
  _id: string;
  question: string;
  answer: string;
  keywords: string[];
  enabled: boolean;
}

export interface AuditLog {
  _id: string;
  adminEmail: string;
  action: string;
  target: string;
  targetId?: string;
  detail?: string;
  ip?: string;
  result: string;
  at: string;
}

export interface AppSettings {
  botName: string;
  supportNumber: string;
  welcomeMessage: string;
  awayMessage: string;
  maintenanceMode: boolean;
  supportHours: { enabled: boolean; start: string; end: string; timezone: string };
  pricing: {
    pakistan: { amount: number; currency: string; label: string };
    international: { amount: number; currency: string; label: string };
  };
  paymentInstructions: string;
  sessionTimeoutMin: number;
}

export interface HealthStatus {
  status: string;
  bot: string;
  database: string;
  uptime: number;
  memory: { used: number; total: number; percentage: number };
  cpu: { loadAverage: number[] };
  timestamp: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export const dashboardApi = {
  getStats: () => api.get<DashboardStats>('/api/dashboard/stats'),
  getHealth: () => api.get<HealthStatus>('/api/dashboard/health'),
};

export const customerApi = {
  list: (params: { page?: number; limit?: number; search?: string; status?: string }) =>
    api.get<Paginated<Customer>>(`/api/customers?page=${params.page || 1}&limit=${params.limit || 20}&search=${params.search || ''}&status=${params.status || ''}`),
  get: (id: string) => api.get<{ user: Customer; tickets: Ticket[]; payments: Payment[] }>(`/api/customers/${id}`),
  getConversation: (id: string) => api.get<{ items: Array<{ jid: string; direction: string; body: string; at: string }> }>(`/api/customers/${id}/conversation`),
  updateNotes: (id: string, notes: string) => api.put(`/api/customers/${id}/notes`, { notes }),
  addTag: (id: string, tag: string) => api.post(`/api/customers/${id}/tags`, { tag }),
  removeTag: (id: string, tag: string) => api.delete(`/api/customers/${id}/tags/${tag}`),
  block: (id: string, reason: string) => api.post(`/api/customers/${id}/block`, { reason }),
  unblock: (id: string) => api.post(`/api/customers/${id}/unblock`),
};

export const keyApi = {
  list: (params: { page?: number; limit?: number; search?: string; status?: string }) =>
    api.get<Paginated<AccessKey>>(`/api/access-keys?page=${params.page || 1}&limit=${params.limit || 20}&search=${params.search || ''}&status=${params.status || ''}`),
  generate: () => api.post<{ keyId: string; plainKey: string; displayId: string }>('/api/access-keys/generate'),
  activate: (keyId: string) => api.post('/api/access-keys/activate', { keyId }),
  suspend: (keyId: string, reason: string) => api.post('/api/access-keys/suspend', { keyId, reason }),
  reactivate: (keyId: string) => api.post('/api/access-keys/reactivate', { keyId }),
  revoke: (keyId: string, reason: string) => api.post('/api/access-keys/revoke', { keyId, reason }),
  assign: (keyId: string, number: string, customerId: string) =>
    api.post('/api/access-keys/assign', { keyId, number, customerId }),
};

export const paymentApi = {
  list: (params: { page?: number; limit?: number; search?: string; status?: string }) =>
    api.get<Paginated<Payment>>(`/api/payments?page=${params.page || 1}&limit=${params.limit || 20}&search=${params.search || ''}&status=${params.status || ''}`),
  approve: (id: string) => api.post(`/api/payments/${id}/approve`),
  reject: (id: string, notes?: string) => api.post(`/api/payments/${id}/reject`, { notes }),
};

export const ticketApi = {
  list: (params: { page?: number; limit?: number; search?: string; status?: string; priority?: string }) =>
    api.get<Paginated<Ticket>>(`/api/tickets?page=${params.page || 1}&limit=${params.limit || 20}&search=${params.search || ''}&status=${params.status || ''}&priority=${params.priority || ''}`),
  get: (ticketId: string) => api.get<{ ticket: Ticket }>(`/api/tickets/${ticketId}`),
  reply: (ticketId: string, message: string) => api.post(`/api/tickets/${ticketId}/reply`, { message }),
  updateStatus: (ticketId: string, status: string) => api.post(`/api/tickets/${ticketId}/status`, { status }),
  updatePriority: (ticketId: string, priority: string) => api.put(`/api/tickets/${ticketId}/priority`, { priority }),
  assign: (ticketId: string, adminId: string) => api.post(`/api/tickets/${ticketId}/assign`, { adminId }),
};

export const faqApi = {
  list: () => api.get<{ items: FAQ[] }>('/api/faqs'),
  create: (data: { question: string; answer: string; keywords?: string[] }) => api.post('/api/faqs', data),
  update: (id: string, data: Partial<FAQ>) => api.put(`/api/faqs/${id}`, data),
  delete: (id: string) => api.delete(`/api/faqs/${id}`),
};

export const auditApi = {
  list: (params: { page?: number; limit?: number; search?: string; action?: string }) =>
    api.get<Paginated<AuditLog>>(`/api/audit-logs?page=${params.page || 1}&limit=${params.limit || 20}&search=${params.search || ''}&action=${params.action || ''}`),
};

export const settingsApi = {
  get: () => api.get<{ settings: AppSettings }>('/api/settings'),
  update: (data: Partial<AppSettings>) => api.put('/api/settings', data),
};

export const adminApi = {
  list: () => api.get<{ items: AdminInfo[] }>('/api/admins'),
  create: (data: { email: string; password: string; name: string; role: string }) => api.post('/api/admins', data),
  updateRole: (id: string, role: string) => api.put(`/api/admins/${id}/role`, { role }),
  updateStatus: (id: string, active: boolean) => api.put(`/api/admins/${id}/status`, { active }),
};

export interface ConversationSummary {
  jid: string;
  phoneNumber: string;
  customerName: string;
  country: string;
  blocked: boolean;
  lastMessageBody: string;
  lastMessageDirection: string;
  lastMessageAt: string;
  messageCount: number;
}

export interface ChatMessage {
  _id: string;
  jid: string;
  direction: 'INCOMING' | 'OUTGOING';
  body: string;
  messageType: string;
  at: string;
}

export const messageApi = {
  listConversations: (search?: string) =>
    api.get<{ items: ConversationSummary[] }>(`/api/messages?search=${search || ''}`),
  getConversation: (jid: string) =>
    api.get<{ messages: ChatMessage[]; user: Customer | null }>(`/api/messages/${encodeURIComponent(jid)}`),
  send: (jid: string, text: string) => api.post('/api/messages/send', { jid, text }),
};
