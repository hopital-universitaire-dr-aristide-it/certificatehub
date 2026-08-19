import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

interface ProtectedRouteProps {
  permission?: string | string[]
  role?: string
}

export function ProtectedRoute({ permission, role }: ProtectedRouteProps) {
  const { user, hasPermission, hasRole } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (permission && !hasPermission(...(Array.isArray(permission) ? permission : [permission]))) {
    return <Navigate to="/" replace />
  }

  if (role && !hasRole(role)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
