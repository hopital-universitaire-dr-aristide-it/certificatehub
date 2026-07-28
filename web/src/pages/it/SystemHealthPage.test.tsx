import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SystemHealthPage } from './SystemHealthPage'
import { api } from '../../lib/api'

vi.mock('../../lib/api', () => ({ api: { get: vi.fn() } }))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <SystemHealthPage />
    </QueryClientProvider>,
  )
}

describe('SystemHealthPage', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/system/health') return Promise.resolve({ data: { database: 'ok', redis: 'down' } })
      if (url === '/system/logs') return Promise.resolve({ data: { lines: ['[2026-01-01] log line'] } })
      return Promise.resolve({ data: {} })
    })
  })

  it('renders service statuses and log lines', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('OK')).toBeInTheDocument())
    expect(screen.getByText('Hors service')).toBeInTheDocument()
    expect(screen.getByText(/log line/)).toBeInTheDocument()
  })

  it('shows a placeholder when there are no logs', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/system/health') return Promise.resolve({ data: { database: 'ok' } })
      if (url === '/system/logs') return Promise.resolve({ data: { lines: [] } })
      return Promise.resolve({ data: {} })
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Aucun log.')).toBeInTheDocument())
  })
})
