import { describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppLayout } from './AppLayout'
import { renderWithProviders, seedUser, makeUser } from '../../test/renderWithProviders'
import { api } from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return { ...actual, api: { post: vi.fn().mockResolvedValue({}), get: vi.fn() } }
})

describe('AppLayout', () => {
  it('only shows nav links the user has permission for', () => {
    seedUser(makeUser({ name: 'Dr. Aristide', roles: ['doctor'], permissions: ['certificate.finalize'] }))

    renderWithProviders(
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<p>home</p>} />
        </Route>
      </Routes>,
    )

    expect(screen.getByText('File d\'attente médecin')).toBeInTheDocument()
    expect(screen.queryByText('Utilisateurs')).not.toBeInTheDocument()
    expect(screen.getByText('Dr. Aristide')).toBeInTheDocument()
  })

  it('shows the certificates search link for reception', () => {
    seedUser(makeUser({ roles: ['reception'], permissions: ['certificate.create'] }))

    renderWithProviders(
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<p>home</p>} />
        </Route>
      </Routes>,
    )

    expect(screen.getByText('Consulter certificats')).toBeInTheDocument()
  })

  it('shows the printed-certificates link only with certificate.print', () => {
    seedUser(makeUser({ roles: ['reception'], permissions: ['certificate.create'] }))

    renderWithProviders(
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<p>home</p>} />
        </Route>
      </Routes>,
    )

    expect(screen.queryByText('Certificats imprimés')).not.toBeInTheDocument()
  })

  it('shows the JSON import link with import.manage', () => {
    seedUser(makeUser({ roles: ['superadmin'], permissions: ['import.manage'] }))

    renderWithProviders(
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<p>home</p>} />
        </Route>
      </Routes>,
    )

    expect(screen.getByText('Imports JSON')).toBeInTheDocument()
  })

  it('shows the JSON import link with import.review (manager_ext) even without import.manage', () => {
    seedUser(makeUser({ roles: ['manager_ext'], permissions: ['import.review'] }))

    renderWithProviders(
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<p>home</p>} />
        </Route>
      </Routes>,
    )

    expect(screen.getByText('Imports JSON')).toBeInTheDocument()
  })

  it('hides the JSON import link without import.manage or import.review', () => {
    seedUser(makeUser({ roles: ['reception'], permissions: ['certificate.create'] }))

    renderWithProviders(
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<p>home</p>} />
        </Route>
      </Routes>,
    )

    expect(screen.queryByText('Imports JSON')).not.toBeInTheDocument()
  })

  it('logs out when the button is clicked', async () => {
    seedUser(makeUser({ permissions: ['report.view'] }))

    renderWithProviders(
      <Routes>
        <Route path="/login" element={<p>login-page</p>} />
        <Route element={<AppLayout />}>
          <Route index element={<p>home</p>} />
        </Route>
      </Routes>,
    )

    await userEvent.click(screen.getByText('Se déconnecter'))
    expect(api.post).toHaveBeenCalledWith('/auth/logout')
  })
})
