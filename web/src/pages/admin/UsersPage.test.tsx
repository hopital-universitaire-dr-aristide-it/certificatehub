import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { UsersPage } from './UsersPage'
import { api } from '../../lib/api'
import type { User } from '../../types'

vi.mock('../../lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }))

const users: User[] = [
  { id: 1, name: 'Alice', email: 'alice@huda.ht', is_active: true, roles: ['reception'], created_at: new Date().toISOString() },
]

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <UsersPage />
    </QueryClientProvider>,
  )
}

describe('UsersPage', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
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
})
