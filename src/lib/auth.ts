import { jwtDecode } from 'jwt-decode';

const TOKEN_KEY = 'gloaromart_admin_token';

export interface AdminJwtPayload {
  id: number;
  email: string;
  role: 'customer' | 'vendor' | 'admin';
  exp: number;
}

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export function getValidAdminPayload(): AdminJwtPayload | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = jwtDecode<AdminJwtPayload>(token);
    if (payload.role !== 'admin' || payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
