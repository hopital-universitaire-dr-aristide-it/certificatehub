import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

/** Route racine "/" — redirige vers le premier ecran pertinent pour le role de l'utilisateur. */
export function HomeRedirect() {
  const { hasPermission, hasRole } = useAuth()

  if (hasPermission('report.view')) return <Navigate to="/dashboard" replace />
  if (hasPermission('certificate.create')) return <Navigate to="/reception" replace />
  if (hasPermission('certificate.finalize')) return <Navigate to="/doctor" replace />
  if (hasRole('it')) return <Navigate to="/it/system" replace />

  return <Navigate to="/login" replace />
}
