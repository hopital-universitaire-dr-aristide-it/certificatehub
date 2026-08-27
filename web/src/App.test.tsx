import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { AuthProvider } from './lib/auth'

describe('App', () => {
  it('redirects an unauthenticated visitor to the login page', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>,
    )

    await waitFor(() => expect(screen.getByText('CertificateHub')).toBeInTheDocument())
  })
})
