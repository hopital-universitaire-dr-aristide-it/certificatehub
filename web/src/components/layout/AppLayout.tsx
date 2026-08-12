import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { Button } from '../ui/Button'

interface NavItem {
  to: string
  label: string
  show: boolean
  section?: string
}

export function AppLayout() {
  const { user, logout, hasPermission, hasRole } = useAuth()

  const navItems: NavItem[] = [
    { to: '/dashboard', label: 'Tableau de bord', show: hasPermission('report.view') },
    { to: '/reception', label: 'Accueil', show: hasPermission('certificate.create') },
    { to: '/reception/certificates', label: 'Consulter certificats', show: hasPermission('certificate.create') },
    { to: '/reception/printed', label: 'Certificats imprimés', show: hasPermission('certificate.print') },
    { to: '/doctor', label: 'File d\'attente médecin', show: hasPermission('certificate.finalize') },
    { to: '/doctor/mine', label: 'Mes certificats', show: hasPermission('certificate.view_own') },
    { to: '/admin/form-hub', label: 'Formulaires', show: hasPermission('form_field.manage') },
    { to: '/admin/certificate-types', label: 'Types de certificats', show: hasPermission('certificate_type.manage') },
    { to: '/admin/users', label: 'Utilisateurs', show: hasPermission('user.view') },
    { to: '/admin/patients', label: 'Patients', show: hasPermission('patient.delete') },
    { to: '/admin/certificates', label: 'Certificats', show: hasPermission('certificate.delete') },
    { to: '/admin/settings', label: 'Paramètres', show: hasPermission('settings.manage') },
    { to: '/admin/import', label: 'Importer JSON', show: hasPermission('import.manage'), section: 'Administration avancée' },
    { to: '/it/system', label: 'Système', show: hasRole('it') },
  ]

  const visibleItems = navItems.filter((item) => item.show)

  return (
    <div className="flex min-h-svh">
      <aside className="flex w-64 shrink-0 flex-col border-r border-neutral-200 bg-white/60 px-4 py-6 dark:border-neutral-800 dark:bg-neutral-900/40">
        <div className="mb-8 px-2">
          <p className="text-lg font-semibold tracking-tight">CertificateHub</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Hôpital Universitaire Dr. Aristide</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {visibleItems.map((item, index) => {
            const previousSection = index > 0 ? visibleItems[index - 1].section : undefined
            const showSectionHeader = item.section && item.section !== previousSection

            return (
              <div key={item.to}>
                {showSectionHeader && (
                  <p className="mb-1 mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-neutral-400 first:mt-0 dark:text-neutral-500">
                    {item.section}
                  </p>
                )}
                <NavLink
                  to={item.to}
                  end
                  className={({ isActive }) =>
                    `block rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </div>
            )
          })}
        </nav>
        <div className="mt-auto border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <p className="px-2 text-sm font-medium">{user?.name}</p>
          <p className="px-2 text-xs text-neutral-500 dark:text-neutral-400">{user?.roles.join(', ')}</p>
          <Button variant="ghost" className="mt-2 w-full justify-start" onClick={logout}>
            Se déconnecter
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
