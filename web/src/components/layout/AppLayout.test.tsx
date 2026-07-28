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

    expect(screen.getByText('File d\'attente medecin')).toBeInTheDocument()
    expect(screen.queryByText('Utilisateurs')).not.toBeInTheDocument()
    expect(screen.getByText('Dr. Aristide')).toBeInTheDocument()
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

    await userEvent.click(screen.getByText('Se deconnecter'))
    expect(api.post).toHaveBeenCalledWith('/auth/logout')
  })
})
