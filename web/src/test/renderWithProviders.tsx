import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { AuthProvider } from '../lib/auth'
import type { AuthenticatedUser } from '../types'

export function seedUser(user: AuthenticatedUser, token = 'test-token') {
  localStorage.setItem('certhub_token', token)
  localStorage.setItem('certhub_user', JSON.stringify(user))
}

export function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { id: 1, name: 'Test User', email: 'test@huda.ht', roles: ['admin'], permissions: [], ...overrides }
}

export function renderWithProviders(ui: ReactElement, { route = '/' }: { route?: string } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>{ui}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
