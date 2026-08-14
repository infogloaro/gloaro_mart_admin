import { Navigate, Outlet } from 'react-router-dom';
import { getValidAdminPayload } from '../lib/auth';

export function RequireAdmin() {
  const payload = getValidAdminPayload();
  if (!payload) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
