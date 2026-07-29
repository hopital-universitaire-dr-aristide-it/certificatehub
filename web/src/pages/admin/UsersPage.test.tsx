import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UsersPage } from './UsersPage'
import { renderWithProviders, seedUser, makeUser } from '../../test/renderWithProviders'
import { api } from '../../lib/api'
import type { User } from '../../types'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const users: User[] = [
  { id: 1, name: 'Alice', email: 'alice@huda.ht', is_active: true, roles: ['reception'], created_at: new Date().toISOString(), deleted_at: null },
]

function renderPage(roles: string[] = ['superadmin']) {
  seedUser(
    makeUser({
      roles: roles as never,
      permissions: ['user.view', 'user.create', 'user.deactivate', 'role.assign', 'user.delete', 'user.restore'],
    }),
  )
  renderWithProviders(<UsersPage />)
}

describe('UsersPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(api.put).mockReset()
    vi.mocked(api.delete).mockReset()
    vi.mocked(api.get).mockResolvedValue({ data: { data: users } })
  })

  it('lists users and deactivates one', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} })
    renderPage()

    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Désactiver' }))

    expect(api.post).toHaveBeenCalledWith('/users/1/deactivate')
  })

  it('creates a new user', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} })
    renderPage()

    await waitFor(() => expect(screen.getByLabelText('Nom')).toBeInTheDocument())
    await userEvent.type(screen.getByLabelText('Nom'), 'Bob')
    await userEvent.type(screen.getByLabelText('E-mail'), 'bob@huda.ht')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'password1')
    await userEvent.click(screen.getByText('Créer'))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/users', {
        name: 'Bob',
        email: 'bob@huda.ht',
        password: 'password1',
        role: 'reception',
      }),
    )
  })

  it('lets a superadmin soft-delete a user after confirming', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(api.delete).mockResolvedValue({ data: {} })
    renderPage()

    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))

    expect(api.delete).toHaveBeenCalledWith('/users/1')
  })

  it('changes a user password', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: {} })
    renderPage()

    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    await userEvent.type(screen.getByPlaceholderText('Nouveau mot de passe'), 'nouveaumdp123')
    await userEvent.click(screen.getByRole('button', { name: 'Changer le mot de passe' }))

    expect(api.put).toHaveBeenCalledWith('/users/1', { password: 'nouveaumdp123' })
  })

  it('keeps the password button disabled for passwords under 8 characters', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    await userEvent.type(screen.getByPlaceholderText('Nouveau mot de passe'), 'short')

    expect(screen.getByRole('button', { name: 'Changer le mot de passe' })).toBeDisabled()
  })

  it('does not show the delete button to a non-superadmin admin', async () => {
    renderPage(['admin'])

    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument()
  })
})
