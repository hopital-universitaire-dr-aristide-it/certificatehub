import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from './auth'
import { api, TOKEN_STORAGE_KEY } from './api'

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api')
  return {
    ...actual,
    api: { post: vi.fn(), get: vi.fn() },
  }
})

function Probe() {
  const { user, login, logout, hasRole, hasPermission } = useAuth()
  return (
    <div>
      <p data-testid="user">{user ? user.name : 'anonymous'}</p>
      <p data-testid="has-role">{hasRole('admin') ? 'yes' : 'no'}</p>
      <p data-testid="has-permission">{hasPermission('report.view') ? 'yes' : 'no'}</p>
      <button onClick={() => login('a@b.com', 'secret')}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(api.post).mockReset()
  })

  it('starts anonymous when nothing is stored', () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    expect(screen.getByTestId('user').textContent).toBe('anonymous')
  })

  it('logs in, stores the token/user, and exposes role/permission helpers', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        token: 'abc123',
        user: { id: 1, name: 'Dr. Test', email: 'a@b.com', roles: ['admin'], permissions: ['report.view'] },
      },
    })

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await userEvent.click(screen.getByText('login'))

    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('Dr. Test'))
    expect(screen.getByTestId('has-role').textContent).toBe('yes')
    expect(screen.getByTestId('has-permission').textContent).toBe('yes')
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('abc123')
  })

  it('clears the session on logout', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} })
    localStorage.setItem(TOKEN_STORAGE_KEY, 'existing-token')
    localStorage.setItem(
      'certhub_user',
      JSON.stringify({ id: 1, name: 'Dr. Test', email: 'a@b.com', roles: ['admin'], permissions: [] }),
    )

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    expect(screen.getByTestId('user').textContent).toBe('Dr. Test')

    await userEvent.click(screen.getByText('logout'))

    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('anonymous'))
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
  })
})
