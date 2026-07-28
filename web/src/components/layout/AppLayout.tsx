import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { Button } from '../ui/Button'

interface NavItem {
  to: string
  label: string
  show: boolean
}

export function AppLayout() {
  const { user, logout, hasPermission, hasRole } = useAuth()

  const navItems: NavItem[] = [
    { to: '/dashboard', label: 'Tableau de bord', show: hasPermission('report.view') },
    { to: '/reception', label: 'Accueil', show: hasPermission('certificate.create') },
    { to: '/doctor', label: 'File d\'attente medecin', show: hasPermission('certificate.finalize') },
    { to: '/admin/form-hub', label: 'Formulaires', show: hasPermission('form_field.manage') },
    { to: '/admin/certificate-types', label: 'Types de certificats', show: hasPermission('certificate_type.manage') },
    { to: '/admin/users', label: 'Utilisateurs', show: hasPermission('user.view') },
    { to: '/admin/settings', label: 'Parametres', show: hasPermission('settings.manage') },
    { to: '/it/system', label: 'Systeme', show: hasRole('it') },
  ]

  return (
    <div className="flex min-h-svh">
      <aside className="flex w-64 shrink-0 flex-col border-r border-neutral-200 bg-white/60 px-4 py-6 dark:border-neutral-800 dark:bg-neutral-900/40">
        <div className="mb-8 px-2">
          <p className="text-lg font-semibold tracking-tight">CertificateHub</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">HUDA</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {navItems
            .filter((item) => item.show)
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
        </nav>
        <div className="mt-auto border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <p className="px-2 text-sm font-medium">{user?.name}</p>
          <p className="px-2 text-xs text-neutral-500 dark:text-neutral-400">{user?.roles.join(', ')}</p>
          <Button variant="ghost" className="mt-2 w-full justify-start" onClick={logout}>
            Se deconnecter
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
