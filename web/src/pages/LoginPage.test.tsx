import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginPage } from './LoginPage'
import { renderWithProviders, seedUser, makeUser } from '../test/renderWithProviders'
import { api } from '../lib/api'

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return { ...actual, api: { post: vi.fn(), get: vi.fn() } }
})

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset()
  })

  it('submits credentials and shows an error on failure', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { message: 'Identifiants invalides.' } },
    })

    renderWithProviders(<LoginPage />, { route: '/login' })

    await userEvent.type(screen.getByLabelText('Adresse e-mail'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'wrong-password')
    await userEvent.click(screen.getByText('Se connecter'))

    await waitFor(() => expect(screen.getByText('Identifiants invalides.')).toBeInTheDocument())
  })

  it('redirects away when already authenticated', () => {
    seedUser(makeUser())
    renderWithProviders(<LoginPage />, { route: '/login' })
    expect(screen.queryByText('Se connecter')).not.toBeInTheDocument()
  })

  it('toggles password visibility when the eye icon is clicked', async () => {
    renderWithProviders(<LoginPage />, { route: '/login' })

    const passwordInput = screen.getByLabelText('Mot de passe')
    expect(passwordInput).toHaveAttribute('type', 'password')

    await userEvent.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }))
    expect(passwordInput).toHaveAttribute('type', 'text')

    await userEvent.click(screen.getByRole('button', { name: 'Masquer le mot de passe' }))
    expect(passwordInput).toHaveAttribute('type', 'password')
  })
})
