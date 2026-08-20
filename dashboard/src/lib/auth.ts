import { api, setToken, clearToken } from './api';

export interface AdminInfo {
  _id: string;
  email: string;
  name: string;
  role: 'OWNER' | 'ADMIN' | 'SUPPORT';
}

export async function login(email: string, password: string): Promise<{ token: string; admin: AdminInfo }> {
  const result = await api.post<{ token: string; admin: AdminInfo }>('/api/auth/login', { email, password });
  setToken(result.token);
  return result;
}

export function logout(): void {
  clearToken();
}

export async function getMe(): Promise<{ admin: AdminInfo }> {
  return api.get('/api/auth/me');
}
